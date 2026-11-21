import { Header, Screen } from '@/components/kit';
import { ThemeSettings } from '@/components/theme-settings';

export default function SettingsScreen() {
  return (
    <Screen title="Appearance" header={<Header title="Appearance" />}>
      <ThemeSettings />
    </Screen>
  );
}
