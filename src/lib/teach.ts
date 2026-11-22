/** Teach: the Feed (photos and short videos) and the Patois descriptions people write about them. */
import { supabase } from '@/lib/supabase';
import { uploadMedia } from '@/lib/media-upload';

export type FeedFilter = 'all' | 'teach' | 'mine';

export type FeedPost = {
  id: number;
  kind: 'photo' | 'video';
  media_path: string;
  caption: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  created_at: string;
  author: string;
  author_id: string;
  is_mine: boolean;
  like_count: number;
  liked: boolean;
  description_count: number;
  /** Your own description's status, or null if you haven't described it. */
  my_status: 'pending' | 'approved' | 'rejected' | null;
};

export type Description = {
  id: number;
  author: string;
  text: string;
  status: 'pending' | 'approved' | 'rejected';
  is_mine: boolean;
  created_at: string;
};

export const REPORT_REASONS: { id: string; label: string }[] = [
  { id: 'offensive', label: 'Rude or hateful' },
  { id: 'sexual', label: 'Sexual content' },
  { id: 'violence', label: 'Violence' },
  { id: 'private_info', label: "Shows someone's private info" },
  { id: 'spam', label: 'Spam or ads' },
  { id: 'not_jamaican', label: 'Nothing to describe' },
  { id: 'other', label: 'Something else' },
];

/** Limits for new posts. Videos must also fit the bucket's 50 MB limit. */
export const MAX_VIDEO_SECONDS = 30;
export const MAX_CAPTION = 300;
export const MIN_DESCRIPTION_WORDS = 4;
export const MAX_DESCRIPTION = 500;

const PAGE = 10;

export async function loadFeed(filter: FeedFilter, beforeId?: number): Promise<FeedPost[]> {
  const { data, error } = await supabase.rpc('feed_posts', { filter, before_id: beforeId ?? null, page: PAGE });
  if (error) throw new Error('Could not load the feed. Pull down to try again.');
  return (data ?? []) as FeedPost[];
}

export const FEED_PAGE = PAGE;

export async function loadPost(id: number): Promise<FeedPost | null> {
  // The feed function already returns everything a post needs; ask for the one just above it.
  const { data, error } = await supabase.rpc('feed_posts', { filter: 'all', before_id: id + 1, page: 1 });
  if (error) throw new Error('Could not load that post.');
  const post = ((data ?? []) as FeedPost[])[0];
  return post && post.id === id ? post : null;
}

/** Signed links last an hour; keep them so scrolling back doesn't ask again. */
const links = new Map<string, { url: string; until: number }>();

export async function mediaUrl(path: string): Promise<string | null> {
  const cached = links.get(path);
  if (cached && cached.until > Date.now()) return cached.url;
  const { data } = await supabase.storage.from('media').createSignedUrl(path, 60 * 60);
  if (!data?.signedUrl) return null;
  links.set(path, { url: data.signedUrl, until: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}

export async function setLiked(postId: number, userId: string, liked: boolean) {
  const { error } = liked
    ? await supabase.from('post_likes').insert({ post_id: postId, user_id: userId })
    : await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
  if (error && error.code !== '23505') throw new Error('That did not save. Try again.');
}

export async function reportPost(postId: number, userId: string, reason: string) {
  const { error } = await supabase.from('post_reports').insert({ post_id: postId, user_id: userId, reason });
  if (error && error.code !== '23505') throw new Error('Your report did not send. Try again.');
}

export async function deletePost(post: FeedPost) {
  const { error } = await supabase.from('posts').delete().eq('id', post.id);
  if (error) throw new Error('Could not delete the post. Try again.');
  await supabase.storage.from('media').remove([post.media_path]);
}

export async function createPost(
  userId: string,
  media: { uri: string; mimeType: string; kind: 'photo' | 'video'; width?: number; height?: number; durationMs?: number },
  caption: string,
) {
  const path = await uploadMedia(media.uri, media.mimeType, userId);
  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      kind: media.kind,
      media_path: path,
      caption: caption.trim().slice(0, MAX_CAPTION),
      width: media.width ? Math.round(media.width) : null,
      height: media.height ? Math.round(media.height) : null,
      duration_ms: media.durationMs ? Math.round(media.durationMs) : null,
    })
    .select('id')
    .single();
  if (error) {
    await supabase.storage.from('media').remove([path]);
    throw new Error(`Your post was not saved (${error.message}).`);
  }
  return data.id as number;
}

export async function loadDescriptions(postId: number): Promise<Description[]> {
  const { data, error } = await supabase.rpc('post_descriptions', { target: postId });
  if (error) throw new Error('Could not load what people said.');
  return (data ?? []) as Description[];
}

/** Why a description can't be sent yet, or null. */
export function descriptionProblem(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words < MIN_DESCRIPTION_WORDS) return `Say a little more (at least ${MIN_DESCRIPTION_WORDS} words).`;
  if (text.length > MAX_DESCRIPTION) return `Keep it under ${MAX_DESCRIPTION} characters.`;
  return null;
}

export async function addDescription(postId: number, userId: string, text: string) {
  const { data, error } = await supabase
    .from('descriptions')
    .insert({ post_id: postId, user_id: userId, text: text.trim() })
    .select('id, amount_jmd, status')
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('You already described this post.');
    throw new Error(error.message.replace(/^.*?ERROR:\s*/i, ''));
  }
  return { id: data.id as number, amount: Number(data.amount_jmd), status: data.status as Description['status'] };
}

export function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days}d` : new Intl.DateTimeFormat('en-JM', { day: 'numeric', month: 'short' }).format(new Date(iso));
}
