const { getServiceSupabase } = require('../config/db');
const { callAnthropic, isConfigured } = require('./aiProvider');
const { toolsForRole, runTool } = require('./fleetTools');

const MAX_TOOL_ITERATIONS = 4;
const HISTORY_LIMIT = 20;
const memoryConversations = new Map();

const ROLE_BRIEF = {
  admin: 'This user is an administrator with full visibility into fleet, driver, trip, dispatch, route, and fuel data.',
  fleet_manager: 'This user is a fleet manager who can see fleet, driver, trip, dispatch, route, and fuel data.',
  dispatcher: 'This user is a dispatcher focused on dispatch, trips, routes, and driver/vehicle assignments. They do not have access to fuel cost or maintenance-cost tools.',
  driver: "This user is a driver. When they ask about trips, drivers, vehicles, or their own status, only their own assignments are visible - never another driver's data.",
};

function buildSystemPrompt(role) {
  return [
    'You are the Fleet AI Assistant embedded in the Airship Express Fleet & Transportation Management dashboard.',
    'You help authorized fleet staff understand vehicles, drivers, trips, dispatch, routes, and fuel operations.',
    ROLE_BRIEF[role] || '',
    'Always call the appropriate fleet function to fetch real data before answering a factual question - never invent numbers, statuses, names, or IDs.',
    "If a function returns no data or an error, say so plainly instead of guessing.",
    'Keep answers concise and operational, like a control-center assistant would. Use plain language, not raw JSON, in your final answer.',
    'Only call create_incident_report when the user has clearly asked to report/log an issue and has given enough detail; otherwise ask a brief follow-up question first.',
  ].filter(Boolean).join(' ');
}

function toAnthropicTools(role) {
  return toolsForRole(role).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}

async function loadConversation(supabase, conversationId, userId) {
  if (!conversationId) return null;
  if (conversationId.startsWith('memory-')) {
    const memoryConversation = memoryConversations.get(conversationId);
    return memoryConversation?.userId === userId ? memoryConversation : null;
  }
  const { data: convo } = await supabase
    .from('ai_conversations')
    .select('id, user_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (!convo || convo.user_id !== userId) return null; // don't leak someone else's thread

  const { data: messages } = await supabase
    .from('ai_messages')
    .select('sender, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(HISTORY_LIMIT);

  return { id: convo.id, messages: messages || [] };
}

async function createConversation(supabase, userId, role, page) {
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({ user_id: userId, role, page: page || null })
    .select('id')
    .single();
  if (error) {
    const id = `memory-${userId}-${Date.now()}`;
    memoryConversations.set(id, { id, userId, messages: [] });
    console.warn('[fleetAiService] Conversation storage unavailable; using in-memory history:', error.message);
    return id;
  }
  return data.id;
}

async function saveMessage(supabase, conversationId, sender, content, structuredData) {
  if (conversationId?.startsWith('memory-')) {
    const conversation = memoryConversations.get(conversationId);
    if (conversation) conversation.messages.push({ sender, content, created_at: new Date().toISOString() });
    return;
  }
  await supabase.from('ai_messages').insert({
    conversation_id: conversationId,
    sender,
    content,
    structured_data: structuredData ? JSON.stringify(structuredData) : null,
  });
  await supabase.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
}

function extractText(contentBlocks) {
  return (contentBlocks || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

async function handleChat({ userId, role, driverId, message, conversationId, page }) {
  if (!isConfigured()) {
    return {
      error: 'AI_NOT_CONFIGURED',
      reply: "The Fleet AI assistant isn't fully set up yet - an administrator needs to add ANTHROPIC_API_KEY to the server environment.",
    };
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return { error: 'DB_NOT_CONFIGURED', reply: 'The fleet database is not reachable right now. Please try again shortly.' };
  }

  let convo = await loadConversation(supabase, conversationId, userId);
  let activeConversationId = convo?.id;
  if (!activeConversationId) {
    activeConversationId = await createConversation(supabase, userId, role, page);
  }

  const anthropicMessages = (convo?.messages || []).map((m) => ({
    role: m.sender === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));
  anthropicMessages.push({ role: 'user', content: message });

  const system = buildSystemPrompt(role);
  const tools = toAnthropicTools(role);
  const scope = { role, driverId };
  const structuredData = [];
  const toolsUsed = [];

  let finalText = '';
  try {
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
      const response = await callAnthropic({ system, messages: anthropicMessages, tools });
      const content = response.content || [];

      if (response.stop_reason !== 'tool_use') {
        finalText = extractText(content) || "I wasn't able to come up with a response for that.";
        break;
      }

      // Assistant turn included tool_use blocks - execute them and feed results back.
      anthropicMessages.push({ role: 'assistant', content });

      const toolResults = [];
      for (const block of content) {
        if (block.type !== 'tool_use') continue;
        const result = await runTool(block.name, block.input, scope);
        toolsUsed.push(block.name);
        if (!result?.error) {
          structuredData.push({ tool: block.name, input: block.input, data: result });
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      anthropicMessages.push({ role: 'user', content: toolResults });

      if (iteration === MAX_TOOL_ITERATIONS - 1) {
        finalText = 'I looked that up but need another step to finish - could you narrow down the request a bit?';
      }
    }
  } catch (err) {
    console.error('[fleetAiService] chat failed:', err?.message || err);
    const code = err?.code || 'AI_PROVIDER_ERROR';
    const friendly = {
      AI_TIMEOUT: 'The assistant took too long to respond. Please try again.',
      AI_RATE_LIMITED: "The assistant is handling a lot of requests right now. Please try again in a moment.",
      AI_NO_CREDITS: 'The AI provider account has no available credits. Add Anthropic credits, then try again.',
      AI_NOT_CONFIGURED: "The Fleet AI assistant isn't fully set up yet.",
    }[code] || "Sorry, I couldn't process that request right now.";

    await saveMessage(supabase, activeConversationId, 'user', message, null);
    return { error: code, conversationId: activeConversationId, reply: friendly };
  }

  await saveMessage(supabase, activeConversationId, 'user', message, null);
  await saveMessage(supabase, activeConversationId, 'assistant', finalText, structuredData.length ? structuredData : null);

  return {
    conversationId: activeConversationId,
    reply: finalText,
    structuredData,
    toolsUsed,
  };
}

module.exports = { handleChat };
