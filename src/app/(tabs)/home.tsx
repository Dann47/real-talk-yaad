import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ContinueWork } from '@/components/continue-chat';
import {
  Appear,
  Avatar,
  Button,
  Card,
  Chip,
  Icon,
  IconTile,
  Notice,
  ProgressBar,
  Screen,
  SectionHeader,
  T,
} from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';
import { displayName, useAuth } from '@/lib/auth';
import { levelFor, useHomeSummary } from '@/lib/earnings';
import { useMyLook } from '@/lib/cosmetics';
import { money } from '@/lib/format';
import { HIDDEN, useHideAmounts } from '@/lib/hide-amounts';
import { payLabel, useRates } from '@/lib/rates';
import { tasks } from '@/lib/tasks';

/** Shown while the numbers load. */
const DASH = '—';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Mawnin';
  if (hour < 17) return 'Good afternoon';
  return 'Evenin';
}

const QUICK = ['talk', 'voice', 'record', 'verify'] as const;
const QUICK_LABEL: Record<(typeof QUICK)[number], string> = {
  talk: 'Talk',
  voice: 'Voice',
  record: 'Record',
  verify: 'Verify',
};

export default function HomeScreen() {
  const theme = useTheme();
  const rates = useRates();
  const { profile, user: account } = useAuth();
  const name = displayName(profile, account);
  const { summary, error, refreshing, refresh } = useHomeSummary();
  const [hidden, toggleHidden] = useHideAmounts();
  const look = useMyLook();
  /** An amount, or dots when the person has hidden their balance. */
  const show = (amount: number | undefined, decimals = 0) => (amount === undefined ? DASH : hidden ? HIDDEN : money(amount, decimals));
  const level = levelFor(summary?.approvedCount ?? 0);
  const weekProgress = summary ? summary.thisWeek / summary.weekGoal : 0;
  const streak = summary?.streakDays ?? 0;

  return (
    <Screen tabs title="Home" onRefresh={refresh} refreshing={refreshing && !!summary}>
      <Appear style={styles.top}>
        <View style={styles.flex}>
          <T variant="overline" color="textSecondary">
            {greeting()}
          </T>
          <T variant="title" numberOfLines={1}>
            {name}
          </T>
          {summary ? (
            <T variant="caption" color="textSecondary">
              Level {level.level} · {level.name}
            </T>
          ) : null}
        </View>
        {summary ? (
          <Chip tone={streak ? 'reward' : 'soft'} icon="flame" label={streak ? `${streak}-day streak` : 'Start a streak'} />
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Your profile" onPress={() => router.push('/profile' as Href)}>
          <Avatar letter={name[0]?.toUpperCase() ?? 'R'} frame={look.frame?.colors} />
        </Pressable>
      </Appear>

      {error ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${error} Tap to try again.`} onPress={refresh}>
          <Notice tone="error" text={`${error} Tap to try again.`} />
        </Pressable>
      ) : null}

      <Appear index={1}>
        <Card tone="hero" style={styles.hero}>
          <View style={styles.heroTop}>
            <T variant="overline" style={[styles.flex, { color: theme.onAccent, opacity: 0.85 }]}>
              Available balance
            </T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'}
              onPress={toggleHidden}
              hitSlop={10}
              style={styles.eye}>
              <Icon name={hidden ? 'eye' : 'eyeOff'} size={16} color={theme.onAccent} />
            </Pressable>
          </View>
          <View style={styles.balanceRow}>
            <T variant="display" style={{ color: theme.onAccent }} accessibilityLabel={hidden ? 'Balance hidden' : undefined}>
              {show(summary?.balance, 2)}
            </T>
            {summary && summary.today > 0 && !hidden ? (
              <Chip tone="reward" icon="trend" label={`+${money(summary.today, 0)} today`} />
            ) : null}
          </View>
          <T variant="small" style={{ color: theme.onAccent }}>
            {!summary
              ? 'Loading your earnings...'
              : hidden
                ? 'Amounts hidden · tap the eye to show them'
                : summary.pending > 0
                ? `${money(summary.pending, 0)} waiting for other speakers to check`
                : summary.totalCount
                  ? 'Nothing waiting for review'
                  : 'Do your first task to start earning'}
          </T>
          <View style={styles.goal}>
            <View style={styles.goalLabels}>
              <T variant="caption" style={{ color: theme.onAccent }}>
                This week {show(summary?.thisWeek)}
              </T>
              <T variant="caption" style={{ color: theme.onAccent }}>
                Goal {show(summary?.weekGoal)}
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

      <Appear index={2}>
        <SectionHeader title="Start earning" action="All work" href={'/work' as Href} />
      </Appear>
      <Appear index={3} style={styles.quickRow}>
        {QUICK.map((id) => {
          const task = tasks.find((t) => t.id === id)!;
          const rate = rates[task.id];
          const today = summary?.todayByTask[id] ?? 0;
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
              <View>
                <IconTile icon={task.icon} tone={task.tone} size={40} />
                {today ? (
                  <View style={[styles.badge, { backgroundColor: theme.reward, borderColor: theme.backgroundElement }]}>
                    <T variant="caption" style={{ color: theme.onReward, fontSize: 10, lineHeight: 13 }}>
                      {today}
                    </T>
                  </View>
                ) : null}
              </View>
              <T variant="smallStrong">{QUICK_LABEL[id]}</T>
              <T variant="caption" color="rewardText" numberOfLines={1}>
                {rate ? `${money(rate.amount_jmd, 0)}/${rate.unit}` : ' '}
              </T>
            </Pressable>
          );
        })}
      </Appear>

      <ContinueWork />

    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hero: { gap: 4, padding: 22 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eye: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  goal: { gap: 8, marginTop: 14 },
  goalLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  heroButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  quickRow: { flexDirection: 'row', gap: 10 },
  quick: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 14, paddingHorizontal: 4, borderRadius: 20, borderWidth: 1 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
