/** "Record lines": fresh lines to read (AI-written plus hidden quality checks), and saving each recording. */
import { FunctionsHttpError } from '@supabase/supabase-js';

import { uploadRecording } from '@/lib/audio-upload';
import { supabase } from '@/lib/supabase';

export type Prompt = { id: number; text: string };

export type LineSet = { topic: string | null; prompts: Prompt[] };

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

/** A new set of lines, written for this user by the AI (with a few hand-checked lines mixed in). */
export async function nextPrompts(): Promise<LineSet> {
  const { data, error } = await supabase.functions.invoke<{ topic: { title: string } | null; prompts: Prompt[] }>('chat', {
    body: { action: 'record_lines' },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new Error(payload?.error ?? 'Could not load new lines. Please try again.');
    }
    throw new Error('Could not load new lines. Check your internet and try again.');
  }
  return { topic: data?.topic?.title ?? null, prompts: data?.prompts ?? [] };
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
