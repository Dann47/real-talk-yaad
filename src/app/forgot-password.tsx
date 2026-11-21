import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Header, Notice, Screen, T, TextField } from '@/components/kit';
import { MIN_PASSWORD_LENGTH, authMessage, isEmail, passwordProblem } from '@/lib/auth-helpers';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    if (!isEmail(email)) return setError('Enter the email you signed up with.');
    setBusy(true);
    setError(null);
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(email.trim());
    setBusy(false);
    if (sendError) return setError(authMessage(sendError));
    setStep('reset');
  };

  const reset = async () => {
    const problem = passwordProblem(password);
    if (code.replace(/\D/g, '').length < 6) return setError('Enter the code from the email.');
    if (problem) return setError(problem);
    if (password !== confirm) return setError('The passwords do not match.');
    setBusy(true);
    setError(null);
    const { error: codeError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.replace(/\D/g, ''),
      type: 'recovery',
    });
    if (codeError) {
      setBusy(false);
      return setError(authMessage(codeError));
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) return setError(authMessage(updateError));
    setStep('done');
  };

  return (
    <Screen
      title="Reset password"
      header={<Header title="Reset password" />}
      footer={
        step === 'email' ? (
          <Button label={busy ? 'Sending...' : 'Send me a code'} disabled={busy} onPress={sendCode} />
        ) : step === 'reset' ? (
          <View style={styles.footer}>
            <Button label={busy ? 'Saving...' : 'Save new password'} disabled={busy} onPress={reset} />
            <Button label="Use a different email" variant="ghost" onPress={() => setStep('email')} />
          </View>
        ) : (
          <Button label="Continue" onPress={() => router.replace('/' as Href)} />
        )
      }>
      {step === 'email' ? (
        <>
          <T variant="title">Forgot your password?</T>
          <T variant="body" color="textSecondary">
            Enter your email and we will send you a code to set a new password.
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
            returnKeyType="go"
            onSubmitEditing={sendCode}
          />
        </>
      ) : step === 'reset' ? (
        <>
          <T variant="title">Set a new password</T>
          <Notice text={`If an account exists for ${email.trim()}, we sent it a code. Check your spam folder too.`} />
          {error ? <Notice tone="error" text={error} /> : null}
          <TextField
            label="Code"
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={10}
          />
          <TextField
            label="New password"
            value={password}
            onChangeText={setPassword}
            hint={`At least ${MIN_PASSWORD_LENGTH} characters, with letters and numbers.`}
            secure
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <TextField
            label="Confirm new password"
            value={confirm}
            onChangeText={setConfirm}
            secure
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={reset}
          />
        </>
      ) : (
        <>
          <T variant="title">Password changed</T>
          <Notice tone="success" text="Your new password is saved and you are signed in." />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: 4 },
});
