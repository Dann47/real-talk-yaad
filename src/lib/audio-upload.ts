// Uploads a finished recording to the private `voice` bucket (phones).
import { File } from 'expo-file-system';

import { supabase } from '@/lib/supabase';

/** Uploads to `<folder>/<timestamp>.<ext>`; the folder must start with the user's id. */
export async function uploadRecording(uri: string, folder: string): Promise<string> {
  const extension = (uri.split('.').pop() ?? 'm4a').toLowerCase().replace(/[^a-z0-9]/g, '') || 'm4a';
  const contentType = extension === '3gp' ? 'audio/3gpp' : extension === 'webm' ? 'audio/webm' : 'audio/m4a';
  const path = `${folder}/${Date.now()}.${extension}`;
  const bytes = await new File(uri).arrayBuffer();
  const { error } = await supabase.storage.from('voice').upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`Your recording did not upload (${error.message}). Check your internet and try again.`);
  return path;
}
