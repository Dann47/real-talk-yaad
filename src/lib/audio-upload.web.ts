// Uploads a finished recording to the private `voice` bucket (web: the recording is a blob URL).
import { supabase } from '@/lib/supabase';

/** Uploads to `<folder>/<timestamp>.<ext>`; the folder must start with the user's id. */
export async function uploadRecording(uri: string, folder: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  const contentType = blob.type.split(';')[0] || 'audio/webm';
  const extension = contentType.includes('mp4') ? 'm4a' : contentType.includes('ogg') ? 'ogg' : 'webm';
  const path = `${folder}/${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from('voice').upload(path, blob, { contentType, upsert: false });
  if (error) throw new Error(`Your recording did not upload (${error.message}). Check your internet and try again.`);
  return path;
}
