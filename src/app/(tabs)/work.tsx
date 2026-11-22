import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ContinueWork } from '@/components/continue-chat';
import { Appear, Card, Icon, IconTile, Notice, ProgressBar, Screen, SectionHeader, T, type IconName } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';
import { useHomeSummary } from '@/lib/earnings';
import { money } from '@/lib/format';
import { payLabel, useRates } from '@/lib/rates';
import { tasks, type Task } from '@/lib/tasks';

const DASH = '—';

const HOW: { icon: IconName; title: string; detail: string }[] = [
  { icon: 'bolt', title: 'Do the work', detail: 'Chat, record or check' },
  { icon: 'check', title: 'Others check it', detail: 'Two speakers agree' },
  { icon: 'wallet', title: 'You get paid', detail: 'Lands in your wallet' },
];

/** "3 done today" for a task. Talk counts typed chat only; Voice has its own count. */
function todayLabel(task: Task, byTask: Record<string, number> | undefined) {
  const n = byTask?.[task.id] ?? 0;
  if (!n) return null;
  const noun = task.id === 'record' ? 'line' : task.id === 'verify' ? 'check' : 'fix';
  return `${n} ${noun}${n === 1 ? '' : noun === 'fix' ? 'es' : 's'} today`;
}

function TaskCard({ task, pay, unit, today, index }: { task: Task; pay: string | null; unit: string | null; today: string | null; index: number }) {
  const theme = useTheme();
  const soon = task.tag === 'Coming soon';
  const edge = task.tone === 'reward' ? theme.reward : theme.accent;
  return (
    <Appear index={index}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[task.title, task.description, pay].filter(Boolean).join('. ')}
        onPress={() => router.push(task.href)}
        style={({ pressed }) => [
          styles.task,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.backgroundSelected,
            borderLeftColor: edge,
            opacity: soon ? 0.75 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}>
        <View style={styles.taskTop}>
          <IconTile icon={task.icon} tone={task.tone} size={46} />
          <View style={styles.flex}>
            <View style={styles.titleRow}>
              <T variant="heading" style={styles.shrink}>
                {task.title}
              </T>
              {task.tag ? (
                <View style={[styles.tag, { backgroundColor: soon ? theme.backgroundSelected : theme.accentSoft }]}>
                  <T variant="caption" color={soon ? 'textSecondary' : 'accentText'}>
                    {task.tag}
                  </T>
                </View>
              ) : null}
            </View>
            <T variant="small" color="textSecondary">
              {task.description}
            </T>
          </View>
        </View>
        <View style={[styles.taskBottom, { borderTopColor: theme.backgroundSelected }]}>
          {pay ? (
            <View style={[styles.pay, { backgroundColor: theme.reward }]}>
              <T variant="smallStrong" style={{ color: theme.onReward }}>
                {pay}
              </T>
            </View>
          ) : null}
          <T variant="caption" color="textSecondary" style={styles.flex} numberOfLines={1}>
            {unit ?? task.detail}
          </T>
          {today ? (
            <View style={styles.today}>
              <Icon name="check" size={13} color={theme.accentText} />
              <T variant="caption" color="accentText">
                {today}
              </T>
            </View>
          ) : (
            <Icon name="chevron" size={16} color={theme.textSecondary} />
          )}
        </View>
      </Pressable>
    </Appear>
  );
}

export default function WorkScreen() {
  const theme = useTheme();
  const rates = useRates();
  const { summary, error, refreshing, refresh } = useHomeSummary();
  const goal = summary ? Math.min(1, summary.thisWeek / summary.weekGoal) : 0;
  const toGo = summary ? Math.max(0, summary.weekGoal - summary.thisWeek) : 0;

  return (
    <Screen tabs title="Work" onRefresh={refresh} refreshing={refreshing && !!summary}>
      <Appear>
        <T variant="overline" color="accentText">
          Earn by teaching
        </T>
        <T variant="title">Pick your work</T>
      </Appear>

      {error ? (
        <Pressable accessibilityRole="button" onPress={refresh}>
          <Notice tone="error" text={`${error} Tap to try again.`} />
        </Pressable>
      ) : null}

      {/* Today and the weekly goal */}
      <Appear index={1}>
        <Card tone="reward" style={styles.summary}>
          <View style={styles.summaryStats}>
            {[
              { label: 'Today', value: summary ? money(summary.today, 0) : DASH },
              { label: 'This week', value: summary ? money(summary.thisWeek, 0) : DASH },
              { label: 'In review', value: summary ? money(summary.pending, 0) : DASH },
            ].map((stat, i) => (
              <View key={stat.label} style={[styles.summaryStat, i === 0 ? styles.firstStat : [styles.summaryDivider, { borderLeftColor: theme.reward }]]}>
                <T variant="heading">{stat.value}</T>
                <T variant="caption" color="rewardText">
                  {stat.label}
                </T>
              </View>
            ))}
          </View>
          <ProgressBar value={goal} label="Weekly goal" color={theme.reward} />
          <T variant="caption" color="rewardText">
            {!summary
              ? 'Loading...'
              : toGo > 0
                ? `${money(toGo, 0)} to go to your ${money(summary.weekGoal, 0)} weekly goal`
                : 'Weekly goal reached. Big up!'}
          </T>
        </Card>
      </Appear>

      {/* Unfinished work: chats and the record set you left */}
      <ContinueWork />

      <Appear index={4}>
        <SectionHeader title="All work" />
      </Appear>
      {tasks.map((task, i) => (
        <TaskCard
          key={task.id}
          task={task}
          index={5 + i}
          pay={rates[task.id] ? `${money(rates[task.id].amount_jmd, 0)} / ${rates[task.id].unit}` : null}
          unit={rates[task.id] && (rates[task.id].max_paid_per_session ?? 1) > 1 ? `${task.detail} · up to ${payLabel(rates[task.id])?.replace(/^up to /, '')}` : null}
          today={todayLabel(task, summary?.todayByTask)}
        />
      ))}
      <SectionHeader title="How you get paid" />
      {/* How pay works (at the end: useful once, not every visit) */}
      <Appear index={12} style={styles.how}>
        {HOW.map((step, i) => (
          <View key={step.title} style={styles.howStep}>
            <View style={[styles.howIcon, { backgroundColor: theme.accentSoft }]}>
              <Icon name={step.icon} size={18} color={theme.accentText} />
            </View>
            <T variant="smallStrong" style={styles.center}>
              {step.title}
            </T>
            <T variant="caption" color="textSecondary" style={styles.center}>
              {step.detail}
            </T>
            {i < HOW.length - 1 ? (
              <View style={[styles.howLine, { backgroundColor: theme.backgroundSelected }]} pointerEvents="none" />
            ) : null}
          </View>
        ))}
      </Appear>

    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  center: { textAlign: 'center' },
  summary: { gap: 12, padding: 18 },
  summaryStats: { flexDirection: 'row' },
  summaryStat: { flex: 1, gap: 2, paddingHorizontal: 10 },
  summaryDivider: { borderLeftWidth: StyleSheet.hairlineWidth },
  firstStat: { paddingLeft: 0 },
  how: { flexDirection: 'row', gap: 6 },
  howStep: { flex: 1, alignItems: 'center', gap: 4 },
  howIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  howLine: { position: 'absolute', top: 20, left: '62%', right: '-38%', height: 2 },
  task: { borderRadius: 22, borderWidth: 1, borderLeftWidth: 5, padding: 16, gap: 12 },
  taskTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 },
  tag: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999 },
  taskBottom: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  pay: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  today: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
