import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Header, Notice, Screen, T, TextField } from '@/components/kit';
import { authMessage, isEmail } from '@/lib/auth-helpers';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    if (!isEmail(email)) return setError('Enter the email you signed up with.');
    if (!password) return setError('Enter your password.');
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (!signInError) return; // The app moves on by itself once signed in.
    if (signInError.message.toLowerCase().includes('email not confirmed')) {
      router.push(`/verify-email?email=${encodeURIComponent(email.trim())}&sent=0` as Href);
      return;
    }
    setError(authMessage(signInError));
  };

  return (
    <Screen
      title="Sign in"
      header={<Header title="Sign in" />}
      footer={
        <View style={styles.footer}>
          <Button label={busy ? 'Signing in...' : 'Sign in'} disabled={busy} onPress={signIn} />
          <Button label="New here? Create an account" variant="ghost" href={'/sign-up' as Href} />
        </View>
      }>
      <T variant="title">Welcome back</T>
      <T variant="body" color="textSecondary">
        Sign in to keep teaching and earning.
      </T>
      {error ? <Notice tone="error" text={error} /> : null}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secure
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={signIn}
      />
      <Button label="Forgot your password?" variant="ghost" compact style={styles.start} href={'/forgot-password' as Href} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: 4 },
  start: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
