// Real Talk Yaad: Talk with the AI.
// The app calls this function; it checks the user, talks to the AI model and saves everything.
// Actions:
//   start   — new conversation (mode: text or voice)
//   send    — typed message → AI reply
//   voice   — recorded message in Storage → speech-to-text → AI reply
//   correct — fix an AI reply, or fix the words speech-to-text heard
//   end     — close a conversation (it no longer shows under "Continue your chat")
//   record_lines — the unfinished set of lines (to pick up where you left off), or with fresh: true a new set:
//                  AI-written lines plus hand-checked quality-check lines
//   verify_queue — up to 10 pieces of other people's work to check (corrections and recordings)
//   verify_vote  — a yes/no vote on one of them; the database settles it once enough voters agree (app_settings)
//
// Secrets (npm run secrets:dev):
//   AI_API_KEY, AI_BASE_URL (e.g. https://api.deepinfra.com/v1/openai), AI_MODEL (e.g. google/gemma-4-31B-it)
//   STT_URL (optional, default DeepInfra Whisper large v3 turbo), DAILY_MESSAGE_LIMIT (optional, default 100)
//   VERIFY_OWN_WORK (optional, "true" lets you verify your own work: for testing alone only, never in production)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.

import { createClient } from 'npm:@supabase/supabase-js@2';

const TERMS_VERSION = '2026-11-v1'; // keep in step with src/lib/auth.tsx
const HISTORY_LIMIT = 20; // messages sent to the model as context
const MAX_INPUT = 1000; // characters per user message or correction

const AI_API_KEY = Deno.env.get('AI_API_KEY') ?? '';
const AI_BASE_URL = (Deno.env.get('AI_BASE_URL') ?? 'https://api.deepinfra.com/v1/openai').replace(/\/$/, '');
const AI_MODEL = Deno.env.get('AI_MODEL') ?? 'google/gemma-4-31B-it';
const DAILY_LIMIT = Number(Deno.env.get('DAILY_MESSAGE_LIMIT') ?? '100');
const STT_URL = Deno.env.get('STT_URL') ?? 'https://api.deepinfra.com/v1/inference/openai/whisper-large-v3-turbo';
const MESSAGE_FIELDS = 'id, role, content, flagged, audio_path, created_at';

// Record lines: lines per set, how many of them are hand-checked quality checks, and a daily cap.
// The AI writes the rest. If there aren't enough unread check lines, the AI fills the gap.
const LINES_PER_SET = 10;
const CHECK_LINES_PER_SET = 3;
const AI_LINES_PER_DAY = 140;

// Verify: items per set, votes per day, and the testing switch.
const VERIFY_PER_SET = 10;
const VERIFY_PER_DAY = 150;
const VERIFY_OWN_WORK = Deno.env.get('VERIFY_OWN_WORK') === 'true';
const AUDIO_LINK_SECONDS = 60 * 60;

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
type Mode = 'text' | 'voice';
type ChatTurn = { role: 'system' | 'user' | 'assistant'; content: string };

