// Real Talk Yaad: Talk with the AI.
// The app calls this function; it checks the user, talks to the AI model and saves everything.
// Actions: start (new conversation), send (user message → AI reply), correct (fix an AI reply).
//
// Secrets (npx supabase secrets set ...):
//   AI_API_KEY, AI_BASE_URL (e.g. https://api.deepinfra.com/v1/openai), AI_MODEL (e.g. google/gemma-4-31B-it)
//   DAILY_MESSAGE_LIMIT (optional, default 100)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.

import { createClient } from 'npm:@supabase/supabase-js@2';

const TERMS_VERSION = '2026-11-v1'; // keep in step with src/lib/auth.tsx
const HISTORY_LIMIT = 20; // messages sent to the model as context
const MAX_INPUT = 1000; // characters per user message or correction

const AI_API_KEY = Deno.env.get('AI_API_KEY') ?? '';
const AI_BASE_URL = (Deno.env.get('AI_BASE_URL') ?? 'https://api.deepinfra.com/v1/openai').replace(/\/$/, '');
const AI_MODEL = Deno.env.get('AI_MODEL') ?? 'google/gemma-4-31B-it';
const DAILY_LIMIT = Number(Deno.env.get('DAILY_MESSAGE_LIMIT') ?? '100');

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

type Topic = { id: string; title: string; guidance: string };
type ChatTurn = { role: 'system' | 'user' | 'assistant'; content: string };

function systemPrompt(topic: Topic) {
  return [
    'You are a friendly Jamaican having a casual chat on a phone app called Real Talk Yaad.',
    'Always speak Jamaican Patois (Patwa) the way people really talk in Jamaica, even if the user writes in English.',
    'Keep every reply short: one or two sentences, under 40 words.',
    'End most replies with one simple question so the conversation keeps going.',
    `Today's topic is "${topic.title}": ${topic.guidance} Gently bring the chat back to this topic if it drifts.`,
    'Do not correct or comment on the user\'s spelling or grammar.',
    'Do not give medical, legal or financial advice. Avoid sexual content, violence, hate and politics.',
    'Do not say you are an AI unless the user asks directly. No emojis, no lists, no formatting.',
  ].join(' ');
}

async function askModel(turns: ChatTurn[]): Promise<string> {
  if (!AI_API_KEY) throw new HttpError(500, 'The AI is not set up yet (missing AI_API_KEY).');
  const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${AI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: AI_MODEL, messages: turns, max_tokens: 160, temperature: 0.8 }),
  });
  if (!response.ok) {
    console.error('AI error', response.status, await response.text());
    throw new HttpError(502, 'The AI is not answering right now. Please try again.');
  }
  const data = await response.json();
  const raw: string = data?.choices?.[0]?.message?.content ?? '';
  // Remove any "thinking" text some models add, and tidy whitespace.
  const text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim().slice(0, 2000);
  if (!text) throw new HttpError(502, 'The AI sent an empty reply. Please try again.');
  return text;
}

async function requireUser(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Please sign in again.');

  const { data: consent } = await admin
    .from('consents')
    .select('id')
    .eq('user_id', data.user.id)
    .eq('terms_version', TERMS_VERSION)
    .limit(1);
  if (!consent?.length) throw new HttpError(403, 'Please accept the consent terms first.');
  return data.user;
}

async function checkDailyLimit(userId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'user')
    .gte('created_at', since);
  if ((count ?? 0) >= DAILY_LIMIT) {
    throw new HttpError(429, `You have reached today's limit of ${DAILY_LIMIT} messages. Come back tomorrow!`);
  }
}

async function loadTopic(topicId?: string): Promise<Topic> {
  const { data: topics } = await admin.from('topics').select('id, title, guidance').eq('active', true);
  if (!topics?.length) throw new HttpError(500, 'No conversation topics are set up.');
  return topics.find((t) => t.id === topicId) ?? topics[Math.floor(Math.random() * topics.length)];
}

