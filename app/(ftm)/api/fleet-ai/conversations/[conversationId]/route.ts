import { NextResponse } from "next/server";
import { hasPermission } from "../../../../lib/permissions";
import { authenticateFtmRequest } from "../../../../lib/server/ftmRequestAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "operations", "view")) {
    return NextResponse.json({ error: "Fleet AI is not available for this account." }, { status: 403 });
  }
  const supabase = context.serviceClient;
  const { data: conversation, error: conversationError } = await supabase.from("ai_conversations").select("id,user_id").eq("id", conversationId).maybeSingle();
  if (conversationError) return NextResponse.json({ error: "Could not load conversation." }, { status: 500 });
  if (!conversation || conversation.user_id !== context.user.id) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const { data: messages, error } = await supabase.from("ai_messages").select("sender,content,structured_data,created_at").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(100);
  if (error) return NextResponse.json({ error: "Could not load messages." }, { status: 500 });
  return NextResponse.json({
    conversationId,
    messages: (messages || []).map((message) => ({
      sender: message.sender,
      content: message.content,
      structuredData: message.structured_data ? JSON.parse(message.structured_data) : null,
      createdAt: message.created_at,
    })),
  });
}