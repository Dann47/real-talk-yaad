/** Talks to the `chat` Edge Function. All AI calls and saving happen on the server. */
import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  id: number;
  role: ChatRole;
  content: string;
  flagged: boolean;
  /** Set on spoken messages: where the recording is stored. */
  audio_path?: string | null;
  created_at: string;
};

export type ChatMode = 'text' | 'voice';

export type Correction = {
  id: number;
  message_id: number;
  corrected: string;
  status: 'pending' | 'approved' | 'rejected';
  /** ai_reply = fixed the AI's words; transcript = fixed what speech-to-text heard. */
  kind: 'ai_reply' | 'transcript';
  /** What it pays once verified (0 when over the per-chat limit). */
  amount_jmd: number;
};

export type Topic = { id: string; title: string; guidance: string };

export type Conversation = { id: string; mode: ChatMode; topic: Topic };

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('chat', { body });
  if (error) {
    // Show the server's own message when there is one ("You have reached today's limit...").
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new Error(payload?.error ?? 'Something went wrong. Please try again.');
    }
    throw new Error('Could not reach the server. Check your internet and try again.');
  }
  return data as T;
}

export async function startConversation(topicId?: string, mode: ChatMode = 'text') {
  const result = await call<{ conversation: Omit<Conversation, 'mode'> & { mode?: ChatMode }; messages: ChatMessage[] }>({
    action: 'start',
    topicId,
    mode,
  });
  return { ...result, conversation: { ...result.conversation, mode: result.conversation.mode ?? mode } as Conversation };
}

/** Sends an uploaded recording: the server turns it into text and replies. */
export function sendVoiceMessage(conversationId: string, audioPath: string) {
  return call<{ userMessage: ChatMessage; reply: ChatMessage }>({ action: 'voice', conversationId, audioPath });
}

export function sendMessage(conversationId: string, text: string) {
  return call<{ userMessage: ChatMessage; reply: ChatMessage }>({ action: 'send', conversationId, text });
}

export function correctMessage(messageId: number, text: string) {
  return call<{ correction: Correction }>({ action: 'correct', messageId, text });
}

/* ---------- Reading saved chats (the app may read its own rows directly) ---------- */

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Loads a saved conversation so the user can carry on where they left off. */
export async function loadConversation(conversationId: string) {
  const [conversationResult, messagesResult, correctionsResult] = await Promise.all([
    supabase.from('conversations').select('id, mode, topics(id, title, guidance)').eq('id', conversationId).maybeSingle(),
    supabase
      .from('messages')
      .select('id, role, content, flagged, audio_path, created_at')
      .eq('conversation_id', conversationId)
      .order('id', { ascending: true }),
    supabase
      .from('corrections')
      .select('id, message_id, corrected, status, kind, amount_jmd')
      .eq('conversation_id', conversationId),
  ]);
  const row = conversationResult.data as { id: string; mode: ChatMode; topics: Topic | Topic[] | null } | null;
  const topic = firstOf(row?.topics);
  if (!row || !topic) throw new Error('That chat could not be found.');
  return {
    conversation: { id: row.id, mode: row.mode, topic } as Conversation,
    messages: (messagesResult.data ?? []) as ChatMessage[],
    corrections: ((correctionsResult.data ?? []) as Correction[]).map((c) => ({ ...c, amount_jmd: Number(c.amount_jmd) })),
  };
}

export type ChatSummary = { id: string; mode: ChatMode; topicTitle: string; messageCount: number; startedAt: string };

/** The user's most recent chat that still has room to continue, if any. */
export async function latestConversation(): Promise<ChatSummary | null> {
  const { data } = await supabase
    .from('conversations')
    .select('id, mode, created_at, topics(title), messages(count)')
    .is('ended_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as {
    id: string;
    mode: ChatMode;
    created_at: string;
    topics: { title: string } | { title: string }[] | null;
    messages: { count: number }[] | null;
  };
  return {
    id: row.id,
    mode: row.mode,
    topicTitle: firstOf(row.topics)?.title ?? 'Your chat',
    messageCount: row.messages?.[0]?.count ?? 0,
    startedAt: row.created_at,
  };
}

/** All active conversation topics, in display order. */
export async function listTopics(): Promise<Topic[]> {
  const { data, error } = await supabase.from('topics').select('id, title, guidance').order('sort', { ascending: true });
  if (error) throw new Error('Could not load topics. Check your internet and try again.');
  return (data ?? []) as Topic[];
}
