import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  Appear,
  Avatar,
  Button,
  Card,
  Chip,
  Icon,
  NameBadge,
  IconTile,
  Notice,
  ProgressBar,
  Screen,
  SectionHeader,
  T,
} from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';
import { displayName, useAuth } from '@/lib/auth';
import { levelFor } from '@/lib/earnings';
import { useMyLook } from '@/lib/cosmetics';
import { money } from '@/lib/format';
import { HIDDEN, useHideAmounts } from '@/lib/hide-amounts';
import { badgesFor, lastSevenDays, shortMoney, streakDays, useMe, type Activity } from '@/lib/profile';
import { tasks } from '@/lib/tasks';

const DASH = '—';

/** Work types shown under "Your work" (talk covers typed and voice chats separately). */
const WORK = ['talk', 'voice', 'record', 'verify', 'teach'] as const;

const TASK_ICON: Record<string, 'chat' | 'mic' | 'waveform' | 'check' | 'video'> = {
  talk: 'chat',
  voice: 'mic',
  record: 'waveform',
  verify: 'check',
  teach: 'video',
};
const TASK_NAME: Record<string, string> = {
  talk: 'Fixed the AI',
  voice: 'Fixed a voice chat',
  record: 'Recorded a line',
  verify: 'Checked work',
  teach: 'Described a post',
};

