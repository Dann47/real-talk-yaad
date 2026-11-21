import { type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Header, ListRow, Notice, Screen, SectionHeader, T, TextField } from '@/components/kit';
import { useAuth } from '@/lib/auth';
import { MIN_PASSWORD_LENGTH, authMessage, passwordProblem } from '@/lib/auth-helpers';
import { supabase } from '@/lib/supabase';

type Message = { tone: 'error' | 'success'; text: string } | null;

export default function AccountScreen() {
  const { user, profile, refresh, signOut } = useAuth();

  const [name, setName] = useState(profile?.display_name ?? '');
  const [nameMessage, setNameMessage] = useState<Message>(null);
  const [savingName, setSavingName] = useState(false);

  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<Message>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setName(profile?.display_name ?? '');
  }, [profile?.display_name]);

  const saveName = async () => {
    if (!user) return;
    if (name.trim().length < 2) return setNameMessage({ tone: 'error', text: 'Use at least 2 letters.' });
    setSavingName(true);
    const { error } = await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', user.id);
    setSavingName(false);
    if (error) return setNameMessage({ tone: 'error', text: authMessage(error) });
    await refresh();
    setNameMessage({ tone: 'success', text: 'Name saved.' });
  };

  const changePassword = async () => {
    if (!user?.email) return;
    if (!current) return setPasswordMessage({ tone: 'error', text: 'Enter your current password.' });
    const problem = passwordProblem(password);
    if (problem) return setPasswordMessage({ tone: 'error', text: problem });
    if (password !== confirm) return setPasswordMessage({ tone: 'error', text: 'The new passwords do not match.' });
    if (password === current) return setPasswordMessage({ tone: 'error', text: 'Pick a password you have not used before.' });

    setSavingPassword(true);
    setPasswordMessage(null);
    // Check the current password first, so someone using an unlocked phone cannot change it.
    const { error: checkError } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
    if (checkError) {
      setSavingPassword(false);
      return setPasswordMessage({ tone: 'error', text: 'Your current password is not right.' });
    }
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);
    if (error) return setPasswordMessage({ tone: 'error', text: authMessage(error) });
    setCurrent('');
    setPassword('');
    setConfirm('');
    setPasswordMessage({ tone: 'success', text: 'Password changed.' });
  };

  return (
    <Screen title="Account" header={<Header title="Account and password" />}>
      <Card style={styles.section}>
        <T variant="caption" color="textSecondary">
          Signed in as
        </T>
        <T variant="bodyStrong">{user?.email}</T>
      </Card>

      <SectionHeader title="Your name" />
      <Card style={styles.section}>
        {nameMessage ? <Notice tone={nameMessage.tone} text={nameMessage.text} /> : null}
        <TextField label="Name" value={name} onChangeText={setName} placeholder="What should we call you?" maxLength={60} autoComplete="name" />
        <Button label={savingName ? 'Saving...' : 'Save name'} variant="secondary" compact disabled={savingName} onPress={saveName} />
      </Card>

      <SectionHeader title="Change password" />
      <Card style={styles.section}>
        {passwordMessage ? <Notice tone={passwordMessage.tone} text={passwordMessage.text} /> : null}
        <TextField label="Current password" value={current} onChangeText={setCurrent} secure autoComplete="current-password" textContentType="password" />
        <TextField
          label="New password"
          value={password}
          onChangeText={setPassword}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters, with letters and numbers.`}
          secure
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <TextField label="Confirm new password" value={confirm} onChangeText={setConfirm} secure autoComplete="new-password" textContentType="newPassword" />
        <Button label={savingPassword ? 'Saving...' : 'Change password'} compact disabled={savingPassword} onPress={changePassword} />
      </Card>

      <View style={styles.links}>
        <ListRow icon="settings" title="Appearance" subtitle="Light, dark and accent colour" href={'/settings' as Href} />
        <ListRow icon="shield" title="Consent and data" subtitle="How your voice and text are used" href={'/consent' as Href} />
      </View>

      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  links: { gap: 10 },
});
