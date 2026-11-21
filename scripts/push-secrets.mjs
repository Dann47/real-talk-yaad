// Uploads the server secrets from an env file to Supabase Edge Functions.
// Usage: npm run secrets:dev   (reads .env.development)
//        npm run secrets:prod  (reads .env.production)
// App settings (EXPO_PUBLIC_*) and SUPABASE_* names are skipped: the app reads the first,
// and Supabase reserves the second.
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/push-secrets.mjs <env file>');
  process.exit(1);
}

const values = {};
for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (match) values[match[1]] = match[2];
}

const projectRef = values.SUPABASE_PROJECT_REF;
if (!projectRef || projectRef.includes('YOUR-')) {
  console.error(`Set SUPABASE_PROJECT_REF in ${file} first.`);
  process.exit(1);
}

const secrets = Object.entries(values).filter(
  ([name, value]) => !name.startsWith('EXPO_PUBLIC_') && !name.startsWith('SUPABASE_') && value !== '',
);
const empty = Object.entries(values)
  .filter(([name, value]) => !name.startsWith('EXPO_PUBLIC_') && !name.startsWith('SUPABASE_') && value === '')
  .map(([name]) => name);
if (empty.length) console.warn(`Skipping empty values: ${empty.join(', ')}`);
if (!secrets.length) {
  console.error('No secrets to upload.');
  process.exit(1);
}

const temp = join(tmpdir(), `rty-secrets-${Date.now()}.env`);
writeFileSync(temp, secrets.map(([name, value]) => `${name}=${value}`).join('\n'));
try {
  console.log(`Uploading ${secrets.map(([name]) => name).join(', ')} to project ${projectRef}...`);
  const result = spawnSync('npx', ['supabase', 'secrets', 'set', '--env-file', temp, '--project-ref', projectRef], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(temp, { force: true });
}
