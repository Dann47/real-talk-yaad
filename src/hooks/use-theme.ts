/**
 * Current theme colours: light or dark base colours plus the user's accent.
 * Inside a store card skin, a few colours are swapped (see theme/override.tsx).
 * Learn more about light and dark modes: https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { accentColors } from '@/theme/accent';
import { useColorOverride } from '@/theme/override';
import { useThemeSettings } from '@/theme/theme-provider';

export function useTheme() {
  const { scheme, accent } = useThemeSettings();
  const override = useColorOverride();
  const base = Colors[scheme];
  const colors = { ...base, ...accentColors(accent, base.background) };
  return override ? { ...colors, ...override } : colors;
}
