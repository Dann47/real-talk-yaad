import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ContinueChat } from '@/components/continue-chat';
import {
  Appear,
  Avatar,
  Button,
  Card,
  Chip,
  IconTile,
  ListRow,
  ProgressBar,
  Screen,
  SectionHeader,
  T,
} from '@/components/kit';
import { money, tasks, user, wallet } from '@/data/sample';
import { useTheme } from '@/hooks/use-theme';
import { payLabel, useRates } from '@/lib/rates';
import { displayName, useAuth } from '@/lib/auth';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Mawnin';
  if (hour < 17) return 'Good afternoon';
  return 'Evenin';
}

const QUICK = ['talk', 'record', 'verify', 'teach'] as const;
const QUICK_LABEL: Record<(typeof QUICK)[number], string> = {
  talk: 'Talk',
  record: 'Record',
  verify: 'Verify',
  teach: 'Teach',
};

export default function HomeScreen() {
  const theme = useTheme();
  const rates = useRates();
  const { profile, user: account } = useAuth();
  const name = displayName(profile, account);
  const weekProgress = wallet.thisWeek / user.weekGoal;

  return (
    <Screen tabs title="Home">
      <Appear style={styles.top}>
        <View style={styles.flex}>
          <T variant="overline" color="textSecondary">
            {greeting()}
          </T>
          <T variant="title">{name}</T>
        </View>
        <Chip tone="reward" icon="flame" label={`${user.streakDays}-day streak`} />
        <Pressable accessibilityRole="button" accessibilityLabel="Your profile" onPress={() => router.push('/profile' as Href)}>
          <Avatar letter={name[0]?.toUpperCase() ?? 'R'} />
        </Pressable>
      </Appear>

      <Appear index={1}>
        <Card tone="hero" style={styles.hero}>
          <T variant="overline" style={{ color: theme.onAccent, opacity: 0.85 }}>
            Available balance
          </T>
          <T variant="display" style={{ color: theme.onAccent }}>
            {money(wallet.balance)}
          </T>
          <T variant="small" style={{ color: theme.onAccent }}>
            {money(wallet.pending, 0)} waiting for review
          </T>
          <View style={styles.goal}>
            <View style={styles.goalLabels}>
              <T variant="caption" style={{ color: theme.onAccent }}>
                This week {money(wallet.thisWeek, 0)}
              </T>
              <T variant="caption" style={{ color: theme.onAccent }}>
                Goal {money(user.weekGoal, 0)}
              </T>
            </View>
            <ProgressBar value={weekProgress} label="Weekly earning goal" color={theme.reward} />
          </View>
          <View style={styles.heroButtons}>
            <Button label="Cash out" icon="cashout" variant="reward" compact href={'/wallet' as Href} style={styles.flex} />
            <Button label="Store" icon="bag" variant="onAccent" compact href={'/store' as Href} style={styles.flex} />
          </View>
        </Card>
      </Appear>

      <Appear index={2} style={styles.quickRow}>
        {QUICK.map((id) => {
          const task = tasks.find((t) => t.id === id)!;
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={payLabel(rates[task.id]) ? `${task.title}, ${payLabel(rates[task.id])}` : task.title}
              onPress={() => router.push(task.href)}
              style={({ pressed }) => [
                styles.quick,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.backgroundSelected,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}>
              <IconTile icon={task.icon} tone={task.tone} size={40} />
              <T variant="smallStrong">{QUICK_LABEL[id]}</T>
            </Pressable>
          );
        })}
      </Appear>

      <Appear index={3}>
        <Card style={styles.level}>
          <IconTile icon="sparkles" tone="reward" />
          <View style={styles.flex}>
            <View style={styles.levelTop}>
              <T variant="smallStrong">
                Level {user.level} · {user.levelName}
              </T>
              <T variant="caption" color="textSecondary">
                {user.tasksToNextLevel} to go
              </T>
            </View>
            <ProgressBar value={user.levelProgress} label="Progress to next level" />
          </View>
        </Card>
      </Appear>

      <ContinueChat />

      <Appear index={4}>
        <SectionHeader title="Today's work" action="See all" href={'/work' as Href} />
      </Appear>
      {tasks
        .filter((task) => task.id !== 'voice')
        .slice(0, 3)
        .map((task, i) => (
          <Appear key={task.id} index={5 + i}>
            <ListRow icon={task.icon} tone={task.tone} title={task.title} subtitle={task.detail} value={payLabel(rates[task.id])} href={task.href} />
          </Appear>
        ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hero: { gap: 4, padding: 22 },
  goal: { gap: 8, marginTop: 14 },
  goalLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  heroButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  quickRow: { flexDirection: 'row', gap: 10 },
  quick: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: 20, borderWidth: 1 },
  level: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  levelTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
});
