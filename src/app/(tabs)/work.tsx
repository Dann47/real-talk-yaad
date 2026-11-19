import { StyleSheet, View } from 'react-native';

import { Card, Chip, ListRow, Screen, T } from '@/components/kit';
import { money, tasks, wallet } from '@/data/sample';

export default function WorkScreen() {
  return (
    <Screen tabs>
      <T variant="title">Work</T>
      <T variant="body" color="textSecondary">
        Pick a task. You get paid once other speakers verify your work.
      </T>

      <Card tone="soft" style={styles.summary}>
        <View style={styles.flex}>
          <T variant="caption" color="textSecondary">
            Earned this week
          </T>
          <T variant="title">{money(wallet.thisWeek, 0)}</T>
        </View>
        <Chip label={`${money(wallet.pending, 0)} in review`} />
      </Card>

      {tasks.map((task) => (
        <View key={task.id} style={styles.task}>
          <ListRow icon={task.icon} title={task.title} subtitle={task.detail} value={task.pay} href={task.href} />
          <T variant="small" color="textSecondary" style={styles.description}>
            {task.description}
          </T>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  task: { gap: 6 },
  description: { paddingHorizontal: 6 },
});
