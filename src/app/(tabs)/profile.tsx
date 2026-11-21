import { type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Appear, Avatar, Card, Chip, ListRow, Screen, SectionHeader, T } from '@/components/kit';
import { leaderboard, user } from '@/data/sample';
import { useTheme } from '@/hooks/use-theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const medal = [theme.reward, theme.textSecondary, theme.rewardText];

  return (
    <Screen tabs title="Me">
      <Appear>
        <Card tone="hero" style={styles.identity}>
          <Avatar letter={user.name[0]} size={72} ring={theme.onAccent} />
          <View style={styles.flex}>
            <T variant="title" style={{ color: theme.onAccent }}>
              {user.name}
            </T>
            <T variant="small" style={{ color: theme.onAccent }}>
              {user.handle} · {user.parish}
            </T>
            <View style={styles.chip}>
              <Chip tone="reward" icon="sparkles" label={`Level ${user.level} · ${user.levelName}`} />
            </View>
          </View>
        </Card>
      </Appear>

      <Appear index={1} style={styles.stats}>
        {[
          [String(user.tasksDone), 'Tasks done'],
          [user.agreeRate, 'Agreed'],
          [user.earned, 'Earned'],
        ].map(([value, label]) => (
          <Card key={label} style={styles.stat}>
            <T variant="title">{value}</T>
            <T variant="caption" color="textSecondary">
              {label}
            </T>
          </Card>
        ))}
      </Appear>

      <Appear index={2}>
        <SectionHeader title={`This week in ${user.parish}`} />
      </Appear>
      <Appear index={3}>
        <Card style={styles.board}>
          {leaderboard.map((row, i) => (
            <View key={row.rank} style={[styles.boardRow, row.me && { backgroundColor: theme.accentSoft }]}>
              <View style={[styles.medal, { backgroundColor: medal[i] ?? theme.backgroundSelected }]}>
                <T variant="smallStrong" style={{ color: i === 0 ? theme.onReward : theme.background }}>
                  {row.rank}
                </T>
              </View>
              <T variant={row.me ? 'bodyStrong' : 'body'} style={styles.flex}>
                {row.name}
              </T>
              <T variant="small" color="textSecondary">
                {row.verified} verified
              </T>
            </View>
          ))}
        </Card>
      </Appear>

      <Appear index={4}>
        <SectionHeader title="Settings" />
      </Appear>
      <Appear index={5} style={styles.links}>
        <ListRow icon="settings" title="Appearance" subtitle="Light, dark and accent colour" href={'/settings' as Href} />
        <ListRow icon="shield" title="Consent and data" subtitle="How your voice and text are used" href={'/consent' as Href} />
        <ListRow icon="wallet" tone="reward" title="Payout method" subtitle="Bank card •••• 4821" href={'/wallet' as Href} />
      </Appear>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20 },
  chip: { marginTop: 8 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8 },
  board: { gap: 4, padding: 8 },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 14 },
  medal: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  links: { gap: 10 },
});
