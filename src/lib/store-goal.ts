/**
 * The Store item you're saving for. You pick it in the Store ("Save up for this"); it shows on Home and Wallet
 * with your progress. Saved on this phone.
 */
import { useSyncExternalStore } from 'react';

import { storage } from '@/theme/storage';

const KEY = 'store.goal';
let goal: number | null = Number(storage.get(KEY)) || null;
const listeners = new Set<() => void>();

export function setStoreGoal(id: number | null) {
  goal = id;
  storage.set(KEY, id ? String(id) : '');
  listeners.forEach((l) => l());
}

export function useStoreGoal(): [number | null, (id: number | null) => void] {
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => goal,
    () => goal,
  );
  return [value, setStoreGoal];
}
