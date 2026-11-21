import { Redirect, type Href } from 'expo-router';

import { useAuth } from '@/lib/auth';

/**
 * The app's front door. Sends each person to the right first screen:
 * signed out → Welcome, signed in without consent → Consent, otherwise → Home.
 */
export default function Index() {
  const { session, consented } = useAuth();
  if (!session) return <Redirect href={'/welcome' as Href} />;
  if (!consented) return <Redirect href={'/consent' as Href} />;
  return <Redirect href={'/home' as Href} />;
}
