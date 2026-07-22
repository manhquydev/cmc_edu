import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function fail(message) {
  failures.push(message);
}

const tracked = new Set(git(['ls-files', '-z']).split('\0').filter(Boolean));
const requiredFiles = [
  '.env.example',
  '.env.prod.example',
  '.claude/rules/CLAUDE.md',
  '.claude/.env.example',
  '.harness/changesets/cmc-story-baseline-v1.changeset.jsonl',
  '.codex/skills/harness-intake-griller/SKILL.md',
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
  'docs/CONTEXT_RULES.md',
  'docs/FEATURE_INTAKE.md',
  'docs/HARNESS.md',
  'scripts/bootstrap-harness.ps1',
  'scripts/bootstrap-harness.sh',
  'scripts/synthetic-seed-env.ps1',
  'scripts/synthetic-seed-env.sh',
  'scripts/harness-cli-release-tag',
];
for (const path of requiredFiles) {
  if (!tracked.has(path)) fail(`required portable file is not tracked: ${path}`);
}

for (const [prefix, label] of [
  ['scripts/schema/', 'Harness schema'],
  ['docs/stories/', 'story packet'],
  ['plans/', 'development plan'],
]) {
  const exists = [...tracked].some((path) => {
    if (!path.startsWith(prefix)) return false;
    return prefix === 'scripts/schema/' ? path.endsWith('.sql') : path.endsWith('.md');
  });
  if (!exists) fail(`no tracked ${label} files under ${prefix}`);
}

// `env` and `env.prod` carry the same secrets as their dotted counterparts but
// are missed by a `.env*` ignore rule, so they are listed explicitly.
const forbiddenTracked = [
  '.env',
  '.env.prod',
  'env',
  'env.prod',
  'harness.db',
  'scripts/bin/harness-cli',
  'scripts/bin/harness-cli.exe',
];
for (const path of forbiddenTracked) {
  if (tracked.has(path)) fail(`machine-local or secret file is tracked: ${path}`);
}

for (const path of [
  '.env',
  '.env.prod',
  'env',
  'env.prod',
  'harness.db',
  'scripts/bin/harness-cli',
  'scripts/bin/harness-cli.exe',
  '.gitnexus/meta.json',
]) {
  try {
    git(['check-ignore', '--no-index', '-q', path]);
  } catch {
    fail(`machine-local path is not ignored: ${path}`);
  }
}

function envKeys(path) {
  return new Set(
    readFileSync(resolve(root, path), 'utf8')
      .split(/\r?\n/)
      .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
      .map((line) => line.split('=', 1)[0]),
  );
}

const devKeys = envKeys('.env.example');
const prodKeys = envKeys('.env.prod.example');
const allExampleKeys = new Set([...devKeys, ...prodKeys]);
const runtimeKeys = new Set();
const sourcePattern = /^(apps|packages|scripts|infra)\//;
const textExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.sh', '.yml', '.yaml']);

for (const path of tracked) {
  if (!sourcePattern.test(path) && path !== 'docker-compose.prod.yml') continue;
  if (!textExtensions.has(extname(path)) && !path.includes('Dockerfile')) continue;
  if (/\.(test|spec)\.[^.]+$/.test(path) || path.includes('/tests/')) continue;
  if (path.startsWith('scripts/bootstrap-harness.')) continue;

  const content = readFileSync(resolve(root, path), 'utf8');
  const shellLocalKeys = path.endsWith('.sh')
    ? new Set(
        [...content.matchAll(/^\s*(?:local\s+|readonly\s+)?([A-Z][A-Z0-9_]*)=/gm)].map(
          (match) => match[1],
        ),
      )
    : new Set();
  const patterns = [
    /process\.env(?:\[['"]([A-Z][A-Z0-9_]*)['"]\]|\.([A-Z][A-Z0-9_]*))/g,
    /import\.meta\.env(?:\[['"]([A-Z][A-Z0-9_]*)['"]\]|\.([A-Z][A-Z0-9_]*))/g,
    /requireEnv\(['"]([A-Z][A-Z0-9_]*)['"]\)/g,
    /\$\{([A-Z][A-Z0-9_]*)(?=:[-?])/g,
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const key = match.slice(1).find(Boolean);
      if (!shellLocalKeys.has(key)) runtimeKeys.add(key);
    }
  }
}

const generatedOrForbidden = new Set([
  'ALLOW_DEV_AUTH',
  'CI',
  'DEV',
  'E2E_BASE_URL',
  'E2E_FACILITY_ID',
  'MODE',
  'POSTGRES_DB',
  'PROD',
]);
for (const key of generatedOrForbidden) runtimeKeys.delete(key);

for (const key of [...runtimeKeys].sort()) {
  if (!allExampleKeys.has(key)) fail(`runtime environment key missing from examples: ${key}`);
}

for (const key of [
  'NODE_ENV',
  'DATABASE_URL',
  'APP_DATABASE_URL',
  'LMS_SESSION_SECRET',
  'STAFF_SESSION_SECRET',
  'BREVO_API_KEY',
  'BREVO_SENDER_EMAIL',
  'TRUSTED_PROXY_CIDRS',
  'CORS_ORIGINS',
  'BACKUP_ENCRYPTION_PASSPHRASE',
  'VITE_API_URL',
  'VITE_SSO_ENABLED',
]) {
  if (!prodKeys.has(key)) fail(`production example is missing required key: ${key}`);
}

for (const key of [
  'SEED_SUPERADMIN_EMAIL',
  'SEED_SUPERADMIN_PASSWORD',
  'DISABLE_CRON',
  'GRAPH_SENDER_HR',
  'GRAPH_SENDER_NOTIFY',
  'GRAPH_SENDER_PAYROLL',
]) {
  if (allExampleKeys.has(key)) fail(`stale or unused environment key remains in examples: ${key}`);
}

if (failures.length > 0) {
  console.error('Repository portability verification failed:');
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(
  `Repository portability OK: ${tracked.size} tracked files, ${runtimeKeys.size} runtime env keys covered.`,
);
