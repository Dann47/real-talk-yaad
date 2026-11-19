import { storage } from '@/theme/storage';

const KEY = 'rty.onboarded';

/** True once the user has accepted the consent screen on this device. */
export function hasOnboarded(): boolean {
  return storage.get(KEY) === 'yes';
}

export function completeOnboarding() {
  storage.set(KEY, 'yes');
}

/** For testing: show the welcome screens again. */
export function resetOnboarding() {
  storage.set(KEY, 'no');
}
