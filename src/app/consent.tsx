import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Header, Icon, IconTile, Notice, ProgressBar, Screen, T, goBack } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';
import { TERMS_VERSION, useAuth } from '@/lib/auth';
import { authMessage } from '@/lib/auth-helpers';
import { supabase } from '@/lib/supabase';

function Checkbox({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.check,
        {
          backgroundColor: checked ? theme.accentSoft : theme.background,
          borderColor: checked ? theme.accent : theme.backgroundSelected,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}>
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
  const { consented: alreadyIn, refresh } = useAuth();
  const [adult, setAdult] = useState(alreadyIn);
  const [training, setTraining] = useState(alreadyIn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agree = async () => {
    if (alreadyIn) return goBack();
    setBusy(true);
    setError(null);
    const { error: saveError } = await supabase.from('consents').insert({
      terms_version: TERMS_VERSION,
      is_adult: adult,
      ai_training: training,
      platform: Platform.OS,
    });
    if (saveError) {
      setBusy(false);
      return setError(authMessage(saveError));
    }
    await refresh();
    router.replace('/' as Href);
  };

  return (
    <Screen
      title="Consent"
      header={<Header title="Before you start" subtitle={alreadyIn ? 'Your consent' : 'Step 3 of 3'} />}
      footer={
        <Button
          label={alreadyIn ? 'Done' : busy ? 'Saving...' : 'I agree, continue'}
          disabled={!adult || !training || busy}
          onPress={agree}
        />
      }>
      {!alreadyIn ? <ProgressBar value={0.9} label="Sign-up progress" /> : null}
      {error ? <Notice tone="error" text={error} /> : null}
      <T variant="title">Your voice, your choice</T>
      <T variant="body" color="textSecondary">
        We sell verified Patois data to AI companies. You only take part if you agree.
      </T>

      <Card style={styles.info}>
        <View style={styles.infoTitle}>
          <IconTile icon="shield" size={36} />
          <T variant="bodyStrong" color="accentText">
            How your data is used
          </T>
        </View>
        <T variant="small">• Recordings, chats and corrections may be licensed to AI companies for training.</T>
        <T variant="small">• Your name and contact details are never included.</T>
        <T variant="small">• You can stop at any time. Work already sold stays sold.</T>
      </Card>

      <Checkbox checked={adult} label="I am 18 or older" onToggle={() => !alreadyIn && setAdult(!adult)} />
      <Checkbox
        checked={training}
        label="I agree my voice and text may be licensed for AI training"
        onToggle={() => !alreadyIn && setTraining(!training)}
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
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, borderWidth: 1.5, minHeight: 60 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