async function ownConversation(userId: string, conversationId: string) {
  const { data } = await admin
    .from('conversations')
    .select('id, topic_id, ended_at')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) throw new HttpError(404, 'That conversation was not found.');
  return data;
}

function cleanText(value: unknown, label: string) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new HttpError(400, `${label} is empty.`);
  if (text.length > MAX_INPUT) throw new HttpError(400, `${label} is too long (max ${MAX_INPUT} characters).`);
  return text;
}

async function start(userId: string, body: { topicId?: string }) {
  await checkDailyLimit(userId);
  const topic = await loadTopic(body.topicId);
  const { data: conversation, error } = await admin
    .from('conversations')
    .insert({ user_id: userId, topic_id: topic.id, model: AI_MODEL })
    .select('id, topic_id, created_at')
    .single();
  if (error) throw error;

  const opening = await askModel([
    { role: 'system', content: systemPrompt(topic) },
    { role: 'user', content: 'Start the conversation with a warm greeting and one question about the topic.' },
  ]);
  const { data: message, error: saveError } = await admin
    .from('messages')
    .insert({ conversation_id: conversation.id, user_id: userId, role: 'assistant', content: opening })
    .select('id, role, content, flagged, created_at')
    .single();
  if (saveError) throw saveError;

  return { conversation: { ...conversation, topic }, messages: [message] };
}

async function send(userId: string, body: { conversationId?: string; text?: string }) {
  const text = cleanText(body.text, 'Your message');
  const conversation = await ownConversation(userId, String(body.conversationId ?? ''));
  if (conversation.ended_at) throw new HttpError(400, 'This conversation has ended. Start a new one.');
  await checkDailyLimit(userId);

  const { data: userMessage, error } = await admin
    .from('messages')
    .insert({ conversation_id: conversation.id, user_id: userId, role: 'user', content: text })
    .select('id, role, content, flagged, created_at')
    .single();
  if (error) throw error;

  const { data: history } = await admin
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversation.id)
    .order('id', { ascending: false })
    .limit(HISTORY_LIMIT);
  const topic = await loadTopic(conversation.topic_id ?? undefined);
  const turns: ChatTurn[] = [
    { role: 'system', content: systemPrompt(topic) },
    ...(history ?? []).reverse().map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  const replyText = await askModel(turns);
  const { data: reply, error: replyError } = await admin
    .from('messages')
    .insert({ conversation_id: conversation.id, user_id: userId, role: 'assistant', content: replyText })
    .select('id, role, content, flagged, created_at')
    .single();
  if (replyError) throw replyError;

  return { userMessage, reply };
}

async function correct(userId: string, body: { messageId?: number; text?: string }) {
  const corrected = cleanText(body.text, 'Your correction');
  const { data: message } = await admin
    .from('messages')
    .select('id, conversation_id, role, content')
    .eq('id', Number(body.messageId))
    .eq('user_id', userId)
    .maybeSingle();
  if (!message || message.role !== 'assistant') throw new HttpError(404, 'You can only correct the AI\'s replies.');
  if (corrected === message.content) throw new HttpError(400, 'Your correction is the same as the original.');

  const { data: correction, error } = await admin
    .from('corrections')
    .insert({
      message_id: message.id,
      conversation_id: message.conversation_id,
      user_id: userId,
      original: message.content,
      corrected,
    })
    .select('id, message_id, corrected, status, created_at')
    .single();
  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'You already corrected that reply.');
    throw error;
  }
  await admin.from('messages').update({ flagged: true }).eq('id', message.id);
  return { correction };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    switch (body.action) {
      case 'start':
        return json(await start(user.id, body));
      case 'send':
        return json(await send(user.id, body));
      case 'correct':
        return json(await correct(user.id, body));
      default:
        return json({ error: 'Unknown action.' }, 400);
    }
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error(err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
