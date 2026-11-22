// Uploads a photo or video for the Feed to the private `media` bucket (web: the file is a blob URL).
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
  const blob = await (await fetch(uri)).blob();
  const type = mimeType || blob.type;
  const contentType = EXT[type] ? type : type.startsWith('video') ? 'video/mp4' : 'image/jpeg';
  const path = `${userId}/${Date.now()}.${EXT[contentType]}`;
  const { error } = await supabase.storage.from('media').upload(path, blob, { contentType, upsert: false });
  if (error) throw new Error(`Your post did not upload (${error.message}). Check your internet and try again.`);
  return path;
}
