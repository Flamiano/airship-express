const { handleChat } = require('../services/fleetAiService');
const { getServiceSupabase } = require('../config/db');

async function resolveDriverId(userId, role) {
  if (role !== 'driver') return null;
  return userId; // users.id doubles as the driver id referenced by driver_id columns
}

async function postChat(req, res) {
  const { message, conversationId } = req.body || {};
  const page = req.body?.context?.page;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'A non-empty "message" is required.' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: 'Message is too long (max 2000 characters).' });
  }
  if (conversationId && typeof conversationId !== 'string') {
    return res.status(400).json({ error: 'conversationId must be a string.' });
  }

  const { id: userId, role } = req.fleetUser;
  const driverId = await resolveDriverId(userId, role);

  try {
    const result = await handleChat({
      userId,
      role,
      driverId,
      message: message.trim(),
      conversationId: conversationId || null,
      page,
    });

    if (result.error) {
      // Still return 200 with a friendly reply for expected/handled failures
      // (AI not configured, provider timeout, etc.) so the chat UI can show
      // it as a normal assistant message instead of a network error.
      return res.status(200).json(result);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Fleet AI chat error:', err?.message || err);
    return res.status(500).json({ error: 'SERVER_ERROR', reply: 'Something went wrong on our end. Please try again.' });
  }
}

async function getConversationHistory(req, res) {
  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  const { conversationId } = req.params;
  const { id: userId } = req.fleetUser;

  const { data: convo, error: convoError } = await supabase
    .from('ai_conversations')
    .select('id, user_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (convoError) return res.status(500).json({ error: 'Could not load conversation.' });
  if (!convo || convo.user_id !== userId) return res.status(404).json({ error: 'Conversation not found.' });

  const { data: messages, error } = await supabase
    .from('ai_messages')
    .select('sender, content, structured_data, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) return res.status(500).json({ error: 'Could not load messages.' });

  return res.json({
    conversationId,
    messages: (messages || []).map((m) => ({
      sender: m.sender,
      content: m.content,
      structuredData: m.structured_data ? JSON.parse(m.structured_data) : null,
      createdAt: m.created_at,
    })),
  });
}

module.exports = { postChat, getConversationHistory };
