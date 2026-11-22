import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Appear, Avatar, Button, Card, Header, Icon, Notice, Screen, SectionHeader, T, TextField, goBack } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';
import { displayName, useAuth } from '@/lib/auth';
import { money } from '@/lib/format';
import { PARISHES, WEEK_GOALS, handleProblem } from '@/lib/profile';
import { supabase } from '@/lib/supabase';

/** A tappable chip for picking one option. */
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: selected ? theme.accent : theme.backgroundElement,
          borderColor: selected ? theme.accent : theme.backgroundSelected,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}>
      {selected ? <Icon name="check" size={14} color={theme.onAccent} /> : null}
      <T variant="smallStrong" style={{ color: selected ? theme.onAccent : theme.text }}>
        {label}
      </T>
    </Pressable>
  );
}

export default function EditProfileScreen() {
  const theme = useTheme();
  const { user, profile, refresh } = useAuth();

  const [name, setName] = useState(profile?.display_name ?? '');
  const [handle, setHandle] = useState(profile?.handle ?? '');
  const [parish, setParish] = useState<string | null>(profile?.parish ?? null);
  const [goal, setGoal] = useState(profile?.week_goal ?? 1000);
  const [listed, setListed] = useState(profile?.show_on_leaderboard ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handleError, setHandleError] = useState<string | null>(null);

  const preview = displayName({ ...(profile ?? { id: '', level: 1, week_goal: 1000, show_on_leaderboard: true, created_at: '', parish: null, handle: null }), display_name: name }, user);

  const save = async () => {
    if (!user) return;
    const cleanName = name.trim().replace(/\s+/g, ' ');
    const cleanHandle = handle.trim().toLowerCase();
    if (cleanName.length < 2) return setError('Your name needs at least 2 letters.');
    const problem = handleProblem(cleanHandle);
    if (problem) return setHandleError(problem);

    setSaving(true);
    setError(null);
    const { error: saveError } = await supabase
      .from('profiles')
      .update({
        display_name: cleanName,
        handle: cleanHandle || null,
        parish,
        week_goal: goal,
        show_on_leaderboard: listed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);
    setSaving(false);
    if (saveError) {
      if (saveError.code === '23505') return setHandleError('Someone already has that handle. Try another one.');
      return setError(`Your profile was not saved (${saveError.message}).`);
    }
    await refresh();
    goBack();
  };

  return (
    <Screen
      title="Edit profile"
      header={<Header title="Edit profile" />}
      footer={<Button label={saving ? 'Saving...' : 'Save profile'} icon="check" disabled={saving} onPress={save} />}>
      <Appear>
        <Card tone="hero" style={styles.preview}>
          <Avatar letter={preview[0]?.toUpperCase() ?? 'R'} size={56} ring={theme.onAccent} />
          <View style={styles.flex}>
            <T variant="heading" style={{ color: theme.onAccent }}>
              {preview}
            </T>
            <T variant="small" style={{ color: theme.onAccent, opacity: 0.85 }}>
              {[handle.trim() ? `@${handle.trim().toLowerCase()}` : null, parish].filter(Boolean).join(' · ') || 'Add a handle and parish'}
            </T>
          </View>
        </Card>
      </Appear>

      {error ? <Notice tone="error" text={error} /> : null}

      <Appear index={1} style={styles.fields}>
        <TextField label="Your name" value={name} onChangeText={setName} maxLength={60} autoCapitalize="words" autoComplete="name" />
        <TextField
          label="Handle (optional)"
          value={handle}
          onChangeText={(text) => {
            setHandle(text.toLowerCase().replace(/\s/g, ''));
            setHandleError(null);
          }}
          error={handleError}
          hint="Small letters, numbers or _ · 3 to 24 characters"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={24}
          placeholder="yaadteacher"
        />
      </Appear>

      <Appear index={2}>
        <SectionHeader title="Parish" />
      </Appear>
      <Appear index={3} style={styles.choices}>
        {PARISHES.map((p) => (
          <Choice key={p} label={p} selected={parish === p} onPress={() => setParish(parish === p ? null : p)} />
        ))}
      </Appear>
      <T variant="caption" color="textSecondary">
        Your parish decides which weekly leaderboard you're on. Tap it again to clear it.
      </T>

      <Appear index={4}>
        <SectionHeader title="Weekly goal" />
      </Appear>
      <Appear index={5} style={styles.choices}>
        {WEEK_GOALS.map((g) => (
          <Choice key={g} label={money(g, 0)} selected={goal === g} onPress={() => setGoal(g)} />
        ))}
      </Appear>
      <T variant="caption" color="textSecondary">
        Shown on Home so you can see how close you are each week.
      </T>

      <Appear index={6}>
        <Card style={styles.toggle}>
          <View style={styles.flex}>
            <T variant="bodyStrong">Show me on the leaderboard</T>
            <T variant="caption" color="textSecondary">
              Only your first name and how much approved work you did this week.
            </T>
          </View>
          <Switch
            accessibilityLabel="Show me on the leaderboard"
            value={listed}
            onValueChange={setListed}
            trackColor={{ true: theme.accentSoft, false: theme.backgroundSelected }}
            thumbColor={listed ? theme.accent : theme.textSecondary}
            // Web draws its own switch: colour the knob and the "on" track there too.
            {...({ activeThumbColor: theme.accent, activeTrackColor: theme.accentSoft } as object)}
          />
        </Card>
      </Appear>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  fields: { gap: 14 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
