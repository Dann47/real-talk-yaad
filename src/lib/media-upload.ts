// Uploads a photo or video for the Feed to the private `media` bucket (phones).
import { File } from 'expo-file-system';

import { supabase } from '@/lib/supabase';

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

/** Uploads to `<user id>/<timestamp>.<ext>` and returns the path. */
export async function uploadMedia(uri: string, mimeType: string, userId: string): Promise<string> {
  const contentType = EXT[mimeType] ? mimeType : mimeType.startsWith('video') ? 'video/mp4' : 'image/jpeg';
  const path = `${userId}/${Date.now()}.${EXT[contentType]}`;
  const bytes = await new File(uri).arrayBuffer();
  const { error } = await supabase.storage.from('media').upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`Your post did not upload (${error.message}). Check your internet and try again.`);
  return path;
}
