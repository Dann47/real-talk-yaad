import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Appear, Button, Icon, Notice, T } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';
import { listTopics, type Topic } from '@/lib/chat';

/** Grid of conversation topics from the database, plus "Surprise me". */
export function TopicPicker({ onPick }: { onPick: (topicId?: string) => void }) {
  const theme = useTheme();
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    listTopics()
      .then(setTopics)
      .catch((e: Error) => setError(e.message));
  };

  useEffect(load, []);

  return (
    <View style={styles.wrap}>
      <Appear>
        <T variant="overline" color="accentText">
          New chat
        </T>
        <T variant="title">What yuh wah chat bout?</T>
        <T variant="body" color="textSecondary">
          Pick a topic. The AI will talk Patois with you, and you fix anything that doesn't sound right.
        </T>
      </Appear>

      <Appear index={1}>
        <Button label="Surprise me" icon="sparkles" onPress={() => onPick()} />
      </Appear>

      {error ? (
        <View style={styles.wrap}>
          <Notice tone="error" text={error} />
          <Button label="Try again" variant="secondary" compact style={styles.start} onPress={load} />
        </View>
      ) : null}

      {!topics && !error ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.accentText} />
          <T variant="small" color="textSecondary">
            Loading topics...
          </T>
        </View>
      ) : null}

      <View style={styles.grid}>
        {topics?.map((topic, i) => (
          <Appear key={topic.id} index={2 + i} style={styles.cell}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${topic.title}. ${topic.guidance}`}
              onPress={() => onPick(topic.id)}
              style={({ pressed }) => [
                styles.topic,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.backgroundSelected,
                  boxShadow: `0 1px 2px ${theme.shadow}, 0 6px 16px ${theme.shadow}`,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}>
              <View style={[styles.topicIcon, { backgroundColor: theme.accentSoft }]}>
                <Icon name="chat" size={18} color={theme.accentText} />
              </View>
              <T variant="smallStrong">{topic.title}</T>
              <T variant="caption" color="textSecondary" numberOfLines={2}>
                {topic.guidance}
              </T>
            </Pressable>
          </Appear>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  start: { alignSelf: 'flex-start' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { width: '47.5%', flexGrow: 1 },
  topic: { borderWidth: 1, borderRadius: 20, padding: 14, gap: 6, minHeight: 128 },
  topicIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
});
