/** Verify: check other people's work. The server picks the items and the database settles the votes. */
import { call } from '@/lib/chat';

export type VerifyItem =
  | {
      kind: 'correction';
      id: number;
      /** ai_reply: someone fixed the AI's Patois. transcript: someone fixed what speech-to-text heard. */
      type: 'ai_reply' | 'transcript';
      original: string;
      corrected: string;
      /** What the person had said before the AI reply they fixed. */
      context: string | null;
      audio_url: string | null;
      created_at: string;
    }
  | {
      kind: 'recording';
      id: number;
      /** The words they read (their fix, if they fixed the line). */
      text: string;
      fixed: boolean;
      /** The AI's line before their fix. */
      original: string | null;
      duration_ms: number;
      audio_url: string | null;
      created_at: string;
    }
  | {
      kind: 'description';
      id: number;
      /** What they said is happening in the post. */
      text: string;
      caption: string;
      media_kind: 'photo' | 'video';
      media_url: string | null;
      created_at: string;
    };

export type VerifyQueue = {
  items: VerifyItem[];
  rate: number;
  /** Why the queue is empty: nothing to check right now, or today's limit is reached. */
  reason: 'empty' | 'limit' | null;
};

export type VoteResult = {
  /** pending until enough people vote; then approved (you matched the group) or rejected. */
  status: 'pending' | 'approved' | 'rejected';
  amount_jmd: number;
  item_status: 'pending' | 'approved' | 'rejected';
};

export const verifyKey = (item: VerifyItem) => `${item.kind}:${item.id}`;

export function loadVerifyQueue() {
  return call<VerifyQueue>({ action: 'verify_queue' });
}

export function castVote(item: VerifyItem, verdict: 'yes' | 'no') {
  return call<VoteResult>({ action: 'verify_vote', kind: item.kind, id: item.id, verdict });
}
