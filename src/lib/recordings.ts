/** "Record lines": fresh lines to read (AI-written plus hidden quality checks), and saving each recording. */
import { FunctionsHttpError } from '@supabase/supabase-js';

import { uploadRecording } from '@/lib/audio-upload';
import { supabase } from '@/lib/supabase';

export type Prompt = { id: number; text: string };

/** A line in a set, and whether it was already recorded or skipped (when resuming). */
export type SetLine = Prompt & {
  done: 'recorded' | 'skipped' | null;
  spoken_text: string | null;
  /** A fix you typed before leaving, not recorded yet. */
  draft_fix?: string | null;
};

export type LineSet = {
  setId: string;
  topic: string | null;
  prompts: SetLine[];
  /** True when this is the set you left unfinished last time. */
  resumed: boolean;
  /** Already earned on this set before (pending review). */
  earned: number;
};

export type SavedRecording = {
  id: number;
  prompt_id: number;
  amount_jmd: number;
  fix_amount_jmd: number;
  fixed: boolean;
  status: string;
};

/** Must match the checks in the prepare_recording trigger (migration 20261121050000). */
const MAX_FIX_LENGTH = 300;
const MIN_WORDS_KEPT = 0.6;

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);

type SetResponse = {
  set_id: string;
  topic: { title: string } | null;
  prompts: SetLine[];
  resumed: boolean;
  earned: number;
};

/**
 * The set you left unfinished (so you pick up where you left off), or a new one with `fresh`.
 * New sets are written for this user by the AI, with a few hand-checked lines mixed in.
 */
export async function nextPrompts(fresh = false): Promise<LineSet> {
  const { data, error } = await supabase.functions.invoke<SetResponse>('chat', {
    body: { action: 'record_lines', fresh },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new Error(payload?.error ?? 'Could not load new lines. Please try again.');
    }
    throw new Error('Could not load new lines. Check your internet and try again.');
  }
  if (!data) throw new Error('Could not load new lines. Please try again.');
  return {
    setId: data.set_id,
    topic: data.topic?.title ?? null,
    prompts: data.prompts ?? [],
    resumed: !!data.resumed,
    earned: Number(data.earned ?? 0),
  };
}

/** Remembers skipped lines so they don't come back when you resume. Best effort: a failure doesn't stop you. */
export async function markSkipped(setId: string, skipped: number[]) {
  await supabase.from('record_sets').update({ skipped }).eq('id', setId);
}

/** Remembers fixes you typed but haven't recorded, so resuming keeps them. Best effort. */
export async function saveDraftFixes(setId: string, fixes: Record<number, string>) {
  await supabase.from('record_sets').update({ fixes }).eq('id', setId);
}

/** Marks the set done, so the next visit starts a new one. */
export async function finishSet(setId: string) {
  await supabase.from('record_sets').update({ finished_at: new Date().toISOString() }).eq('id', setId);
}

/** Why a fix can't be used, or null when it's fine. Same rules the database enforces. */
export function fixProblem(original: string, fix: string): string | null {
  const text = fix.trim().replace(/\s+/g, ' ');
  if (!text) return 'Type the line the way you would say it.';
  if (text.toLowerCase() === original.trim().toLowerCase()) return 'That is the same as the AI line. Change it, or tap "Sounds right".';
  if (text.length > MAX_FIX_LENGTH) return `Keep it under ${MAX_FIX_LENGTH} characters.`;
  if (words(text).length < Math.ceil(words(original).length * MIN_WORDS_KEPT)) {
    return 'Your fix changes the line too much. Keep the same meaning and length.';
  }
  return null;
}

/** Uploads the audio, then records it. Pay and checks are set by the database. */
export async function saveRecording(userId: string, prompt: Prompt, spokenText: string, uri: string, durationMs: number) {
  const path = await uploadRecording(uri, `${userId}/record`);
  const { data, error } = await supabase
    .from('recordings')
    .insert({
      prompt_id: prompt.id,
      audio_path: path,
      duration_ms: Math.round(durationMs),
      spoken_text: spokenText.trim().replace(/\s+/g, ' '),
    })
    .select('id, prompt_id, amount_jmd, fix_amount_jmd, fixed, status')
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('You already recorded this line.');
    if (/changes the line too much/i.test(error.message)) throw new Error(error.message);
    throw new Error(`Your recording was not saved (${error.message}).`);
  }
  return {
    ...data,
    amount_jmd: Number(data.amount_jmd),
    fix_amount_jmd: Number(data.fix_amount_jmd ?? 0),
  } as SavedRecording;
}

export type OpenSet = { left: number; total: number; topic: string | null };

/** The unfinished set you can pick back up (same rule as the server: less than 3 days old), if any. */
export async function openRecordSet(): Promise<OpenSet | null> {
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('record_sets')
    .select('id, topic_title, prompt_ids, skipped')
    .is('finished_at', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const ids = (data.prompt_ids as number[]).map(Number);
  const { count } = await supabase.from('recordings').select('id', { count: 'exact', head: true }).in('prompt_id', ids);
  const left = ids.length - (count ?? 0) - (data.skipped as number[]).length;
  return left > 0 ? { left, total: ids.length, topic: data.topic_title } : null;
}
