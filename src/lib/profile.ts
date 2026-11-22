/** The Me screen: profile details, lifetime stats and the weekly leaderboard. */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { supabase } from '@/lib/supabase';

/** Must match the list in migration 20261121070000_me_screen.sql. */
export const PARISHES = [
  'Kingston',
  'St. Andrew',
  'St. Catherine',
  'Clarendon',
  'Manchester',
  'St. Elizabeth',
  'Westmoreland',
  'Hanover',
  'St. James',
  'Trelawny',
  'St. Ann',
  'St. Mary',
  'Portland',
  'St. Thomas',
] as const;

export const WEEK_GOALS = [500, 1000, 2500, 5000];

/** Why a handle can't be used, or null. Same rule as the database. */
export function handleProblem(handle: string): string | null {
  if (!handle) return null; // a handle is optional
  if (!/^[a-z0-9_]{3,24}$/.test(handle)) return 'Use 3 to 24 small letters, numbers or _ (no spaces).';
  return null;
}

export type TaskStats = { count: number; approved: number; earned: number };

export type MeSummary = {
  tasksDone: number;
  approvedCount: number;
  reviewedCount: number;
  earnedTotal: number;
  pendingTotal: number;
  votesMatched: number;
  votesSettled: number;
  byTask: Record<string, TaskStats>;
};

export type Activity = {
  task: string;
  ref_id: number;
  amount_jmd: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  detail: string | null;
};

export type DayBar = { day: string; label: string; amount: number; count: number; isToday: boolean };

/** Jamaica date (YYYY-MM-DD) for a time. */
function jamaicaDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Jamaica' }).format(date);
}

/** The last 7 days (oldest first) with what you earned (approved or waiting) each day. */
export function lastSevenDays(activity: Activity[]): DayBar[] {
  const today = jamaicaDate(new Date());
  const days: DayBar[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86_400_000);
    const day = jamaicaDate(date);
    const label = new Intl.DateTimeFormat('en-JM', { weekday: 'narrow', timeZone: 'America/Jamaica' }).format(date);
    days.push({ day, label, amount: 0, count: 0, isToday: day === today });
  }
  const byDay = new Map(days.map((d) => [d.day, d]));
  for (const a of activity) {
    const bar = byDay.get(jamaicaDate(new Date(a.created_at)));
    if (!bar) continue;
    bar.count += 1;
    if (a.status !== 'rejected') bar.amount += a.amount_jmd;
  }
  return days;
}

/** Days in a row with any work, counting back from today (or yesterday). */
export function streakDays(activity: Activity[]) {
  const set = new Set(activity.map((a) => jamaicaDate(new Date(a.created_at))));
  let offset = set.has(jamaicaDate(new Date())) ? 0 : 1;
  let streak = 0;
  while (set.has(jamaicaDate(new Date(Date.now() - offset * 86_400_000)))) {
    streak += 1;
    offset += 1;
  }
  return streak;
}

export type Badge = { id: string; title: string; detail: string; icon: 'mic' | 'chat' | 'check' | 'flame' | 'sparkles' | 'waveform' | 'trend' | 'video'; earned: boolean; progress: number };

/** Badges worked out from your stats (nothing stored). */
export function badgesFor(summary: MeSummary, streak: number): Badge[] {
  const t = (id: string) => summary.byTask[id] ?? { count: 0, approved: 0, earned: 0 };
  const fixes = t('talk').count + t('voice').count;
  const list: (Omit<Badge, 'earned' | 'progress'> & { have: number; need: number })[] = [
    { id: 'first', title: 'First steps', detail: 'Do your first task', icon: 'sparkles', have: summary.tasksDone, need: 1 },
    { id: 'fixer', title: 'Fixer', detail: 'Fix the AI 10 times', icon: 'chat', have: fixes, need: 10 },
    { id: 'voice', title: 'Golden voice', detail: 'Record 25 lines', icon: 'waveform', have: t('record').count, need: 25 },
    { id: 'teacher', title: 'Storyteller', detail: 'Describe 10 posts', icon: 'video', have: t('teach').count, need: 10 },
    { id: 'judge', title: 'Sharp ears', detail: 'Match 20 votes', icon: 'check', have: summary.votesMatched, need: 20 },
    { id: 'streak', title: 'On a roll', detail: '7-day streak', icon: 'flame', have: streak, need: 7 },
    { id: 'earner', title: 'Big earner', detail: 'Earn J$1,000', icon: 'trend', have: summary.earnedTotal, need: 1000 },
  ];
  return list.map(({ have, need, ...badge }) => ({ ...badge, earned: have >= need, progress: Math.min(1, have / need) }));
}

export type LeaderRow = { rank: number; name: string; approved: number; is_me: boolean; scope: string };

type MeData = { summary: MeSummary; leaders: LeaderRow[]; activity: Activity[] };

export async function loadMe(): Promise<MeData> {
  const since = new Date(Date.now() - 45 * 86_400_000).toISOString();
  const [summaryResult, boardResult, activityResult] = await Promise.all([
    supabase.rpc('me_summary'),
    supabase.rpc('leaderboard'),
    supabase
      .from('earnings')
      .select('task, ref_id, amount_jmd, status, created_at, detail')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);
  if (summaryResult.error) throw new Error('Could not load your stats. Pull down to try again.');
  const d = (summaryResult.data ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => Number(v ?? 0) || 0;
  const rawTasks = (d.by_task ?? {}) as Record<string, Record<string, unknown>>;
  const byTask = Object.fromEntries(
    Object.entries(rawTasks).map(([task, t]) => [task, { count: num(t.count), approved: num(t.approved), earned: num(t.earned) }]),
  );
  return {
    summary: {
      tasksDone: num(d.tasks_done),
      approvedCount: num(d.approved_count),
      reviewedCount: num(d.reviewed_count),
      earnedTotal: num(d.earned_total),
      pendingTotal: num(d.pending_total),
      votesMatched: num(d.votes_matched),
      votesSettled: num(d.votes_settled),
      byTask,
    },
    // The leaderboard is a nice-to-have: if it fails, the rest of the screen still shows.
    leaders: ((boardResult.data ?? []) as LeaderRow[]).map((r) => ({ ...r, approved: Number(r.approved) })),
    activity: ((activityResult.data ?? []) as Activity[]).map((a) => ({ ...a, amount_jmd: Number(a.amount_jmd) })),
  };
}

export function useMe() {
  const [data, setData] = useState<MeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setData(await loadMe());
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

  return { ...data, error, refreshing, refresh };
}

/** 18400 → "J$18.4k", 950 → "J$950". */
export function shortMoney(amount: number) {
  if (amount >= 1_000_000) return `J$${(amount / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (amount >= 1000) return `J$${(amount / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `J$${Math.round(amount)}`;
}
