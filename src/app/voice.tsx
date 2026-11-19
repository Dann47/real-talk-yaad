import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, Chip, Header, Icon, IconButton, Screen, T, Waveform, goBack } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';

export default function VoiceScreen() {
  const theme = useTheme();
  const [listening, setListening] = useState(false);
  const [editing, setEditing] = useState(false);
  const [heard, setHeard] = useState('Tree hundred dollar a pound, but mi wi give yuh a bly.');

  return (
    <Screen
      header={<Header title="Voice chat" subtitle="Topic: At the market" right={<Chip label="J$30 so far" />} />}
      footer={
        <View style={styles.controls}>
          <IconButton icon="edit" label="Correct the AI" size={56} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hold to talk"
            accessibilityState={{ busy: listening }}
            onPressIn={() => setListening(true)}
            onPressOut={() => setListening(false)}
            style={styles.talk}>
            <View style={[styles.mic, { backgroundColor: listening ? theme.reward : theme.accent }]}>
              <Icon name="mic" size={34} color={listening ? theme.onReward : theme.onAccent} />
            </View>
            <T variant="smallStrong">{listening ? 'Listening...' : 'Hold to talk'}</T>
          </Pressable>
          <Button label="End" variant="secondary" compact onPress={goBack} />
        </View>
      }>
      <Card style={styles.gap}>
        <T variant="caption" color="textSecondary">
          {listening ? 'You are speaking' : 'AI is speaking'}
        </T>
        <T variant="title">How much fi di yam dem? Dem look nice.</T>
      </Card>

      <Waveform active={listening} color={listening ? theme.reward : theme.accent} />

      <Card tone="soft" style={styles.gap}>
        <T variant="caption" color="textSecondary">
          What we heard you say
        </T>
        {editing ? (
          <TextInput
            accessibilityLabel="Fix the words we heard"
            value={heard}
            onChangeText={setHeard}
            multiline
            autoFocus
            style={[styles.input, { color: theme.text, borderColor: theme.accent, backgroundColor: theme.background }]}
          />
        ) : (
          <T variant="body">"{heard}"</T>
        )}
        <Button
          label={editing ? 'Save fix' : 'Fix the words'}
          icon={editing ? 'check' : 'edit'}
          variant="secondary"
          compact
          style={styles.start}
          onPress={() => setEditing(!editing)}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 8 },
  start: { alignSelf: 'flex-start' },
  input: { minHeight: 64, borderWidth: 1.5, borderRadius: 12, padding: 10, fontSize: 16, textAlignVertical: 'top' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  talk: { alignItems: 'center', gap: 6 },
  mic: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
});
