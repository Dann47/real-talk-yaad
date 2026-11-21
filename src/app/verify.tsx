import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Header, Icon, Screen, T, goBack } from '@/components/kit';
import { verifyItems } from '@/data/sample';
import { useTheme } from '@/hooks/use-theme';

const PAY_EACH = 6;

export default function VerifyScreen() {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const [votes, setVotes] = useState(0);

  const vote = (counted: boolean) => {
    if (counted) setVotes((v) => v + 1);
    setIndex((i) => i + 1);
  };

  if (index >= verifyItems.length) {
    return (
      <Screen title="Verify" header={<Header title="Verify corrections" subtitle="All done" />} footer={<Button label="Back to work" onPress={goBack} />}>
        <Card tone="soft" style={styles.gap}>
          <Icon name="check" size={32} color={theme.accentText} />
          <T variant="title">Thanks for checking!</T>
          <T variant="body">
            You voted on {votes} corrections. You earn J${votes * PAY_EACH} for votes that agree with other speakers.
          </T>
        </Card>
      </Screen>
    );
  }

  const item = verifyItems[index];

  return (
    <Screen
      title="Verify"
      header={
        <Header
          title="Verify corrections"
          subtitle={`${index + 1} of ${verifyItems.length}`}
          right={<Chip label={`J$${PAY_EACH} each`} />}
        />
      }
      footer={
        <View style={styles.gap}>
          <Button label="Yes, sound right" icon="check" onPress={() => vote(true)} />
          <View style={styles.row}>
            <Button label="Not quite" variant="secondary" style={styles.flex} onPress={() => vote(true)} />
            <Button label="Skip" variant="ghost" style={styles.flex} onPress={() => vote(false)} />
          </View>
        </View>
      }>
      <Card style={styles.gap}>
        <T variant="caption" color="textSecondary">
          The AI said
        </T>
        <T variant="body">{item.ai}</T>
      </Card>
      <Card tone="outlined" style={styles.gap}>
        <T variant="caption" color="accentText">
          Someone corrected it to
        </T>
        <T variant="title">{item.corrected}</T>
      </Card>
      <T variant="heading">Is the correction right?</T>
      <T variant="small" color="textSecondary">
        Your vote is compared with other speakers. Votes that agree with the group raise your level.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
});
