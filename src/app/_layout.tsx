import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useMemo, type ReactNode } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useTheme } from '@/hooks/use-theme';
import { ThemeSettingsProvider, useThemeSettings } from '@/theme/theme-provider';

SplashScreen.preventAutoHideAsync();

function NavigationTheme({ children }: { children: ReactNode }) {
  const { scheme } = useThemeSettings();
  const theme = useTheme();

  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.accentText,
        background: theme.background,
        card: theme.background,
        text: theme.text,
      },
    };
  }, [scheme, theme.accentText, theme.background, theme.text]);

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {children}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeSettingsProvider>
      <NavigationTheme>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
          <Stack.Screen name="consent" />
          <Stack.Screen name="talk" />
          <Stack.Screen name="voice" />
          <Stack.Screen name="record" />
          <Stack.Screen name="verify" />
          <Stack.Screen name="store" />
          <Stack.Screen name="settings" />
        </Stack>
      </NavigationTheme>
    </ThemeSettingsProvider>
  );
}
