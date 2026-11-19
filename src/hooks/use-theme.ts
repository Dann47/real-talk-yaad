/**
 * Current theme colours: light or dark base colours plus the user's accent.
 * Learn more about light and dark modes: https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { accentColors } from '@/theme/accent';
import { useThemeSettings } from '@/theme/theme-provider';

export function useTheme() {
  const { scheme, accent } = useThemeSettings();
  const base = Colors[scheme];
  return { ...base, ...accentColors(accent, base.background) };
}
