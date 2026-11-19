import { type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar, Card, Chip, ListRow, Screen, T } from '@/components/kit';
import { leaderboard, user } from '@/data/sample';
import { useTheme } from '@/hooks/use-theme';

export default function ProfileScreen() {
  const theme = useTheme();

  return (
    <Screen tabs>
      <View style={styles.identity}>
        <Avatar letter={user.name[0]} size={64} />
        <View style={styles.flex}>
          <T variant="title">{user.name}</T>
          <T variant="small" color="textSecondary">
            {user.handle} · {user.parish}
          </T>
          <View style={styles.chip}>
            <Chip label={`Level ${user.level} · ${user.levelName}`} />
          </View>
        </View>
      </View>

      <View style={styles.stats}>
        {[
          [String(user.tasksDone), 'Tasks'],
          [user.agreeRate, 'Agreed'],
          [user.earned, 'Earned'],
        ].map(([value, label]) => (
          <Card key={label} style={styles.stat}>
            <T variant="heading">{value}</T>
            <T variant="caption" color="textSecondary">
              {label}
            </T>
          </Card>
        ))}
      </View>

      <Card style={styles.board}>
        <T variant="heading">This week in {user.parish}</T>
        {leaderboard.map((row) => (
          <View
            key={row.rank}
            style={[styles.boardRow, row.me && { backgroundColor: theme.accentSoft }]}>
            <T variant="bodyStrong" color="accentText" style={styles.rank}>
              {row.rank}
            </T>
            <T variant={row.me ? 'bodyStrong' : 'body'} style={styles.flex}>
              {row.name}
            </T>
            <T variant="small" color="textSecondary">
              {row.verified} verified
            </T>
          </View>
        ))}
      </Card>

      <ListRow icon="settings" title="Appearance" subtitle="Light, dark and accent colour" href={'/settings' as Href} />
      <ListRow icon="shield" title="Consent and data" subtitle="How your voice and text are used" href={'/consent' as Href} />
      <ListRow icon="wallet" title="Payout method" subtitle="Bank card •••• 4821" href={'/wallet' as Href} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  chip: { marginTop: 6 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, alignItems: 'center', padding: 12 },
  board: { gap: 4 },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  rank: { width: 20 },
});
