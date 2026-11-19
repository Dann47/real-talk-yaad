import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Header, Icon, ProgressBar, Screen, T } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';
import { completeOnboarding, hasOnboarded } from '@/lib/onboarding';

function Checkbox({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={[styles.check, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
      <View
        style={[
          styles.box,
          {
            borderColor: checked ? theme.accent : theme.textSecondary,
            backgroundColor: checked ? theme.accent : 'transparent',
          },
        ]}>
        {checked ? <Icon name="check" size={16} color={theme.onAccent} /> : null}
      </View>
      <T variant="body" style={styles.flex}>
        {label}
      </T>
    </Pressable>
  );
}

export default function ConsentScreen() {
  const theme = useTheme();
  const alreadyIn = hasOnboarded();
  const [adult, setAdult] = useState(alreadyIn);
  const [training, setTraining] = useState(alreadyIn);

  const agree = () => {
    completeOnboarding();
    router.replace('/' as Href);
  };

  return (
    <Screen
      header={<Header title="Before you start" subtitle={alreadyIn ? 'Your consent' : 'Step 2 of 3'} />}
      footer={
        <Button
          label={alreadyIn ? 'Done' : 'I agree, continue'}
          disabled={!adult || !training}
          onPress={agree}
        />
      }>
      {!alreadyIn ? <ProgressBar value={0.66} label="Sign-up progress" /> : null}
      <T variant="title">Your voice, your choice</T>
      <T variant="body" color="textSecondary">
        We sell verified Patois data to AI companies. You only take part if you agree.
      </T>

      <Card style={styles.info}>
        <View style={styles.infoTitle}>
          <Icon name="shield" color={theme.accentText} />
          <T variant="bodyStrong" color="accentText">
            How your data is used
          </T>
        </View>
        <T variant="small">• Recordings, chats and corrections may be licensed to AI companies for training.</T>
        <T variant="small">• Your name and contact details are never included.</T>
        <T variant="small">• You can stop at any time. Work already sold stays sold.</T>
      </Card>

      <Checkbox checked={adult} label="I am 18 or older" onToggle={() => setAdult(!adult)} />
      <Checkbox
        checked={training}
        label="I agree my voice and text may be licensed for AI training"
        onToggle={() => setTraining(!training)}
      />
      <T variant="small" color="textSecondary">
        Full terms: [link to terms, once your lawyer has approved them]
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  info: { gap: 8 },
  infoTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, minHeight: 56 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
