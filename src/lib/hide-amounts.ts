/**
 * "Hide my balance": one setting for the whole app (Home, Work, Wallet, Me).
 * Saved on the phone, and every screen showing money updates the moment it changes.
 */
import { useSyncExternalStore } from 'react';

import { storage } from '@/theme/storage';

const KEY = 'wallet.hideBalance';
/** What a hidden amount looks like. */
export const HIDDEN = 'J$ ••••';

let hidden = storage.get(KEY) === '1';
const listeners = new Set<() => void>();

export function setAmountsHidden(value: boolean) {
  hidden = value;
  storage.set(KEY, value ? '1' : '0');
  listeners.forEach((listener) => listener());
}

/** [hidden, toggle]. */
export function useHideAmounts(): [boolean, () => void] {
  const value = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => hidden,
    () => hidden,
  );
  return [value, () => setAmountsHidden(!hidden)];
}
