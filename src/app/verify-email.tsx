import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Header, Notice, Screen, T, TextField } from '@/components/kit';
import { authMessage } from '@/lib/auth-helpers';
import { supabase } from '@/lib/supabase';

const RESEND_WAIT = 60;

export default function VerifyEmailScreen() {
  const { email = '', sent } = useLocalSearchParams<{ email?: string; sent?: string }>();
  const justSent = sent !== '0';
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [wait, setWait] = useState(justSent ? RESEND_WAIT : 0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const verify = async () => {
    const token = code.replace(/\D/g, '');
    if (token.length < 6) return setMessage({ tone: 'error', text: 'Enter the code from the email.' });
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    setBusy(false);
    // On success the app moves on to the consent step by itself.
    if (error) setMessage({ tone: 'error', text: authMessage(error) });
  };

  const resend = async () => {
    setMessage(null);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) return setMessage({ tone: 'error', text: authMessage(error) });
    setWait(RESEND_WAIT);
    setMessage({ tone: 'success', text: 'New code sent. Check your inbox and spam folder.' });
  };

  return (
    <Screen
      title="Confirm your email"
      header={<Header title="Confirm your email" subtitle="Step 1 of 3" />}
      footer={
        <View style={styles.footer}>
          <Button label={busy ? 'Checking...' : 'Confirm'} disabled={busy} onPress={verify} />
          <Button
            label={wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
            variant="ghost"
            disabled={wait > 0}
            onPress={resend}
          />
        </View>
      }>
      <T variant="title">Check your email</T>
      <T variant="body" color="textSecondary">
        {justSent
          ? `We sent a code to ${email || 'your email'}. Enter it below.`
          : `Your email ${email} is not confirmed yet. Use the code we sent, or ask for a new one.`}
      </T>
      {message ? <Notice tone={message.tone} text={message.text} /> : null}
      <TextField
        label="Code"
        value={code}
        onChangeText={setCode}
        placeholder="123456"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={10}
        returnKeyType="go"
        onSubmitEditing={verify}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: 4 },
});
