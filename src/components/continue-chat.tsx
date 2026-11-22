/**
 * "Pick up where you left off": every unfinished piece of work in one list (typed chats, voice chats
 * and the record set you didn't finish), newest first. Shows 3, with "Show more" for the rest.
 * Each chat can be ended from here with the ×. Refreshes every time the screen comes into view.
 */
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Appear, Icon, IconTile, SectionHeader, T, type IconName } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';
import { endConversation, openConversations, type ChatSummary } from '@/lib/chat';
import { openRecordSet, type OpenSet } from '@/lib/recordings';

const SHOWN = 3;

function ago(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

type Item =
  | { kind: 'chat'; key: string; chat: ChatSummary }
  | { kind: 'record'; key: string; set: OpenSet };

function Row({ item, onEnd }: { item: Item; onEnd?: () => Promise<void> }) {
  const theme = useTheme();
  const [confirming, setConfirming] = useState(false);
  const [ending, setEnding] = useState(false);

  const voice = item.kind === 'chat' && item.chat.mode === 'voice';
  const icon: IconName = item.kind === 'record' ? 'waveform' : voice ? 'mic' : 'chat';
  const title =
    item.kind === 'record' ? 'Record lines' : voice ? `Voice chat · ${item.chat.topicTitle}` : `Chat · ${item.chat.topicTitle}`;
  const subtitle =
    item.kind === 'record'
      ? `${item.set.left} of ${item.set.total} lines left${item.set.topic ? ` · ${item.set.topic}` : ''}`
      : `${item.chat.messageCount} messages · ${ago(item.chat.startedAt)}`;
  const href = (item.kind === 'record' ? '/record' : `/${voice ? 'voice' : 'talk'}?conversation=${item.chat.id}`) as Href;

  if (confirming && onEnd) {
    return (
      <View style={[styles.row, { backgroundColor: theme.backgroundElement, borderColor: theme.danger }]}>
        <Icon name="stop" size={16} color={theme.danger} />
        <T variant="smallStrong" style={styles.flex} numberOfLines={2}>
          End {voice ? 'this voice chat' : 'this chat'}? Your fixes stay saved.
        </T>
        <Pressable accessibilityRole="button" onPress={() => setConfirming(false)} hitSlop={6} style={styles.textButton}>
          <T variant="smallStrong" color="textSecondary">
            Keep
          </T>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={ending}
          onPress={async () => {
            setEnding(true);
            await onEnd();
            setEnding(false);
          }}
          hitSlop={6}
          style={[styles.endButton, { backgroundColor: theme.danger }]}>
          <T variant="smallStrong" style={{ color: theme.background }}>
            {ending ? 'Ending...' : 'End'}
          </T>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Continue: ${title}. ${subtitle}`}
      onPress={() => router.push(href)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}>
      <IconTile icon={icon} tone={item.kind === 'record' ? 'reward' : 'accent'} size={36} />
      <View style={styles.flex}>
        <T variant="bodyStrong" numberOfLines={1}>
          {title}
        </T>
        <T variant="caption" color="textSecondary" numberOfLines={1}>
          {subtitle}
        </T>
      </View>
      {onEnd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`End ${title}`}
          onPress={() => setConfirming(true)}
          hitSlop={8}
          style={styles.close}>
          <Icon name="close" size={15} color={theme.textSecondary} />
        </Pressable>
      ) : (
        <Icon name="chevron" size={16} color={theme.textSecondary} />
      )}
    </Pressable>
  );
}

export function ContinueWork() {
  const theme = useTheme();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [recordSet, setRecordSet] = useState<OpenSet | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(() => {
    let active = true;
    Promise.all([openConversations().catch(() => []), openRecordSet().catch(() => null)]).then(([list, set]) => {
      if (!active) return;
      setChats(list);
      setRecordSet(set);
    });
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(load);

  const items: Item[] = [
    ...(recordSet ? [{ kind: 'record' as const, key: 'record', set: recordSet }] : []),
    ...chats.map((chat) => ({ kind: 'chat' as const, key: chat.id, chat })),
  ];
  if (!items.length) return null;
  const visible = expanded ? items : items.slice(0, SHOWN);
  const hidden = items.length - visible.length;

  return (
    <View style={styles.block}>
      <Appear>
        <SectionHeader title="Pick up where you left off" />
      </Appear>
      {visible.map((item, i) => (
        <Appear key={item.key} index={i + 1}>
          <Row
            item={item}
            onEnd={
              item.kind === 'chat'
                ? async () => {
                    try {
                      await endConversation(item.chat.id);
                      setChats((prev) => prev.filter((c) => c.id !== item.chat.id));
                    } catch {
                      // Leave it in the list; they can try again.
                    }
                  }
                : undefined
            }
          />
        </Appear>
      ))}
      {hidden > 0 || (expanded && items.length > SHOWN) ? (
        <Pressable accessibilityRole="button" onPress={() => setExpanded(!expanded)} hitSlop={6} style={styles.more}>
          <T variant="smallStrong" color="accentText">
            {expanded ? 'Show less' : `Show ${hidden} more`}
          </T>
          <Icon name={expanded ? 'chevronUp' : 'chevron'} size={14} color={theme.accentText} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Older name, kept so existing screens keep working. */
export const ContinueChat = ContinueWork;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 10, paddingRight: 6, borderRadius: 16, borderWidth: 1 },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  textButton: { paddingHorizontal: 8, paddingVertical: 6 },
  endButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4 },
});
