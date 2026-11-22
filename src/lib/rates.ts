/** Pay rates come from the `task_rates` table, so they can change without an app update. */
import { useEffect, useState } from 'react';

import { money } from '@/lib/format';
import { supabase } from '@/lib/supabase';

export type Rate = {
  id: string;
  label: string;
  unit: string;
  amount_jmd: number;
  max_paid_per_session: number | null;
};

export type Rates = Record<string, Rate>;

let cache: Rates | null = null;
let pending: Promise<Rates> | null = null;

export function loadRates(): Promise<Rates> {
  if (cache) return Promise.resolve(cache);
  pending ??= (async () => {
    const { data, error } = await supabase
      .from('task_rates')
      .select('id, label, unit, amount_jmd, max_paid_per_session')
      .eq('active', true);
    if (error) throw error;
    const rates = Object.fromEntries((data ?? []).map((r) => [r.id, { ...r, amount_jmd: Number(r.amount_jmd) }])) as Rates;
    cache = rates;
    return rates;
  })().finally(() => {
    pending = null;
  });
  return pending;
}

/** Rates keyed by task id; empty until loaded (or if offline). */
export function useRates(): Rates {
  const [rates, setRates] = useState<Rates>(cache ?? {});
  useEffect(() => {
    let active = true;
    loadRates()
      .then((r) => active && setRates(r))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return rates;
}

/**
 * The pay label on a task: "up to J$150" for per-fix work, "J$40" for a fixed set, "J$25" for a single item.
 * Undefined while rates load, so no number is ever made up.
 */
export function payLabel(rate?: Rate): string | undefined {
  if (!rate) return undefined;
  const max = rate.max_paid_per_session ?? 1;
  const total = money(rate.amount_jmd * max, 0);
  if (rate.unit === 'fix') return `up to ${total}`;
  return total;
}

/** "J$15 per fix" style line, for explaining how a task pays. */
export function perUnitLabel(rate?: Rate): string | undefined {
  if (!rate) return undefined;
  const cap = rate.max_paid_per_session && rate.max_paid_per_session > 1 ? ` (up to ${money(rate.amount_jmd * rate.max_paid_per_session, 0)})` : '';
  return `${money(rate.amount_jmd, 0)} per ${rate.unit}${cap}`;
}
