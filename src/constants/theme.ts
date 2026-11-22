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
    backgroundElement: '#F3F7F4',
    backgroundSelected: '#DCE5DF',
    textSecondary: '#4B5B52',
    // Accent colours are replaced at runtime by the user's choice (see useTheme).
    accent: '#0B6E4F',
    onAccent: '#FFFFFF',
    accentText: '#0B6E4F',
    accentSoft: '#DBEBE5',
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
    text: '#F4F5F7',
    background: '#0E0F12',
    backgroundElement: '#1A1C22',
    backgroundSelected: '#2A2D35',
    textSecondary: '#A3A8B3',
    accent: '#0B6E4F',
    onAccent: '#FFFFFF',
    accentText: '#4DA88A',
    accentSoft: '#0F1F19',
    reward: '#F2B705',
    onReward: '#1A1400',
    rewardSoft: '#2A230B',
    rewardText: '#F2B705',
    danger: '#FF8A80',
    media: '#22252D',
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
