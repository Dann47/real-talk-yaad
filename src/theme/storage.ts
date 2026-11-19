// Saves small settings on the phone. expo-sqlite provides localStorage on iOS and Android.
import 'expo-sqlite/localStorage/install';

export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage unavailable: the setting still applies until the app closes.
    }
  },
};
