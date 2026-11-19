import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Chip, ListRow, ProgressBar, Screen, T } from '@/components/kit';
import { money, tasks, user, wallet } from '@/data/sample';
import { useTheme } from '@/hooks/use-theme';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Mawnin,';
  if (hour < 17) return 'Good afternoon,';
  return 'Evenin,';
}

export default function HomeScreen() {
  const theme = useTheme();

  return (
    <Screen tabs>
      <View style={styles.top}>
        <View>
          <T variant="small" color="textSecondary">
            {greeting()}
          </T>
          <T variant="title">{user.name}</T>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Your profile"
          onPress={() => router.push('/profile' as Href)}>
          <Avatar letter={user.name[0]} />
        </Pressable>
      </View>

      <Card tone="accent" style={styles.balance}>
        <T variant="smallStrong" style={{ color: theme.onAccent }}>
          Available balance
        </T>
        <T variant="display" style={{ color: theme.onAccent }}>
          {money(wallet.balance)}
        </T>
        <T variant="small" style={{ color: theme.onAccent }}>
          +{money(wallet.thisWeek, 0)} this week · {money(wallet.pending, 0)} waiting for review
        </T>
        <View style={styles.balanceButtons}>
          <Button label="Cash out" variant="reward" compact href={'/wallet' as Href} style={styles.flex} />
          <Button
            label="Store"
            compact
            href={'/store' as Href}
            style={[styles.flex, { backgroundColor: 'transparent', borderColor: theme.onAccent }]}
          />
        </View>
      </Card>

      <Card style={styles.level}>
        <Chip label={`Level ${user.level}`} />
        <View style={styles.flex}>
          <T variant="smallStrong">{user.levelName}</T>
          <ProgressBar value={user.levelProgress} label="Progress to next level" />
        </View>
        <T variant="caption" color="textSecondary">
          {user.tasksToNextLevel} tasks to go
        </T>
      </Card>

      <T variant="heading">Today's work</T>
      {tasks
        .filter((task) => task.id !== 'voice')
        .map((task) => (
          <ListRow
            key={task.id}
            icon={task.icon}
            title={task.title}
            subtitle={task.detail}
            value={task.pay}
            href={task.href}
          />
        ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balance: { gap: 4, padding: 20 },
  balanceButtons: { flexDirection: 'row', gap: 10, marginTop: 12 },
  level: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
});
