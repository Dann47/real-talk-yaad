// Saves small settings in the browser.
const hasStorage = () => typeof window !== 'undefined' && !!window.localStorage;

export const storage = {
  get(key: string): string | null {
    try {
      return hasStorage() ? window.localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      if (hasStorage()) window.localStorage.setItem(key, value);
    } catch {
      // Storage blocked (private mode): the setting still applies for this visit.
    }
  },
};
