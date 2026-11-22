import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Confetti } from '@/components/celebrate';
import { Appear, Button, Card, Header, Icon, IconTile, Notice, Screen, T, goBack, inputText } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';
import { money } from '@/lib/format';
import { loadWallet, methodLabel, requestPayout, type Payout, type WalletData } from '@/lib/wallet';

export default function CashOutScreen() {
  const theme = useTheme();
  const [data, setData] = useState<WalletData | null>(null);
  const [amountText, setAmountText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<Payout | null>(null);

  useEffect(() => {
    loadWallet()
      .then((wallet) => {
        setData(wallet);
        setAmountText(String(Math.floor(wallet.summary.available)));
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  if (!data) {
    return (
      <Screen title="Cash out" header={<Header title="Cash out" />}>
        {error ? <Notice tone="error" text={error} /> : <ActivityIndicator color={theme.accentText} />}
      </Screen>
    );
  }

  const { summary, method } = data;
  const amount = Number(amountText.replace(/[^\d.]/g, '')) || 0;
  const receive = Math.max(0, amount - summary.fee);
  const quick = [
    { label: 'Smallest', value: summary.minCashout },
    { label: 'Half', value: Math.floor(summary.available / 2) },
    { label: 'Everything', value: Math.floor(summary.available * 100) / 100 },
  ].filter((q) => q.value >= summary.minCashout && q.value <= summary.available);
  const problem =
    amount < summary.minCashout
      ? `The smallest cash-out is ${money(summary.minCashout, 0)}.`
      : amount > summary.available
        ? `You have ${money(summary.available)} available.`
        : null;

  const confirm = async () => {
    if (problem) return setError(problem);
    setSending(true);
    setError(null);
    try {
      setDone(await requestPayout(amount));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  /* ---------- Requested ---------- */
  if (done) {
    return (
      <Screen title="Cash out" header={<Header title="Cash out" back={false} />} footer={<Button label="Back to wallet" onPress={() => router.replace('/wallet' as Href)} />}>
        <Confetti burst={1} />
        <Appear>
          <Card tone="hero" style={styles.doneCard}>
            <View style={[styles.doneIcon, { backgroundColor: theme.reward }]}>
              <Icon name="check" size={28} color={theme.onReward} />
            </View>
            <T variant="overline" style={{ color: theme.onAccent }}>
              Cash-out requested
            </T>
            <T variant="display" style={{ color: theme.onAccent }}>
              {money(done.amount_jmd - done.fee_jmd)}
            </T>
            <T variant="body" style={{ color: theme.onAccent, textAlign: 'center' }}>
              On its way to {methodLabel(done.method)}.
            </T>
          </Card>
        </Appear>
        <Appear index={1}>
          <Card tone="soft" style={styles.note}>
            <Icon name="sparkles" size={18} color={theme.accentText} />
            <T variant="small" style={styles.flex}>
              {summary.payoutsLive
                ? 'Payouts usually arrive within 1 to 3 working days. You can follow it in your wallet.'
                : "During testing, cash-outs are paid by hand. We'll email you to confirm your account details, then it changes to Paid in your wallet."}
            </T>
          </Card>
        </Appear>
      </Screen>
    );
  }

  /* ---------- Choose an amount ---------- */
  return (
    <Screen
      title="Cash out"
      header={<Header title="Cash out" subtitle={`${money(summary.available)} available`} />}
      footer={
        <Button
          label={sending ? 'Requesting...' : `Cash out ${money(receive, 0)}`}
          icon="cashout"
          variant="reward"
          disabled={sending || !!problem || !method}
          onPress={confirm}
        />
      }>
      <Appear>
        <Card style={styles.amountCard}>
          <T variant="overline" color="textSecondary">
            How much?
          </T>
          <View style={styles.amountRow}>
            <T variant="display" color="textSecondary">
              J$
            </T>
            <TextInput
              accessibilityLabel="Amount to cash out in Jamaican dollars"
              value={amountText}
              onChangeText={(t) => {
                setAmountText(t.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'));
                setError(null);
              }}
              keyboardType="decimal-pad"
              maxLength={10}
              style={[
                styles.amountInput,
                inputText,
                { color: problem ? theme.danger : theme.text },
                Platform.OS === 'web' && ({ outlineWidth: 0 } as object),
              ]}
            />
          </View>
          <View style={styles.quick}>
            {quick.map((q) => {
              const on = amount === q.value;
              return (
                <Pressable
                  key={q.label}
                  accessibilityRole="button"
                  onPress={() => {
                    setAmountText(String(q.value));
                    setError(null);
                  }}
                  style={[styles.quickChip, { backgroundColor: on ? theme.accent : theme.background, borderColor: on ? theme.accent : theme.backgroundSelected }]}>
                  <T variant="caption" style={{ color: on ? theme.onAccent : theme.textSecondary }}>
                    {q.label}
                  </T>
                  <T variant="smallStrong" style={{ color: on ? theme.onAccent : theme.text }}>
                    {money(q.value, 0)}
                  </T>
                </Pressable>
              );
            })}
          </View>
          {problem ? (
            <T variant="caption" style={{ color: theme.danger }}>
              {problem}
            </T>
          ) : null}
        </Card>
      </Appear>

      {error ? <Notice tone="error" text={error} /> : null}

      <Appear index={1}>
        <Card style={styles.breakdown}>
          {[
            { label: 'Cash out', value: money(amount) },
            { label: 'Fee', value: summary.fee ? `−${money(summary.fee)}` : 'Free' },
          ].map((row) => (
            <View key={row.label} style={styles.breakRow}>
              <T variant="body" color="textSecondary">
                {row.label}
              </T>
              <T variant="bodyStrong">{row.value}</T>
            </View>
          ))}
          <View style={[styles.breakRow, styles.breakTotal, { borderTopColor: theme.backgroundSelected }]}>
            <T variant="bodyStrong">You get</T>
            <T variant="title" color="rewardText">
              {money(receive)}
            </T>
          </View>
        </Card>
      </Appear>

      <Appear index={2}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change payout method"
          onPress={() => router.push('/payout-method' as Href)}
          style={[styles.method, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
          <IconTile icon="wallet" size={38} />
          <View style={styles.flex}>
            <T variant="caption" color="textSecondary">
              Sending to
            </T>
            <T variant="bodyStrong">{methodLabel(method)}</T>
          </View>
          <T variant="smallStrong" color="accentText">
            Change
          </T>
        </Pressable>
      </Appear>

      <T variant="caption" color="textSecondary">
        The money leaves your available balance now. If a cash-out fails or you cancel it before it starts, it goes straight back.
      </T>
      <Button label="Not now" variant="ghost" onPress={goBack} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  amountCard: { gap: 12, padding: 20 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  amountInput: { flex: 1, fontSize: 40, fontWeight: '700', paddingVertical: 4 },
  quick: { flexDirection: 'row', gap: 8 },
  quickChip: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 10, borderRadius: 16, borderWidth: 1.5 },
  breakdown: { gap: 10 },
  breakRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  breakTotal: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 2 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, borderWidth: 1 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  doneCard: { alignItems: 'center', gap: 6, padding: 26 },
  doneIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
});
