/** Wallet: balance, payout method, cash-out requests and history. Money rules live in the database. */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type WalletSummary = {
  /** Approved earnings minus cash-outs (paid or on the way). */
  available: number;
  /** Earned, waiting for other speakers to check. */
  pending: number;
  /** Cash-outs requested or being paid. */
  onTheWay: number;
  paidOut: number;
  lifetime: number;
  minCashout: number;
  fee: number;
  /** false: cash-outs are paid by hand for now. */
  payoutsLive: boolean;
};

export type PayoutMethod = {
  kind: 'bank' | 'lynk';
  bank_name: string | null;
  account_type: 'savings' | 'chequing' | null;
  holder_name: string;
  account_last4: string | null;
  lynk_handle: string | null;
};

export type PayoutStatus = 'requested' | 'processing' | 'paid' | 'failed' | 'cancelled';

export type Payout = {
  id: number;
  amount_jmd: number;
  fee_jmd: number;
  method: Partial<PayoutMethod>;
  status: PayoutStatus;
  note: string | null;
  created_at: string;
};

export type EarningRow = {
  task: string;
  ref_id: number;
  amount_jmd: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  detail: string | null;
};

/** Banks people can choose. Add more here. */
export const BANKS = [
  'NCB',
  'Scotiabank',
  'JN Bank',
  'Sagicor Bank',
  'CIBC Caribbean',
  'First Global Bank',
  'JMMB Bank',
  'COK Sodality',
  'Other credit union',
];

export function methodLabel(method: Partial<PayoutMethod> | null | undefined) {
  if (!method?.kind) return 'No payout method yet';
  if (method.kind === 'lynk') return `Lynk ${method.lynk_handle?.startsWith('@') ? '' : '@'}${method.lynk_handle ?? ''}`;
  return `${method.bank_name} ${method.account_type === 'chequing' ? 'chequing' : 'savings'} •••• ${method.account_last4}`;
}

const num = (v: unknown) => Number(v ?? 0) || 0;

export async function loadWallet() {
  const [summaryResult, methodResult, payoutResult, earningResult] = await Promise.all([
    supabase.rpc('wallet_summary'),
    supabase.from('payout_methods').select('kind, bank_name, account_type, holder_name, account_last4, lynk_handle').maybeSingle(),
    supabase.from('payouts').select('id, amount_jmd, fee_jmd, method, status, note, created_at').order('created_at', { ascending: false }).limit(50),
    supabase
      .from('earnings')
      .select('task, ref_id, amount_jmd, status, created_at, detail')
      .order('created_at', { ascending: false })
      .limit(150),
  ]);
  if (summaryResult.error) throw new Error('Could not load your wallet. Pull down to try again.');
  const d = (summaryResult.data ?? {}) as Record<string, unknown>;
  const summary: WalletSummary = {
    available: num(d.available),
    pending: num(d.pending),
    onTheWay: num(d.on_the_way),
    paidOut: num(d.paid_out),
    lifetime: num(d.lifetime),
    minCashout: num(d.min_cashout) || 1000,
    fee: num(d.fee),
    payoutsLive: d.payouts_live === true,
  };
  return {
    summary,
    method: (methodResult.data as PayoutMethod | null) ?? null,
    payouts: ((payoutResult.data ?? []) as Payout[]).map((p) => ({ ...p, amount_jmd: num(p.amount_jmd), fee_jmd: num(p.fee_jmd) })),
    earnings: ((earningResult.data ?? []) as EarningRow[]).map((e) => ({ ...e, amount_jmd: num(e.amount_jmd) })),
  };
}

export type WalletData = Awaited<ReturnType<typeof loadWallet>>;

export function useWallet() {
  const [data, setData] = useState<WalletData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setData(await loadWallet());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { data, error, refreshing, refresh };
}

/** Turns a database error into the message it carries (our functions raise plain sentences). */
function cleanError(message: string) {
  return message.replace(/^.*?ERROR:\s*/i, '').trim() || 'Something went wrong. Please try again.';
}

export async function savePayoutMethod(userId: string, method: PayoutMethod) {
  const { error } = await supabase
    .from('payout_methods')
    .upsert({ user_id: userId, ...method, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw new Error(`Your payout method was not saved (${cleanError(error.message)}).`);
}

export async function removePayoutMethod(userId: string) {
  const { error } = await supabase.from('payout_methods').delete().eq('user_id', userId);
  if (error) throw new Error(`Could not remove it (${cleanError(error.message)}).`);
}

export async function requestPayout(amount: number) {
  const { data, error } = await supabase.rpc('request_payout', { amount });
  if (error) throw new Error(cleanError(error.message));
  return data as Payout;
}

export async function cancelPayout(id: number) {
  const { error } = await supabase.rpc('cancel_payout', { payout_id: id });
  if (error) throw new Error(cleanError(error.message));
}

/** Which day an item belongs to, for grouping: "Today", "Yesterday", "Mon 17 Nov". */
export function dayLabel(iso: string) {
  const fmt = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Jamaica' }).format(d);
  const day = fmt(new Date(iso));
  if (day === fmt(new Date())) return 'Today';
  if (day === fmt(new Date(Date.now() - 86_400_000))) return 'Yesterday';
  return new Intl.DateTimeFormat('en-JM', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Jamaica' }).format(
    new Date(iso),
  );
}
