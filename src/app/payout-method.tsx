import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Appear, Button, Card, Header, Icon, IconTile, Notice, Screen, SectionHeader, T, TextField, goBack, type IconName } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';
import { displayName, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { BANKS, methodLabel, removePayoutMethod, savePayoutMethod, type PayoutMethod } from '@/lib/wallet';

function Choice({ label, selected, onPress, icon }: { label: string; selected: boolean; onPress: () => void; icon?: IconName }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: selected ? theme.accent : theme.backgroundElement,
          borderColor: selected ? theme.accent : theme.backgroundSelected,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}>
      {icon || selected ? <Icon name={selected ? 'check' : icon!} size={14} color={selected ? theme.onAccent : theme.accentText} /> : null}
      <T variant="smallStrong" style={{ color: selected ? theme.onAccent : theme.text }}>
        {label}
      </T>
    </Pressable>
  );
}

export default function PayoutMethodScreen() {
  const theme = useTheme();
  const { user, profile } = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();

  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<PayoutMethod | null>(null);
  const [kind, setKind] = useState<'bank' | 'lynk'>('bank');
  const [bank, setBank] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<'savings' | 'chequing'>('savings');
  const [holder, setHolder] = useState(displayName(profile, user));
  const [last4, setLast4] = useState('');
  const [lynk, setLynk] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('payout_methods')
      .select('kind, bank_name, account_type, holder_name, account_last4, lynk_handle')
      .maybeSingle()
      .then(({ data }) => {
        const m = data as PayoutMethod | null;
        if (m) {
          setExisting(m);
          setKind(m.kind);
          setBank(m.bank_name);
          setAccountType(m.account_type ?? 'savings');
          setHolder(m.holder_name);
          setLast4(m.account_last4 ?? '');
          setLynk(m.lynk_handle ?? '');
        }
        setLoading(false);
      });
  }, []);

  const save = async () => {
    if (!user) return;
    const name = holder.trim().replace(/\s+/g, ' ');
    if (name.length < 2) return setError('Enter the name on the account.');
    let method: PayoutMethod;
    if (kind === 'bank') {
      if (!bank) return setError('Choose your bank.');
      if (!/^\d{4}$/.test(last4)) return setError('Enter the last 4 digits of your account number.');
      method = { kind, bank_name: bank, account_type: accountType, holder_name: name, account_last4: last4, lynk_handle: null };
    } else {
      const handle = lynk.trim().replace(/^@/, '');
      if (!/^[A-Za-z0-9_.]{2,30}$/.test(handle)) return setError('Enter your Lynk handle, like @yaadteacher.');
      method = { kind, bank_name: null, account_type: null, holder_name: name, account_last4: null, lynk_handle: `@${handle}` };
    }
    setSaving(true);
    setError(null);
    try {
      await savePayoutMethod(user.id, method);
      if (next === 'cash-out') router.replace('/cash-out' as Href);
      else goBack();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await removePayoutMethod(user.id);
      goBack();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen title="Payout method" header={<Header title="Payout method" />}>
        <ActivityIndicator color={theme.accentText} />
      </Screen>
    );
  }

  const preview: PayoutMethod =
    kind === 'bank'
      ? { kind, bank_name: bank ?? 'Your bank', account_type: accountType, holder_name: holder, account_last4: last4.padEnd(4, '•'), lynk_handle: null }
      : { kind, bank_name: null, account_type: null, holder_name: holder, account_last4: null, lynk_handle: lynk || 'yourhandle' };

  return (
    <Screen
      title="Payout method"
      header={<Header title="Payout method" subtitle={existing ? 'Change where your money goes' : 'Where should we send your money?'} />}
      footer={<Button label={saving ? 'Saving...' : next === 'cash-out' ? 'Save and continue' : 'Save payout method'} icon="check" disabled={saving} onPress={save} />}>
      <Appear>
        <Card tone="hero" style={styles.preview}>
          <View style={styles.previewTop}>
            <T variant="overline" style={{ color: theme.onAccent, opacity: 0.85 }}>
              {kind === 'bank' ? 'Bank account' : 'Lynk wallet'}
            </T>
            <Icon name={kind === 'bank' ? 'wallet' : 'bolt'} size={20} color={theme.onAccent} />
          </View>
          <T variant="title" style={{ color: theme.onAccent }}>
            {methodLabel(preview)}
          </T>
          <T variant="small" style={{ color: theme.onAccent }}>
            {holder.trim() || 'Name on the account'}
          </T>
        </Card>
      </Appear>

      {error ? <Notice tone="error" text={error} /> : null}

      <Appear index={1} style={styles.kinds}>
        {(
          [
            { id: 'bank', title: 'Bank account', detail: 'Any Jamaican bank or credit union', icon: 'wallet' },
            { id: 'lynk', title: 'Lynk', detail: 'Straight to your Lynk wallet', icon: 'bolt' },
          ] as const
        ).map((k) => {
          const on = kind === k.id;
          return (
            <Pressable
              key={k.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => {
                setKind(k.id);
                setError(null);
              }}
              style={({ pressed }) => [
                styles.kind,
                { backgroundColor: on ? theme.accentSoft : theme.backgroundElement, borderColor: on ? theme.accent : theme.backgroundSelected, transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}>
              <IconTile icon={k.icon} size={36} />
              <T variant="bodyStrong">{k.title}</T>
              <T variant="caption" color="textSecondary">
                {k.detail}
              </T>
            </Pressable>
          );
        })}
      </Appear>

      {kind === 'bank' ? (
        <>
          <Appear index={2}>
            <SectionHeader title="Bank" />
          </Appear>
          <Appear index={2} style={styles.choices}>
            {BANKS.map((b) => (
              <Choice key={b} label={b} selected={bank === b} onPress={() => setBank(b)} />
            ))}
          </Appear>
          <Appear index={3} style={styles.choices}>
            <Choice label="Savings" selected={accountType === 'savings'} onPress={() => setAccountType('savings')} />
            <Choice label="Chequing" selected={accountType === 'chequing'} onPress={() => setAccountType('chequing')} />
          </Appear>
          <Appear index={4} style={styles.fields}>
            <TextField label="Name on the account" value={holder} onChangeText={setHolder} autoCapitalize="words" maxLength={80} />
            <TextField
              label="Last 4 digits of the account number"
              value={last4}
              onChangeText={(t) => setLast4(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="1234"
              hint="So you can tell which account it is"
            />
          </Appear>
        </>
      ) : (
        <Appear index={2} style={styles.fields}>
          <TextField
            label="Lynk handle"
            value={lynk}
            onChangeText={(t) => setLynk(t.replace(/\s/g, ''))}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={31}
            placeholder="@yaadteacher"
          />
          <TextField label="Name on the Lynk account" value={holder} onChangeText={setHolder} autoCapitalize="words" maxLength={80} />
        </Appear>
      )}

      <Appear index={5}>
        <Card tone="soft" style={styles.safe}>
          <Icon name="shield" size={18} color={theme.accentText} />
          <T variant="small" style={styles.flex}>
            We never keep your full account number in the app. When automatic payouts start, our licensed payment partner
            will ask for it once and keep it safe. Until then, cash-outs are paid by hand and we confirm the full details
            with you by email before your first payment.
          </T>
        </Card>
      </Appear>

      {existing ? <Button label="Remove payout method" variant="ghost" disabled={saving} onPress={remove} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  preview: { gap: 6, padding: 20 },
  previewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kinds: { flexDirection: 'row', gap: 10 },
  kind: { flex: 1, gap: 4, padding: 14, borderRadius: 20, borderWidth: 1.5 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5 },
  fields: { gap: 14 },
  safe: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
});
