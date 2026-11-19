import { useThemeSettings } from '@/theme/theme-provider';

/** The scheme the app is showing: the user's choice, or the phone's setting when on "System". */
export function useColorScheme() {
  return useThemeSettings().scheme;
}
