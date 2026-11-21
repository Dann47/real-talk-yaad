import { useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';

import { ListRow } from '@/components/kit';
import { latestConversation, type ChatSummary } from '@/lib/chat';

function ago(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** "Pick up where you left off" card. Refreshes each time the screen comes into view. */
export function ContinueChat() {
  const [chat, setChat] = useState<ChatSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      latestConversation()
        .then((result) => {
          if (active) setChat(result);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, []),
  );

  if (!chat) return null;
  return (
    <ListRow
      icon="chat"
      title="Continue your chat"
      subtitle={`${chat.topicTitle} · ${chat.messageCount} messages · ${ago(chat.startedAt)}`}
      href={`/talk?conversation=${chat.id}` as Href}
    />
  );
}
