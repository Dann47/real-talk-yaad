/**
 * What people are wearing from the Store: your card skin, frame and badge, and other people's frames and badges.
 * The rules (only wear what you own) live in the database (equip_item).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export type CardSkin = { background: string; text: string; pattern?: 'rings' | 'stripes' | 'dots' };
export type Frame = { colors: string[] };
export type Badge = { icon: string; color: string; label: string };
export type Look = { card: CardSkin | null; frame: Frame | null; badge: Badge | null };

const EMPTY: Look = { card: null, frame: null, badge: null };

function clean(row: { card: unknown; frame: unknown; badge: unknown } | undefined): Look {
  if (!row) return EMPTY;
  const card = row.card as CardSkin | null;
  const frame = row.frame as Frame | null;
  const badge = row.badge as Badge | null;
  return {
    card: card?.background ? card : null,
    frame: frame?.colors?.length ? { colors: frame.colors.slice(0, 3) } : null,
    badge: badge?.label ? badge : null,
  };
}

/* ---------- Other people (Feed) ---------- */

const people = new Map<string, Look>();

/** Frames and badges for a list of people, cached for the session. */
export function usePeopleLooks(ids: string[]) {
  const key = [...new Set(ids)].sort().join(',');
  const [, setVersion] = useState(0);
  useEffect(() => {
    const missing = key.split(',').filter((id) => id && !people.has(id));
    if (!missing.length) return;
    supabase.rpc('cosmetics_for', { people: missing }).then(({ data }) => {
      for (const id of missing) people.set(id, EMPTY);
      for (const row of (data ?? []) as { user_id: string; card: unknown; frame: unknown; badge: unknown }[]) {
        people.set(row.user_id, { ...clean(row), card: null });
      }
      setVersion((v) => v + 1);
    });
  }, [key]);
  return (id: string | null | undefined) => (id ? (people.get(id) ?? EMPTY) : EMPTY);
}

/* ---------- You ---------- */

type MyLook = Look & { refresh: () => Promise<void> };

const LookContext = createContext<MyLook>({ ...EMPTY, refresh: async () => {} });

export function CosmeticsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [look, setLook] = useState<Look>(EMPTY);

  const refresh = useCallback(async () => {
    if (!user) {
      setLook(EMPTY);
      return;
    }
    const { data } = await supabase.rpc('cosmetics_for', { people: [user.id] });
    const mine = clean((data ?? [])[0]);
    setLook(mine);
    people.set(user.id, { ...mine, card: null });
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(() => ({ ...look, refresh }), [look, refresh]);
  return <LookContext.Provider value={value}>{children}</LookContext.Provider>;
}

export function useMyLook() {
  return useContext(LookContext);
}
