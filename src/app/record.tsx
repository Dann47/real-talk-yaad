import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Header, Icon, Screen, T, Waveform, goBack } from '@/components/kit';
import { recordLines } from '@/data/sample';
import { useTheme } from '@/hooks/use-theme';

const PAY = 'J$40';

function clock(seconds: number) {
  return `00:${String(seconds).padStart(2, '0')}`;
}

export default function RecordScreen() {
  const theme = useTheme();
  const [line, setLine] = useState(0);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [done, setDone] = useState(false);

  // Placeholder timer until real audio recording is added.
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((s) => Math.min(59, s + 1)), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  const redo = () => {
    setRecording(false);
    setSeconds(0);
  };

  const submit = () => {
    setRecording(false);
    setSeconds(0);
    if (line + 1 >= recordLines.length) setDone(true);
    else setLine(line + 1);
  };

  if (done) {
    return (
      <Screen title="Record" header={<Header title="Record" subtitle="All lines done" />} footer={<Button label="Back to work" onPress={goBack} />}>
        <Card tone="soft" style={styles.gap}>
          <Icon name="check" size={32} color={theme.accentText} />
          <T variant="title">Nice work!</T>
          <T variant="body">Your {recordLines.length} recordings are waiting for review. {PAY} lands in your wallet once they pass.</T>
        </Card>
      </Screen>
    );
  }

  const hasTake = seconds > 0 && !recording;

  return (
    <Screen
      title="Record"
      header={<Header title="Record" subtitle={`Line ${line + 1} of ${recordLines.length} · Market day`} right={<Chip label={PAY} />} />}
      footer={
        <View style={styles.footer}>
          <Button label="Redo" variant="secondary" style={styles.flex} disabled={seconds === 0} onPress={redo} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
            onPress={() => {
              if (!recording) setSeconds(0);
              setRecording(!recording);
            }}
            style={[styles.recordButton, { borderColor: theme.backgroundSelected }]}>
            {recording ? (
              <View style={[styles.stop, { backgroundColor: theme.accent }]} />
            ) : (
              <View style={[styles.dot, { backgroundColor: theme.danger }]} />
            )}
          </Pressable>
          <Button label="Submit" style={styles.flex} disabled={!hasTake} onPress={submit} />
        </View>
      }>
      <View style={styles.progress} accessibilityLabel={`Line ${line + 1} of ${recordLines.length}`}>
        {recordLines.map((_, i) => (
          <View
            key={i}
            style={[styles.segment, { backgroundColor: i <= line ? theme.accent : theme.backgroundSelected }]}
          />
        ))}
      </View>

      <Card style={styles.gap}>
        <T variant="caption" color="textSecondary">
          Read this out loud
        </T>
        <T variant="title">{recordLines[line]}</T>
      </Card>
      <T variant="small" color="textSecondary">
        Talk the way you talk at home. Small changes in the words are fine.
      </T>

      <Waveform active={recording || hasTake} color={theme.reward} />
      <T variant="display" style={styles.center} accessibilityLiveRegion="polite">
        {clock(seconds)}
      </T>
      <T variant="small" color="textSecondary" style={styles.center}>
        {recording ? 'Recording... tap the square to stop' : hasTake ? 'Listen back, then submit or redo' : 'Tap the red button to start'}
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: 8 },
  center: { textAlign: 'center' },
  progress: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 8, borderRadius: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  recordButton: { width: 84, height: 84, borderRadius: 42, borderWidth: 5, alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' },
  dot: { width: 36, height: 36, borderRadius: 18 },
  stop: { width: 28, height: 28, borderRadius: 6 },
});
