import { router, type Href } from 'expo-router';

import { Button, Header, Screen, T } from '@/components/kit';
import { ThemeSettings } from '@/components/theme-settings';
import { resetOnboarding } from '@/lib/onboarding';

export default function SettingsScreen() {
  return (
    <Screen header={<Header title="Appearance" />}>
      <ThemeSettings />
      <T variant="heading">Testing</T>
      <Button
        label="Show the welcome screens again"
        variant="secondary"
        onPress={() => {
          resetOnboarding();
          router.replace('/welcome' as Href);
        }}
      />
    </Screen>
  );
}
