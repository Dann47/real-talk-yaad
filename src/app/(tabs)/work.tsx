import { StyleSheet, View } from 'react-native';

import { ContinueChat } from '@/components/continue-chat';
import { Appear, Card, Chip, IconTile, ListRow, Screen, T } from '@/components/kit';
import { money, tasks, wallet } from '@/data/sample';

export default function WorkScreen() {
  return (
    <Screen tabs title="Work">
      <Appear>
        <T variant="overline" color="accentText">
          Earn by teaching
        </T>
        <T variant="title">Pick your work</T>
        <T variant="body" color="textSecondary">
          You get paid once other speakers verify your work.
        </T>
      </Appear>

      <ContinueChat />

      <Appear index={1}>
        <Card tone="reward" style={styles.summary}>
          <IconTile icon="trend" tone="reward" />
          <View style={styles.flex}>
            <T variant="caption" color="rewardText">
              Earned this week
            </T>
            <T variant="title">{money(wallet.thisWeek, 0)}</T>
          </View>
          <Chip label={`${money(wallet.pending, 0)} in review`} />
        </Card>
      </Appear>

      {tasks.map((task, i) => (
        <Appear key={task.id} index={2 + i} style={styles.task}>
          <ListRow icon={task.icon} tone={task.tone} title={task.title} subtitle={task.detail} value={task.pay} href={task.href} />
          <T variant="small" color="textSecondary" style={styles.description}>
            {task.description}
          </T>
        </Appear>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  task: { gap: 6 },
  description: { paddingHorizontal: 8 },
});
