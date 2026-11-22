/** "Keep going": after finishing one task, the two best next ones (with their pay). */
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Appear, IconTile, T } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';
import { money } from '@/lib/format';
import { useRates } from '@/lib/rates';
import { tasks } from '@/lib/tasks';

/** What to suggest after each task: the ones that pair best with it come first. */
const AFTER: Record<string, string[]> = {
  talk: ['voice', 'verify', 'record'],
  voice: ['record', 'talk', 'verify'],
  record: ['verify', 'teach', 'talk'],
  verify: ['record', 'teach', 'talk'],
  teach: ['verify', 'record', 'talk'],
};

export function NextUp({ after, index = 0 }: { after: string; index?: number }) {
  const theme = useTheme();
  const rates = useRates();
  const picks = (AFTER[after] ?? ['talk', 'record', 'verify'])
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is (typeof tasks)[number] => !!t)
    .slice(0, 2);

  return (
    <Appear index={index} style={styles.block}>
      <T variant="heading">Keep going</T>
      <View style={styles.row}>
        {picks.map((task) => {
          const rate = rates[task.id];
          return (
            <Pressable
              key={task.id}
              accessibilityRole="button"
              accessibilityLabel={`${task.title}${rate ? `, ${money(rate.amount_jmd, 0)} per ${rate.unit}` : ''}`}
              onPress={() => router.replace(task.href)}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}>
              <IconTile icon={task.icon} tone={task.tone} size={38} />
              <T variant="smallStrong" numberOfLines={2}>
                {task.title}
              </T>
              {rate ? (
                <T variant="caption" color="rewardText">
                  {money(rate.amount_jmd, 0)} / {rate.unit}
                </T>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Appear>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, gap: 6, padding: 12, borderRadius: 18, borderWidth: 1 },
});
