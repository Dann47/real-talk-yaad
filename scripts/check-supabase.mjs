// Checks that the app can reach your Supabase project with the keys in .env.development.
// Run: node --env-file=.env.development scripts/check-supabase.mjs
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key || url.includes('YOUR-PROJECT-REF')) {
  console.error('Fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.development first.');
  process.exit(1);
}

try {
  const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
  if (res.ok) {
    console.log(`Connected to Supabase at ${url}`);
  } else {
    console.error(`Supabase answered with HTTP ${res.status}. Check that the URL and publishable key match the same project.`);
    process.exit(1);
  }
} catch (err) {
  console.error(`Could not reach ${url}: ${err.message}`);
  process.exit(1);
}
