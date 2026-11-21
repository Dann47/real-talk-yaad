import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Header, Notice, Screen, T, TextField } from '@/components/kit';
import { MIN_PASSWORD_LENGTH, authMessage, isEmail, passwordProblem } from '@/lib/auth-helpers';
import { supabase } from '@/lib/supabase';

type Errors = Partial<Record<'name' | 'email' | 'password' | 'confirm', string>>;

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const next: Errors = {};
    if (name.trim().length < 2) next.name = 'Tell us what to call you.';
    if (!isEmail(email)) next.email = 'Enter a real email address. We send a code to it.';
    const problem = passwordProblem(password);
    if (problem) next.password = problem;
    if (confirm !== password) next.confirm = 'The passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    setFormError(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } },
    });
    setBusy(false);
    if (error) return setFormError(authMessage(error));
    // With email confirmation on (recommended), there is no session until the code is entered.
    if (!data.session) router.push(`/verify-email?email=${encodeURIComponent(email.trim())}` as Href);
  };

  return (
    <Screen
      title="Create account"
      header={<Header title="Create account" subtitle="Step 1 of 3" />}
      footer={
        <View style={styles.footer}>
          <Button label={busy ? 'Creating account...' : 'Create account'} disabled={busy} onPress={create} />
          <Button label="Already have an account? Sign in" variant="ghost" href={'/sign-in' as Href} />
        </View>
      }>
      <T variant="title">Join Real Talk Yaad</T>
      <T variant="body" color="textSecondary">
        You must be 18 or older. We will email you a code to confirm your address.
      </T>
      {formError ? <Notice tone="error" text={formError} /> : null}
      <TextField
        label="Your name"
        value={name}
        onChangeText={setName}
        error={errors.name}
        placeholder="What should we call you?"
        autoComplete="name"
        textContentType="name"
        maxLength={60}
      />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters, with letters and numbers.`}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        label="Confirm password"
        value={confirm}
        onChangeText={setConfirm}
        error={errors.confirm}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={create}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: 4 },
});
