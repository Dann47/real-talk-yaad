import { Redirect, type Href } from 'expo-router';

import AppTabs from '@/components/app-tabs';
import { hasOnboarded } from '@/lib/onboarding';

export default function TabsLayout() {
  // First visit: show the welcome and consent screens before the app.
  if (!hasOnboarded()) return <Redirect href={'/welcome' as Href} />;
  return <AppTabs />;
}
