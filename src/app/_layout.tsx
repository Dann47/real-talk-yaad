import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, type ReactNode } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useTheme } from '@/hooks/use-theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ThemeSettingsProvider, useThemeSettings } from '@/theme/theme-provider';

SplashScreen.preventAutoHideAsync();

function NavigationTheme({ children }: { children: ReactNode }) {
  const { scheme } = useThemeSettings();
  const theme = useTheme();

  // The phone's own window colour shows for a moment while pages slide. Match it to the theme so
  // there's no white flash between pages (Android especially).
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.background).catch(() => {});
  }, [theme.background]);

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

/**
 * Which screens exist depends on who is signed in:
 * signed out → welcome and sign-in screens; signed in without consent → consent; otherwise → the app.
 */
function RootNavigator() {
  const { ready, session, consented } = useAuth();
  const theme = useTheme();
  if (!ready) return null;
  const signedIn = !!session;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Pages slide in from the right on phones (and back out with a swipe on iPhone).
        animation: 'slide_from_right',
        animationDuration: 280,
        // Paint every page in the theme colour from its first frame (no white while it slides in).
        contentStyle: { backgroundColor: theme.background },
      }}>
      {/* Listed first: whenever a screen becomes unavailable (sign in, sign out, consent), the app falls back here. */}
      <Stack.Screen name="index" options={{ animation: 'fade' }} />

      <Stack.Protected guard={signedIn && consented}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="talk" />
        <Stack.Screen name="voice" />
        <Stack.Screen name="record" />
        <Stack.Screen name="verify" />
        <Stack.Screen name="store" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="payout-method" />
        <Stack.Screen name="cash-out" />
        <Stack.Screen name="new-post" />
        <Stack.Screen name="post/[id]" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="consent" options={{ gestureEnabled: consented }} />
        <Stack.Screen name="account" />
        <Stack.Screen name="settings" />
      </Stack.Protected>

      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="verify-email" />
      </Stack.Protected>

      {/* Open to everyone: the reset signs the user in part-way through. */}
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // Keep the splash screen up until the font is ready (or failed: then the system font is used).
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeSettingsProvider>
      <NavigationTheme>
        <AuthProvider>
          <AnimatedSplashOverlay />
          <RootNavigator />
        </AuthProvider>
      </NavigationTheme>
    </ThemeSettingsProvider>
  );
}