function ago(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** Status pill for one piece of work. */
function StatusPill({ status }: { status: Activity['status'] }) {
  const theme = useTheme();
  const look = {
    approved: { bg: theme.accentSoft, fg: theme.accentText, label: 'Paid' },
    pending: { bg: theme.rewardSoft, fg: theme.rewardText, label: 'In review' },
    rejected: { bg: theme.backgroundSelected, fg: theme.textSecondary, label: 'Not approved' },
  }[status];
  return (
    <View style={[styles.status, { backgroundColor: look.bg }]}>
      <T variant="caption" style={{ color: look.fg }}>
        {look.label}
      </T>
    </View>
  );
}

function memberSince(iso: string | undefined) {
  if (!iso) return null;
  return new Intl.DateTimeFormat('en-JM', { month: 'short', year: 'numeric' }).format(new Date(iso));
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { profile, user: account, signOut } = useAuth();
  const { summary, leaders, activity, error, refreshing, refresh } = useMe();
  const [hidden] = useHideAmounts();
  const look = useMyLook();
  const show = (amount: number) => (hidden ? HIDDEN : money(amount, 0));
  const week = lastSevenDays(activity ?? []);
  const weekTotal = week.reduce((sum, d) => sum + d.amount, 0);
  const tallest = Math.max(1, ...week.map((d) => d.amount));
  const streak = streakDays(activity ?? []);
  const badges = summary ? badgesFor(summary, streak) : [];
  const earnedBadges = badges.filter((b) => b.earned).length;

  const name = displayName(profile, account);
  const level = levelFor(summary?.approvedCount ?? 0);
  const since = memberSince(profile?.created_at ?? account?.created_at);
  const matchRate = summary?.votesSettled ? Math.round((summary.votesMatched / summary.votesSettled) * 100) : null;
  const approvalRate = summary?.reviewedCount ? Math.round((summary.approvedCount / summary.reviewedCount) * 100) : null;
  const medal = [theme.reward, theme.textSecondary, theme.rewardText];
  const scope = leaders?.[0]?.scope ?? profile?.parish ?? 'Jamaica';
  const editProfile = () => router.push('/edit-profile' as Href);

  return (
    <Screen tabs title="Me" onRefresh={refresh} refreshing={refreshing && !!summary}>
      {/* Who you are */}
      <Appear>
        <Card tone="hero" style={styles.identity}>
          <View style={styles.identityTop}>
            <Avatar letter={name[0]?.toUpperCase() ?? 'R'} size={72} ring={look.frame ? undefined : theme.onAccent} frame={look.frame?.colors} />
            <View style={styles.flex}>
              <T variant="title" style={{ color: theme.onAccent }}>
                {name}
              </T>
              {look.badge ? (
                <View style={styles.badgeRow}>
                  <NameBadge badge={look.badge} />
                </View>
              ) : null}
              {profile?.handle ? (
                <T variant="small" style={{ color: theme.onAccent }}>
                  @{profile.handle}
                </T>
              ) : (
                <Pressable accessibilityRole="button" onPress={editProfile} hitSlop={6}>
                  <T variant="small" style={[styles.underline, { color: theme.onAccent }]}>
                    Add a handle
                  </T>
                </Pressable>
              )}
              <View style={styles.metaRow}>
                <Icon name="home" size={13} color={theme.onAccent} />
                <T variant="caption" style={{ color: theme.onAccent, opacity: 0.9 }}>
                  {profile?.parish ?? 'No parish yet'}
                  {since ? ` · Since ${since}` : ''}
                </T>
              </View>
              {streak ? (
                <View style={[styles.heroStreak, { backgroundColor: theme.reward }]}>
                  <Icon name="flame" size={13} color={theme.onReward} />
                  <T variant="caption" style={{ color: theme.onReward }}>
                    {streak}-day streak
                  </T>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.levelBlock}>
            <View style={styles.levelTop}>
              <Chip tone="reward" icon="sparkles" label={`Level ${level.level} · ${level.name}`} />
              <T variant="caption" style={{ color: theme.onAccent }}>
                {!summary ? DASH : level.next ? `${level.toNext} to ${level.next.name}` : 'Top level!'}
              </T>
            </View>
            <ProgressBar value={summary ? level.progress : 0} label="Progress to next level" color={theme.reward} />
          </View>
          <Button label="Edit profile" icon="edit" variant="onAccent" compact onPress={editProfile} />
        </Card>
      </Appear>

      {error ? (
        <Pressable accessibilityRole="button" onPress={refresh}>
          <Notice tone="error" text={`${error} Tap to try again.`} />
        </Pressable>
      ) : null}

      {/* Lifetime numbers */}
      <Appear index={1} style={styles.stats}>
        {[
          { value: summary ? String(summary.tasksDone) : DASH, label: 'Tasks done', icon: 'bolt' as const },
          {
            value: matchRate !== null ? `${matchRate}%` : approvalRate !== null ? `${approvalRate}%` : DASH,
            label: matchRate !== null ? 'Votes matched' : 'Approved',
            icon: 'check' as const,
          },
          { value: !summary ? DASH : hidden ? 'J$ ••' : shortMoney(summary.earnedTotal), label: 'Earned', icon: 'wallet' as const },
        ].map((stat) => (
          <Card key={stat.label} style={styles.stat}>
            <Icon name={stat.icon} size={16} color={theme.accentText} />
            <T variant="title">{stat.value}</T>
            <T variant="caption" color="textSecondary">
              {stat.label}
            </T>
          </Card>
        ))}
      </Appear>
      {summary && summary.pendingTotal > 0 ? (
        <Appear index={2}>
          <View style={[styles.pending, { backgroundColor: theme.rewardSoft }]}>
            <Icon name="sparkles" size={16} color={theme.rewardText} />
            <T variant="small" color="rewardText" style={styles.flex}>
              {hidden ? 'More money is' : `${money(summary.pendingTotal, 0)} more is`} waiting for other speakers to check.
            </T>
          </View>
        </Appear>
      ) : null}

      {/* Last 7 days */}
      <Appear index={3}>
        <Card style={styles.weekCard}>
          <View style={styles.weekTop}>
            <View style={styles.flex}>
              <T variant="overline" color="textSecondary">
                Last 7 days
              </T>
              <T variant="title">{activity ? show(weekTotal) : DASH}</T>
            </View>
            <T variant="caption" color="textSecondary">
              {activity ? `${week.reduce((n, d) => n + d.count, 0)} tasks` : ''}
            </T>
          </View>
          <View style={styles.bars} accessibilityLabel={week.map((d) => `${d.label}: ${money(d.amount, 0)}`).join(', ')}>
            {week.map((d) => (
              <View key={d.day} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${Math.max(d.count ? 8 : 3, (d.amount / tallest) * 100)}%`,
                        backgroundColor: d.isToday ? theme.reward : d.count ? theme.accent : theme.backgroundSelected,
                      },
                    ]}
                  />
                </View>
                <T variant="caption" color={d.isToday ? 'rewardText' : 'textSecondary'}>
                  {d.label}
                </T>
              </View>
            ))}
          </View>
        </Card>
      </Appear>

      {/* Badges */}
      {summary ? (
        <>
          <Appear index={3}>
            <SectionHeader title={`Badges · ${earnedBadges} of ${badges.length}`} />
          </Appear>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badges}>
            {badges.map((badge, i) => (
              <Appear key={badge.id} index={4 + i}>
                <View
                  accessibilityLabel={`${badge.title}: ${badge.detail}. ${badge.earned ? 'Earned' : `${Math.round(badge.progress * 100)}% there`}`}
                  style={[
                    styles.badge,
                    {
                      backgroundColor: badge.earned ? theme.rewardSoft : theme.backgroundElement,
                      borderColor: badge.earned ? theme.reward : theme.backgroundSelected,
                    },
                  ]}>
                  <View style={[styles.badgeIcon, { backgroundColor: badge.earned ? theme.reward : theme.backgroundSelected }]}>
                    <Icon name={badge.icon} size={20} color={badge.earned ? theme.onReward : theme.textSecondary} />
                  </View>
                  <T variant="smallStrong" numberOfLines={1}>
                    {badge.title}
                  </T>
                  <T variant="caption" color="textSecondary" numberOfLines={2} style={styles.center}>
                    {badge.detail}
                  </T>
                  {badge.earned ? (
                    <T variant="caption" color="rewardText">
                      Earned
                    </T>
                  ) : (
                    <View style={styles.badgeBar}>
                      <ProgressBar value={badge.progress} label={`${badge.title} progress`} />
                    </View>
                  )}
                </View>
              </Appear>
            ))}
          </ScrollView>
        </>
      ) : null}

      {/* Work by type */}
      <Appear index={3}>
        <SectionHeader title="Your work" />
      </Appear>
      <Appear index={4}>
        <Card style={styles.work}>
          {WORK.map((id, i) => {
            const task = tasks.find((t) => t.id === id);
            if (!task) return null;
            const stats = summary?.byTask[id];
            return (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={`${task.title}: ${stats?.count ?? 0} done, ${money(stats?.earned ?? 0, 0)} earned`}
                onPress={() => router.push(task.href)}
                style={({ pressed }) => [
                  styles.workRow,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected },
                  { opacity: pressed ? 0.7 : 1 },
                ]}>
                <IconTile icon={task.icon} tone={task.tone} size={38} />
                <View style={styles.flex}>
                  <T variant="bodyStrong">{task.title}</T>
                  <T variant="caption" color="textSecondary">
                    {!summary ? DASH : stats?.count ? `${stats.count} done · ${stats.approved} approved` : 'Not started yet'}
                  </T>
                </View>
                <T variant="smallStrong" color={stats?.earned ? 'rewardText' : 'textSecondary'}>
                  {summary ? show(stats?.earned ?? 0) : DASH}
                </T>
              </Pressable>
            );
          })}
        </Card>
      </Appear>

      {/* Weekly leaderboard */}
      <Appear index={5}>
        <SectionHeader title={`This week in ${scope}`} />
      </Appear>
      <Appear index={6}>
        <Card style={styles.board}>
          {!leaders ? (
            <T variant="small" color="textSecondary" style={styles.boardEmpty}>
              Loading the leaderboard...
            </T>
          ) : leaders.length === 0 ? (
            <View style={styles.boardEmptyBlock}>
              <IconTile icon="trend" tone="reward" size={40} />
              <T variant="bodyStrong">No approved work yet this week</T>
              <T variant="caption" color="textSecondary" style={styles.center}>
                Work counts once other speakers approve it. Be the first on the board!
              </T>
            </View>
          ) : (
            leaders.map((row, i) => (
              <View key={`${row.rank}-${row.name}-${i}`} style={[styles.boardRow, row.is_me && { backgroundColor: theme.accentSoft }]}>
                <View style={[styles.medal, { backgroundColor: row.rank <= 3 ? medal[row.rank - 1] : theme.backgroundSelected }]}>
                  <T variant="smallStrong" style={{ color: row.rank === 1 ? theme.onReward : row.rank <= 3 ? theme.background : theme.text }}>
                    {row.rank}
                  </T>
                </View>
                <T variant={row.is_me ? 'bodyStrong' : 'body'} style={styles.flex}>
                  {row.is_me ? `${row.name} (you)` : row.name}
                </T>
                <T variant="small" color="textSecondary">
                  {row.approved} approved
                </T>
              </View>
            ))
          )}
        </Card>
      </Appear>
      {profile && !profile.show_on_leaderboard ? (
        <T variant="caption" color="textSecondary">
          You're hidden from other people's leaderboard. Change it in Edit profile.
        </T>
      ) : !profile?.parish ? (
        <T variant="caption" color="textSecondary">
          Add your parish in Edit profile to compete with people near you.
        </T>
      ) : null}

      {/* Recent activity */}
      {activity && activity.length ? (
        <>
          <Appear index={7}>
            <SectionHeader title="Recent activity" />
          </Appear>
          <Appear index={7}>
            <Card style={styles.work}>
              {activity.slice(0, 6).map((a, i) => (
                <View
                  key={`${a.task}-${a.ref_id}`}
                  style={[styles.activityRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected }]}>
                  <IconTile icon={TASK_ICON[a.task] ?? 'sparkles'} tone={a.task === 'record' ? 'reward' : 'accent'} size={34} />
                  <View style={styles.flex}>
                    <T variant="smallStrong" numberOfLines={1}>
                      {a.detail ?? TASK_NAME[a.task] ?? 'Work'}
                    </T>
                    <T variant="caption" color="textSecondary">
                      {TASK_NAME[a.task] ?? 'Work'} · {ago(a.created_at)}
                    </T>
                  </View>
                  <View style={styles.activityRight}>
                    <T variant="smallStrong" color={a.status === 'rejected' ? 'textSecondary' : 'rewardText'}>
                      {a.status === 'rejected' ? 'J$0' : hidden ? '+J$ •••' : `+${money(a.amount_jmd, 0)}`}
                    </T>
                    <StatusPill status={a.status} />
                  </View>
                </View>
              ))}
            </Card>
          </Appear>
        </>
      ) : null}

      {/* Settings */}
      <Appear index={7}>
        <SectionHeader title="Settings" />
      </Appear>
      <Appear index={8}>
        <Card style={styles.work}>
          {[
            { icon: 'person' as const, title: 'Account and password', subtitle: account?.email ?? 'Email and password', href: '/account' },
            { icon: 'settings' as const, title: 'Appearance', subtitle: 'Light, dark and accent colour', href: '/settings' },
            { icon: 'shield' as const, title: 'Consent and data', subtitle: 'How your voice and text are used', href: '/consent' },
            { icon: 'bag' as const, title: 'Store', subtitle: 'Card skins, frames and badges', href: '/store' },
            { icon: 'wallet' as const, title: 'Payout method', subtitle: 'Your bank account or Lynk', href: '/payout-method' },
          ].map((row, i) => (
            <Pressable
              key={row.title}
              accessibilityRole="button"
              accessibilityLabel={`${row.title}. ${row.subtitle}`}
              onPress={() => router.push(row.href as Href)}
              style={({ pressed }) => [
                styles.workRow,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected },
                { opacity: pressed ? 0.7 : 1 },
              ]}>
              <IconTile icon={row.icon} tone={row.icon === 'wallet' ? 'reward' : 'accent'} size={36} />
              <View style={styles.flex}>
                <T variant="bodyStrong">{row.title}</T>
                <T variant="caption" color="textSecondary" numberOfLines={1}>
                  {row.subtitle}
                </T>
              </View>
              <Icon name="chevron" size={16} color={theme.textSecondary} />
            </Pressable>
          ))}
        </Card>
      </Appear>
      <Appear index={9}>
        <Button label="Sign out" variant="ghost" onPress={signOut} />
      </Appear>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  underline: { textDecorationLine: 'underline' },
  identity: { gap: 16, padding: 20 },
  identityTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  levelBlock: { gap: 8 },
  levelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 14, paddingHorizontal: 8 },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 16 },
  work: { padding: 6 },
  workRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 10 },
  board: { gap: 4, padding: 8 },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 14 },
  boardEmpty: { padding: 12 },
  boardEmptyBlock: { alignItems: 'center', gap: 6, padding: 16 },
  medal: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badgeRow: { marginTop: 4 },
  heroStreak: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, marginTop: 8 },
  weekCard: { gap: 14 },
  weekTop: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bars: { flexDirection: 'row', gap: 8, height: 110 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 8 },
  badges: { gap: 10, paddingRight: 4 },
  badge: { width: 128, alignItems: 'center', gap: 4, padding: 14, borderRadius: 20, borderWidth: 1.5 },
  badgeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  badgeBar: { width: '100%', marginTop: 4 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 10 },
  activityRight: { alignItems: 'flex-end', gap: 4 },
  status: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999 },
});
