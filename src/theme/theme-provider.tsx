import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { DEFAULT_ACCENT, OLD_DEFAULT_ACCENTS, normalizeHex } from './accent';
import { storage } from './storage';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ColorSchemeName = 'light' | 'dark';

type ThemeSettings = {
  /** What the user chose: follow the phone, or always light / dark. */
  preference: ThemePreference;
  /** The scheme actually showing right now. */
  scheme: ColorSchemeName;
  accent: string;
  setPreference: (preference: ThemePreference) => void;
  /** Returns false when the colour is not a valid hex value. */
  setAccent: (hex: string) => boolean;
  resetAccent: () => void;
};

const MODE_KEY = 'rty.theme.mode';

/** A fresh install opens in dark mode: the work and social screens (and every accent) are designed dark-first. */
export const DEFAULT_PREFERENCE: ThemePreference = 'dark';
const ACCENT_KEY = 'rty.theme.accent';

const ThemeSettingsContext = createContext<ThemeSettings | null>(null);

function savedPreference(): ThemePreference {
  const value = storage.get(MODE_KEY);
  return value === 'light' || value === 'dark' || value === 'system' ? value : DEFAULT_PREFERENCE;
}

function savedAccent(): string {
  const saved = normalizeHex(storage.get(ACCENT_KEY) ?? '');
  // Someone still on an old default gets the new one; a colour they picked themselves is kept.
  if (!saved || OLD_DEFAULT_ACCENTS.includes(saved)) return DEFAULT_ACCENT;
  return saved;
}

export function ThemeSettingsProvider({ children }: { children: ReactNode }) {
  const system = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(savedPreference);
  const [accent, setAccentState] = useState<string>(savedAccent);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    storage.set(MODE_KEY, next);
  }, []);

  const setAccent = useCallback((hex: string) => {
    const value = normalizeHex(hex);
    if (!value) return false;
    setAccentState(value);
    storage.set(ACCENT_KEY, value);
    return true;
  }, []);

  const resetAccent = useCallback(() => {
    setAccentState(DEFAULT_ACCENT);
    storage.set(ACCENT_KEY, DEFAULT_ACCENT);
  }, []);

  const scheme: ColorSchemeName =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo(
    () => ({ preference, scheme, accent, setPreference, setAccent, resetAccent }),
    [preference, scheme, accent, setPreference, setAccent, resetAccent],
  );

  return <ThemeSettingsContext.Provider value={value}>{children}</ThemeSettingsContext.Provider>;
}

export function useThemeSettings(): ThemeSettings {
  const settings = useContext(ThemeSettingsContext);
  if (!settings) {
    throw new Error('useThemeSettings must be used inside <ThemeSettingsProvider>.');
  }
  return settings;
}
