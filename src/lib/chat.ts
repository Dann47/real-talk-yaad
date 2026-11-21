/** Talks to the `chat` Edge Function. All AI calls and saving happen on the server. */
import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  id: number;
  role: ChatRole;
  content: string;
  flagged: boolean;
  created_at: string;
};

export type Correction = {
  id: number;
  message_id: number;
  corrected: string;
  status: 'pending' | 'approved' | 'rejected';
};

export type Topic = { id: string; title: string; guidance: string };

export type Conversation = { id: string; topic: Topic };

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

export function startConversation(topicId?: string) {
  return call<{ conversation: Conversation; messages: ChatMessage[] }>({ action: 'start', topicId });
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
    supabase.from('conversations').select('id, topics(id, title, guidance)').eq('id', conversationId).maybeSingle(),
    supabase
      .from('messages')
      .select('id, role, content, flagged, created_at')
      .eq('conversation_id', conversationId)
      .order('id', { ascending: true }),
    supabase.from('corrections').select('id, message_id, corrected, status').eq('conversation_id', conversationId),
  ]);
  const row = conversationResult.data as { id: string; topics: Topic | Topic[] | null } | null;
  const topic = firstOf(row?.topics);
  if (!row || !topic) throw new Error('That chat could not be found.');
  return {
    conversation: { id: row.id, topic } as Conversation,
    messages: (messagesResult.data ?? []) as ChatMessage[],
    corrections: (correctionsResult.data ?? []) as Correction[],
  };
}

export type ChatSummary = { id: string; topicTitle: string; messageCount: number; startedAt: string };

/** The user's most recent chat that still has room to continue, if any. */
export async function latestConversation(): Promise<ChatSummary | null> {
  const { data } = await supabase
    .from('conversations')
    .select('id, created_at, topics(title), messages(count)')
    .is('ended_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as {
    id: string;
    created_at: string;
    topics: { title: string } | { title: string }[] | null;
    messages: { count: number }[] | null;
  };
  return {
    id: row.id,
    topicTitle: firstOf(row.topics)?.title ?? 'Your chat',
    messageCount: row.messages?.[0]?.count ?? 0,
    startedAt: row.created_at,
  };
}