function systemPrompt(topic: Topic, mode: Mode) {
  return [
    ...(mode === 'voice'
      ? ['This is a spoken conversation: your words will be read aloud, so write the way people speak, with no symbols.']
      : []),
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

async function askModel(turns: ChatTurn[], options: { maxTokens?: number; temperature?: number } = {}): Promise<string> {
  if (!AI_API_KEY) throw new HttpError(500, 'The AI is not set up yet (missing AI_API_KEY).');
  const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${AI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: turns,
      max_tokens: options.maxTokens ?? 160,
      temperature: options.temperature ?? 0.8,
    }),
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

async function transcribe(audio: Blob, fileName: string): Promise<string> {
  const form = new FormData();
  form.append('audio', audio, fileName);
  const response = await fetch(STT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${AI_API_KEY}` },
    body: form,
  });
  if (!response.ok) {
    console.error('Speech-to-text error', response.status, await response.text());
    throw new HttpError(502, 'We could not hear that clearly. Please try again.');
  }
  const data = await response.json();
  return String(data?.text ?? '').trim();
}

/** How much a new correction in this conversation earns: the rate, until the per-chat limit is reached. */
async function correctionAmount(conversationId: string, mode: Mode): Promise<number> {
  const { data: rate } = await admin
    .from('task_rates')
    .select('amount_jmd, max_paid_per_session, active')
    .eq('id', mode === 'voice' ? 'voice' : 'talk')
    .maybeSingle();
  if (!rate?.active) return 0;
  if (rate.max_paid_per_session) {
    const { count } = await admin
      .from('corrections')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .gt('amount_jmd', 0);
    if ((count ?? 0) >= rate.max_paid_per_session) return 0;
  }
  return Number(rate.amount_jmd);
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
    .select('id, topic_id, mode, ended_at')
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

// How many unfinished chats someone can have. Starting one more closes the oldest (earnings are kept).
const MAX_OPEN_CHATS = 5;

/** Tidy up before a new chat: close chats nobody spoke in, and keep at most MAX_OPEN_CHATS open. */
async function tidyOpenChats(userId: string) {
  const { data: open } = await admin
    .from('conversations')
    .select('id, created_at, messages(count)')
    .eq('user_id', userId)
    .is('ended_at', null)
    .eq('messages.role', 'user')
    .order('created_at', { ascending: false })
    .limit(50);
  const rows = (open ?? []) as { id: string; messages: { count: number }[] | null }[];
  const empty = rows.filter((c) => !(c.messages?.[0]?.count ?? 0)).map((c) => c.id);
  const kept = rows.filter((c) => !empty.includes(c.id));
  const tooMany = kept.slice(MAX_OPEN_CHATS - 1).map((c) => c.id); // room for the new one
  const close = [...empty, ...tooMany];
  if (close.length) {
    await admin.from('conversations').update({ ended_at: new Date().toISOString() }).in('id', close);
  }
}

async function start(userId: string, body: { topicId?: string; mode?: Mode }) {
  await checkDailyLimit(userId);
  await tidyOpenChats(userId);
  const mode: Mode = body.mode === 'voice' ? 'voice' : 'text';
  const topic = await loadTopic(body.topicId);
  const { data: conversation, error } = await admin
    .from('conversations')
    .insert({ user_id: userId, topic_id: topic.id, model: AI_MODEL, mode })
    .select('id, topic_id, mode, created_at')
    .single();
  if (error) throw error;

  const opening = await askModel([
    { role: 'system', content: systemPrompt(topic, mode) },
    { role: 'user', content: 'Start the conversation with a warm greeting and one question about the topic.' },
  ]);
  const { data: message, error: saveError } = await admin
    .from('messages')
    .insert({ conversation_id: conversation.id, user_id: userId, role: 'assistant', content: opening })
    .select(MESSAGE_FIELDS)
    .single();
  if (saveError) throw saveError;

  return { conversation: { ...conversation, topic }, messages: [message] };
}

type OwnedConversation = { id: string; topic_id: string | null; mode: Mode; ended_at: string | null };

/** Builds the context from recent messages, asks the model and saves its reply. */
async function replyTo(userId: string, conversation: OwnedConversation) {
  const { data: history } = await admin
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversation.id)
    .order('id', { ascending: false })
    .limit(HISTORY_LIMIT);
  const topic = await loadTopic(conversation.topic_id ?? undefined);
  const turns: ChatTurn[] = [
    { role: 'system', content: systemPrompt(topic, conversation.mode) },
    ...(history ?? []).reverse().map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  const replyText = await askModel(turns);
  const { data: reply, error: replyError } = await admin
    .from('messages')
    .insert({ conversation_id: conversation.id, user_id: userId, role: 'assistant', content: replyText })
    .select(MESSAGE_FIELDS)
    .single();
  if (replyError) throw replyError;
  return reply;
}

async function openConversation(userId: string, conversationId: unknown) {
  const conversation = (await ownConversation(userId, String(conversationId ?? ''))) as OwnedConversation;
  if (conversation.ended_at) throw new HttpError(400, 'This conversation has ended. Start a new one.');
  await checkDailyLimit(userId);
  return conversation;
}

async function send(userId: string, body: { conversationId?: string; text?: string }) {
  const text = cleanText(body.text, 'Your message');
  const conversation = await openConversation(userId, body.conversationId);

  const { data: userMessage, error } = await admin
    .from('messages')
    .insert({ conversation_id: conversation.id, user_id: userId, role: 'user', content: text })
    .select(MESSAGE_FIELDS)
    .single();
  if (error) throw error;

  return { userMessage, reply: await replyTo(userId, conversation) };
}

async function voice(userId: string, body: { conversationId?: string; audioPath?: string }) {
  const conversation = await openConversation(userId, body.conversationId);
  const audioPath = String(body.audioPath ?? '');
  // Recordings must sit in this user's own folder for this conversation.
  if (!audioPath.startsWith(`${userId}/${conversation.id}/`)) throw new HttpError(400, 'That recording is not yours.');

  const { data: audio, error: downloadError } = await admin.storage.from('voice').download(audioPath);
  if (downloadError || !audio) throw new HttpError(400, 'The recording did not upload. Please try again.');
  if (audio.size < 1000) throw new HttpError(422, 'That was too short. Hold the button while you talk.');

  const heard = (await transcribe(audio, audioPath.split('/').pop() ?? 'voice.m4a')).slice(0, 2000);
  if (!heard) throw new HttpError(422, 'We could not hear any words. Try again a little closer to the phone.');

  const { data: userMessage, error } = await admin
    .from('messages')
    .insert({
      conversation_id: conversation.id,
      user_id: userId,
      role: 'user',
      content: heard,
      transcript_raw: heard,
      audio_path: audioPath,
    })
    .select(MESSAGE_FIELDS)
    .single();
  if (error) throw error;

  return { userMessage, reply: await replyTo(userId, conversation) };
}

async function correct(userId: string, body: { messageId?: number; text?: string }) {
  const corrected = cleanText(body.text, 'Your correction');
  const { data: message } = await admin
    .from('messages')
    .select('id, conversation_id, role, content, audio_path, transcript_raw, conversations(mode)')
    .eq('id', Number(body.messageId))
    .eq('user_id', userId)
    .maybeSingle();
  if (!message) throw new HttpError(404, 'That message was not found.');

  // AI replies can be corrected; so can the words speech-to-text heard in the user's own recordings.
  const kind = message.role === 'assistant' ? 'ai_reply' : message.audio_path ? 'transcript' : null;
  if (!kind) throw new HttpError(400, 'You can only correct the AI\'s replies or what we heard you say.');
  const original = kind === 'transcript' ? (message.transcript_raw ?? message.content) : message.content;
  if (corrected === original) throw new HttpError(400, 'Your correction is the same as the original.');

  const joined = message.conversations as { mode: Mode } | { mode: Mode }[] | null;
  const mode = (Array.isArray(joined) ? joined[0]?.mode : joined?.mode) ?? 'text';
  const amount = await correctionAmount(message.conversation_id, mode);

  const { data: correction, error } = await admin
    .from('corrections')
    .insert({
      message_id: message.id,
      conversation_id: message.conversation_id,
      user_id: userId,
      original,
      corrected,
      kind,
      amount_jmd: amount,
    })
    .select('id, message_id, original, corrected, status, kind, amount_jmd, created_at')
    .single();
  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'You already corrected that reply.');
    throw error;
  }
  // A fixed transcript becomes the message text, so the AI sees the right words from now on.
  await admin
    .from('messages')
    .update(kind === 'transcript' ? { flagged: true, content: corrected } : { flagged: true })
    .eq('id', message.id);
  return { correction };
}

async function endConversation(userId: string, body: { conversationId?: string }) {
  if (!body.conversationId) throw new HttpError(400, 'Which conversation?');
  const conversation = await ownConversation(userId, body.conversationId);
  if (!conversation.ended_at) {
    const { error } = await admin.from('conversations').update({ ended_at: new Date().toISOString() }).eq('id', conversation.id);
    if (error) throw error;
  }
  return { ended: true };
}

/* ---------- Record lines ---------- */

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Pulls the lines out of the model's answer, whether it sent JSON or a plain list. */
function parseLines(raw: string): string[] {
  let lines: unknown = null;
  const json = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/)?.[0];
  if (json) {
    try {
      const parsed = JSON.parse(json);
      lines = Array.isArray(parsed) ? parsed : parsed?.lines;
    } catch {
      lines = null;
    }
  }
  const list = Array.isArray(lines) ? lines : raw.split('\n');
  return list
    .map((line) => String(line).replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/^["']|["']$/g, '').trim())
    .filter((line) => {
      const words = line.split(/\s+/).length;
      return words >= 3 && words <= 16 && line.length <= 200;
    });
}

async function writeLines(userId: string, body: { topicId?: string }) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('record_prompts')
    .select('id', { count: 'exact', head: true })
    .eq('created_for', userId)
    .gte('created_at', since);
  if ((count ?? 0) >= AI_LINES_PER_DAY) {
    throw new HttpError(429, 'You have read a lot of lines today. Come back tomorrow for more!');
  }

  const topic = await loadTopic(body.topicId);

  // Hand-checked lines this user has not recorded yet: hidden quality checks.
  const [{ data: curated }, { data: done }] = await Promise.all([
    admin.from('record_prompts').select('id, text').eq('source', 'curated').eq('active', true),
    admin.from('recordings').select('prompt_id').eq('user_id', userId),
  ]);
  const recorded = new Set((done ?? []).map((row) => row.prompt_id));
  const checks = shuffle((curated ?? []).filter((row) => !recorded.has(row.id))).slice(0, CHECK_LINES_PER_SET);
  const wanted = LINES_PER_SET - checks.length;

  // Skip anything this user already has, and repeats within the batch.
  const { data: existing } = await admin
    .from('record_prompts')
    .select('text')
    .or(`source.eq.curated,created_for.eq.${userId}`);
  const seen = new Set((existing ?? []).map((row) => row.text.toLowerCase()));
  const fresh: string[] = [];

  // Models sometimes return fewer lines than asked, so ask again (at most twice) until the set is full.
  for (let attempt = 0; attempt < 3 && fresh.length < wanted; attempt++) {
    const raw = await askModel(
      [
        {
          role: 'system',
          content: [
            'You write short everyday sentences in Jamaican Patois (Patwa) for people to read aloud.',
            'Write the way Jamaicans really talk, using everyday spelling such as mi, yuh, di, dem, nuh, wah, fi, pon, cyaan.',
            'Each sentence: 4 to 14 words, natural, something a person would actually say. Vary the sentences.',
            'No names of real people, no swearing, nothing sexual, violent or hateful.',
            `Reply with JSON only, like {"lines": ["...", "..."]}, with exactly ${wanted + 5} lines.`,
          ].join(' '),
        },
        {
          role: 'user',
          content: `Topic: ${topic.title}. ${topic.guidance}${fresh.length ? ` Do not repeat these: ${fresh.join(' | ')}` : ''}`,
        },
      ],
      { maxTokens: 900, temperature: 0.95 },
    );
    for (const line of parseLines(raw)) {
      const key = line.toLowerCase();
      if (fresh.length < wanted && !seen.has(key)) {
        seen.add(key);
        fresh.push(line);
      }
    }
  }

  let aiPrompts: { id: number; text: string }[] = [];
  if (fresh.length) {
    const { data, error } = await admin
      .from('record_prompts')
      .insert(fresh.map((text) => ({ text, source: 'ai', topic_id: topic.id, created_for: userId })))
      .select('id, text');
    if (error) throw error;
    aiPrompts = data ?? [];
  }

  const prompts = shuffle([...aiPrompts, ...checks]);
  if (!prompts.length) throw new HttpError(502, 'We could not write new lines right now. Please try again.');
  return { topic, prompts };
}

type RecordSet = {
  id: string;
  topic_id: string | null;
  topic_title: string | null;
  prompt_ids: number[];
  skipped: number[];
  fixes?: Record<string, string> | null;
  created_at: string;
};

const RESUME_DAYS = 3;

/** The lines of a set in order, each marked recorded, skipped or still to do. */
async function describeSet(userId: string, set: RecordSet, resumed: boolean) {
  const ids = set.prompt_ids.map(Number);
  const [{ data: prompts }, { data: done }] = await Promise.all([
    admin.from('record_prompts').select('id, text').in('id', ids),
    admin
      .from('recordings')
      .select('prompt_id, spoken_text, amount_jmd, fix_amount_jmd')
      .eq('user_id', userId)
      .in('prompt_id', ids),
  ]);
  const byId = new Map((prompts ?? []).map((p) => [Number(p.id), p.text as string]));
  const recorded = new Map((done ?? []).map((r) => [Number(r.prompt_id), r]));
  const skipped = new Set(set.skipped.map(Number));
  const lines = ids
    .filter((id) => byId.has(id))
    .map((id) => {
      const rec = recorded.get(id);
      return {
        id,
        text: byId.get(id)!,
        done: rec ? ('recorded' as const) : skipped.has(id) ? ('skipped' as const) : null,
        spoken_text: rec?.spoken_text ?? null,
        // A fix typed before leaving, not recorded yet.
        draft_fix: !rec ? (set.fixes?.[String(id)] ?? null) : null,
      };
    });
  const earned = (done ?? []).reduce((sum, r) => sum + Number(r.amount_jmd) + Number(r.fix_amount_jmd ?? 0), 0);
  return {
    set_id: set.id,
    topic: set.topic_title ? { id: set.topic_id, title: set.topic_title } : null,
    prompts: lines,
    resumed,
    earned,
    remaining: lines.filter((l) => !l.done).length,
  };
}

async function recordLines(userId: string, body: { topicId?: string; fresh?: boolean }) {
  const since = new Date(Date.now() - RESUME_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: open } = await admin
    .from('record_sets')
    .select('id, topic_id, topic_title, prompt_ids, skipped, fixes, created_at')
    .eq('user_id', userId)
    .is('finished_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

  // Close sets that are done or too old; resume the newest one that still has lines to read.
  for (const set of (open ?? []) as RecordSet[]) {
    if (!body.fresh && set.created_at >= since) {
      const described = await describeSet(userId, set, true);
      if (described.remaining > 0) return described;
    }
    await admin.from('record_sets').update({ finished_at: new Date().toISOString() }).eq('id', set.id);
  }

  const { topic, prompts } = await writeLines(userId, body);
  const { data: created, error } = await admin
    .from('record_sets')
    .insert({ user_id: userId, topic_id: topic.id, topic_title: topic.title, prompt_ids: prompts.map((p) => p.id) })
    .select('id, topic_id, topic_title, prompt_ids, skipped, fixes, created_at')
    .single();
  if (error) throw error;
  return describeSet(userId, created as RecordSet, false);
}

/* ---------- Verify ---------- */

type VerifyKind = 'correction' | 'recording' | 'description';

type VerifyItem =
  | {
      kind: 'correction';
      id: number;
      type: 'ai_reply' | 'transcript';
      original: string;
      corrected: string;
      context: string | null;
      audio_url: string | null;
      created_at: string;
    }
  | {
      kind: 'recording';
      id: number;
      text: string;
      fixed: boolean;
      original: string | null;
      duration_ms: number;
      audio_url: string | null;
      created_at: string;
    }
  | {
      kind: 'description';
      id: number;
      text: string;
      caption: string;
      media_kind: 'photo' | 'video';
      media_url: string | null;
      created_at: string;
    };

async function mediaLink(path: string) {
  const { data } = await admin.storage.from('media').createSignedUrl(path, AUDIO_LINK_SECONDS);
  return data?.signedUrl ?? null;
}

async function audioLink(path: string | null) {
  if (!path) return null;
  const { data } = await admin.storage.from('voice').createSignedUrl(path, AUDIO_LINK_SECONDS);
  return data?.signedUrl ?? null;
}

async function verifyRate() {
  const { data } = await admin.from('task_rates').select('amount_jmd, active').eq('id', 'verify').maybeSingle();
  return data?.active ? Number(data.amount_jmd) : 0;
}

async function votesToday(userId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('verifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since);
  return count ?? 0;
}

async function verifyQueue(userId: string) {
  const used = await votesToday(userId);
  const room = Math.min(VERIFY_PER_SET, VERIFY_PER_DAY - used);
  if (room <= 0) return { items: [], rate: await verifyRate(), reason: 'limit' };

  const { data: voted } = await admin.from('verifications').select('item_kind, item_id').eq('user_id', userId);
  const done = new Set((voted ?? []).map((v) => `${v.item_kind}:${v.item_id}`));

  let corrections = admin
    .from('corrections')
    .select('id, user_id, message_id, conversation_id, kind, original, corrected, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(60);
  let recordings = admin
    .from('recordings')
    .select('id, user_id, prompt_text, spoken_text, fixed, audio_path, duration_ms, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(60);
  let descriptions = admin
    .from('descriptions')
    .select('id, user_id, text, created_at, posts!inner(caption, kind, media_path, hidden)')
    .eq('status', 'pending')
    .eq('posts.hidden', false)
    .order('created_at', { ascending: true })
    .limit(60);
  if (!VERIFY_OWN_WORK) {
    corrections = corrections.neq('user_id', userId);
    recordings = recordings.neq('user_id', userId);
    descriptions = descriptions.neq('user_id', userId);
  }
  const [{ data: cRows }, { data: rRows }, { data: dRows }] = await Promise.all([corrections, recordings, descriptions]);

  const cFree = (cRows ?? []).filter((c) => !done.has(`correction:${c.id}`));
  const rFree = (rRows ?? []).filter((r) => !done.has(`recording:${r.id}`));
  const dFree = (dRows ?? []).filter((d) => !done.has(`description:${d.id}`));

  // Oldest first so work gets paid sooner, taking turns between kinds for variety.
  type Picked =
    | { kind: 'correction'; row: (typeof cFree)[number] }
    | { kind: 'recording'; row: (typeof rFree)[number] }
    | { kind: 'description'; row: (typeof dFree)[number] };
  const picked: Picked[] = [];
  const pools = [
    () => (rFree.length ? ({ kind: 'recording', row: rFree.shift()! } as Picked) : null),
    () => (cFree.length ? ({ kind: 'correction', row: cFree.shift()! } as Picked) : null),
    () => (dFree.length ? ({ kind: 'description', row: dFree.shift()! } as Picked) : null),
  ];
  let turn = 0;
  while (picked.length < room && (cFree.length || rFree.length || dFree.length)) {
    const next = pools[turn % pools.length]();
    if (next) picked.push(next);
    turn += 1;
  }

  const items: VerifyItem[] = await Promise.all(
    picked.map(async (entry): Promise<VerifyItem> => {
      if (entry.kind === 'description') {
        const d = entry.row;
        const post = (Array.isArray(d.posts) ? d.posts[0] : d.posts) as { caption: string; kind: 'photo' | 'video'; media_path: string };
        return {
          kind: 'description',
          id: d.id,
          text: d.text,
          caption: post?.caption ?? '',
          media_kind: post?.kind ?? 'photo',
          media_url: post ? await mediaLink(post.media_path) : null,
          created_at: d.created_at,
        };
      }
      if (entry.kind === 'recording') {
        const r = entry.row;
        return {
          kind: 'recording',
          id: r.id,
          text: r.spoken_text || r.prompt_text,
          fixed: !!r.fixed,
          original: r.fixed ? r.prompt_text : null,
          duration_ms: r.duration_ms,
          audio_url: await audioLink(r.audio_path),
          created_at: r.created_at,
        };
      }
      const c = entry.row;
      if (c.kind === 'transcript') {
        const { data: message } = await admin.from('messages').select('audio_path').eq('id', c.message_id).maybeSingle();
        return {
          kind: 'correction',
          id: c.id,
          type: 'transcript',
          original: c.original,
          corrected: c.corrected,
          context: null,
          audio_url: await audioLink(message?.audio_path ?? null),
          created_at: c.created_at,
        };
      }
      // For a fixed AI reply, show what the person had said just before it.
      const { data: before } = await admin
        .from('messages')
        .select('content')
        .eq('conversation_id', c.conversation_id)
        .eq('role', 'user')
        .lt('id', c.message_id)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      return {
        kind: 'correction',
        id: c.id,
        type: 'ai_reply',
        original: c.original,
        corrected: c.corrected,
        context: before?.content ?? null,
        audio_url: null,
        created_at: c.created_at,
      };
    }),
  );

  // Audio we can't open can't be checked fairly, so leave it out.
  const playable = items.filter(
    (item) => (item.kind !== 'recording' || item.audio_url) && (item.kind !== 'description' || item.media_url),
  );
  return { items: playable, rate: await verifyRate(), reason: playable.length ? null : 'empty' };
}

async function verifyVote(userId: string, body: { kind?: string; id?: number; verdict?: string }) {
  const kind = body.kind as VerifyKind;
  const id = Number(body.id);
  if (!['correction', 'recording', 'description'].includes(kind) || !Number.isInteger(id)) {
    throw new HttpError(400, 'That item was not found.');
  }
  if (body.verdict !== 'yes' && body.verdict !== 'no') throw new HttpError(400, 'Choose yes or no.');
  if ((await votesToday(userId)) >= VERIFY_PER_DAY) {
    throw new HttpError(429, `You've checked ${VERIFY_PER_DAY} items today. Come back tomorrow!`);
  }

  const table = kind === 'correction' ? 'corrections' : kind === 'recording' ? 'recordings' : 'descriptions';
  const { data: item } = await admin.from(table).select('id, user_id, status').eq('id', id).maybeSingle();
  if (!item) throw new HttpError(404, 'That item was not found.');
  if (item.user_id === userId && !VERIFY_OWN_WORK) throw new HttpError(403, "You can't check your own work.");
  if (item.status !== 'pending') throw new HttpError(409, 'Other speakers already settled this one. On to the next!');

  const amount = await verifyRate();
  const { error } = await admin
    .from('verifications')
    .insert({ user_id: userId, item_kind: kind, item_id: id, verdict: body.verdict, amount_jmd: amount });
  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'You already checked this one.');
    throw error;
  }

  const [{ data: vote }, { data: after }] = await Promise.all([
    admin.from('verifications').select('status, amount_jmd').eq('user_id', userId).eq('item_kind', kind).eq('item_id', id).single(),
    admin.from(table).select('status').eq('id', id).single(),
  ]);
  return { status: vote?.status ?? 'pending', amount_jmd: Number(vote?.amount_jmd ?? amount), item_status: after?.status ?? 'pending' };
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
      case 'voice':
        return json(await voice(user.id, body));
      case 'correct':
        return json(await correct(user.id, body));
      case 'end':
        return json(await endConversation(user.id, body));
      case 'record_lines':
        return json(await recordLines(user.id, body));
      case 'verify_queue':
        return json(await verifyQueue(user.id));
      case 'verify_vote':
        return json(await verifyVote(user.id, body));
      default:
        return json({ error: 'Unknown action.' }, 400);
    }
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error(err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
