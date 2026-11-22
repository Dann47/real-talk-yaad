/** Live earnings for the Home screen, from the home_summary() database function. */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type HomeSummary = {
  balance: number;
  pending: number;
  today: number;
  thisWeek: number;
  weekGoal: number;
  approvedCount: number;
  reviewedCount: number;
  totalCount: number;
  todayByTask: Record<string, number>;
  streakDays: number;
};

/** Levels go up with approved work. */
export const LEVELS = [
  { level: 1, name: 'New Voice', from: 0 },
  { level: 2, name: 'Yaad Learner', from: 25 },
  { level: 3, name: 'Trusted Teacher', from: 100 },
  { level: 4, name: 'Big Teacher', from: 300 },
  { level: 5, name: 'Patois Champion', from: 750 },
];

export function levelFor(approved: number) {
  const index = LEVELS.findLastIndex((l) => approved >= l.from);
  const current = LEVELS[Math.max(0, index)];
  const next = LEVELS[index + 1] ?? null;
  const progress = next ? (approved - current.from) / (next.from - current.from) : 1;
  return { ...current, next, toNext: next ? next.from - approved : 0, progress };
}

/** Today's date in Jamaica, as YYYY-MM-DD. */
function jamaicaDay(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Jamaica' }).format(date);
}

/** Days in a row with any work, counting back from today (or yesterday, so a streak isn't lost before you work today). */
function streakFrom(days: string[]) {
  const set = new Set(days);
  let offset = set.has(jamaicaDay(0)) ? 0 : -1;
  let streak = 0;
  while (set.has(jamaicaDay(offset))) {
    streak += 1;
    offset -= 1;
  }
  return streak;
}

export async function loadHomeSummary(): Promise<HomeSummary> {
  const { data, error } = await supabase.rpc('home_summary');
  if (error) throw new Error('Could not load your earnings. Pull down to try again.');
  const d = (data ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => Number(v ?? 0) || 0;
  return {
    balance: num(d.balance),
    pending: num(d.pending),
    today: num(d.today),
    thisWeek: num(d.this_week),
    weekGoal: num(d.week_goal) || 1000,
    approvedCount: num(d.approved_count),
    reviewedCount: num(d.reviewed_count),
    totalCount: num(d.total_count),
    todayByTask: (d.today_by_task as Record<string, number>) ?? {},
    streakDays: streakFrom((d.active_days as string[]) ?? []),
  };
}

/** Loads the summary and refreshes it whenever the screen comes back into view. */
export function useHomeSummary() {
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setSummary(await loadHomeSummary());
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

  return { summary, error, refreshing, refresh };
}
