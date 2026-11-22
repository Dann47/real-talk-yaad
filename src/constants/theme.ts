/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0F1A14',
    background: '#FFFFFF',
    backgroundElement: '#F2F7F4',
    backgroundSelected: '#DAE6E0',
    textSecondary: '#4B5B52',
    // Accent colours are replaced at runtime by the user's choice (see useTheme).
    accent: '#07805C',
    onAccent: '#FFFFFF',
    accentText: '#07805C',
    accentSoft: '#D8EDE5',
    // Money and rewards always use gold, whatever the accent.
    reward: '#F2B705',
    onReward: '#1A1400',
    rewardSoft: '#FDF3D1',
    rewardText: '#7A5B00',
    danger: '#B42318',
    media: '#1F3A2E',
    shadow: 'rgba(15, 26, 20, 0.08)',
  },
  dark: {
    // Near-black with a faint jade tint: the accent and gold glow against it.
    text: '#F2F5F3',
    background: '#0A0F0D',
    backgroundElement: '#121A17',
    backgroundSelected: '#1E2925',
    textSecondary: '#9AA8A1',
    accent: '#07805C',
    onAccent: '#FFFFFF',
    accentText: '#3FC79A',
    accentSoft: '#0E1E18',
    reward: '#F2B705',
    onReward: '#1A1400',
    rewardSoft: '#2A230B',
    rewardText: '#F2B705',
    danger: '#FF8A80',
    media: '#16201C',
    shadow: 'rgba(0, 0, 0, 0)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 800;
