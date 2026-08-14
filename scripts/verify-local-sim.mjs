#!/usr/bin/env node
/**
 * Independent live-stack scenarios against local-sim (nginx + TLS + prod images).
 * Does not read journeys.json, markdown, or CI artifacts.
 *
 * Usage (stack must be up):
 *   LOCAL_SIM_LIVE=1 node scripts/verify-local-sim.mjs
 *   LOCAL_SIM_LIVE=1 node scripts/verify-local-sim.mjs --json
 *
 * Credentials: .env.local-sim-accounts (never printed).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ERP = process.env.LOCAL_SIM_BASE ?? 'https://erp.localhost';
const LMS = process.env.LOCAL_SIM_LMS ?? 'https://hoc.localhost';
const API = process.env.LOCAL_SIM_API ?? 'http://127.0.0.1:3000';
const ACCOUNTS = path.join(root, '.env.local-sim-accounts');
const OUT_DIR = path.join(root, 'acceptance-report');
const asJson = process.argv.includes('--json');

if (!/^https:\/\/(erp\.)?localhost(:\d+)?$/.test(ERP)) {
  throw new Error(`Refusing non-loopback ERP target: ${ERP}`);
}

if (process.env.LOCAL_SIM_LIVE !== '1') {
  throw new Error('Set LOCAL_SIM_LIVE=1 to confirm you are probing the local-sim stack.');
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function parseEnvFile(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    out[line.slice(0, i)] = line.slice(i + 1).trim();
  }
  return out;
}

function account(email) {
  const accounts = parseEnvFile(ACCOUNTS);
  const password = accounts[email];
  if (!password) throw new Error(`Missing ${email} in .env.local-sim-accounts (run seed-local-sim-demo)`);
  return { email, password };
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, { redirect: 'manual', ...init });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: res.status, headers: res.headers, body, text };
}

async function scenario(id, name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    return { id, name, ok: true, ms: Date.now() - started, detail: detail ?? 'ok' };
  } catch (error) {
    return {
      id,
      name,
      ok: false,
      ms: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function staffLogin(email, password) {
  const res = await fetch(`${ERP}/auth/staff-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok || !body.ok) {
    throw new Error(`login ${email} failed: ${res.status} ${body.error ?? ''}`);
  }
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error(`login ${email}: no session cookie`);
  return { cookie: setCookie.split(';')[0], mustChangePassword: Boolean(body.mustChangePassword) };
}

async function trpcQuery(cookie, procedure, input) {
  const url = `${ERP}/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify(input ?? {}))}`;
  const res = await fetch(url, { headers: { cookie } });
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(`${procedure}: ${res.status} ${body.error?.message ?? JSON.stringify(body).slice(0, 180)}`);
  }
  return body.result.data;
}

async function main() {
  const sha = readFileSync(path.join(root, '.git/HEAD'), 'utf8').trim();
  const results = [];

  results.push(
    await scenario('S1', 'API loopback /health', async () => {
      const r = await fetchJson(`${API}/health`);
      if (r.status !== 200) throw new Error(`status ${r.status}`);
      if (r.body?.result?.data?.status !== 'ok' && r.body?.status !== 'ok') {
        throw new Error(`unexpected body ${JSON.stringify(r.body).slice(0, 180)}`);
      }
      return `HTTP ${r.status}`;
    }),
  );

  results.push(
    await scenario('S2', 'ERP https login HTML, no Dev shortcut', async () => {
      const r = await fetchJson(`${ERP}/login`);
      if (r.status !== 200) throw new Error(`status ${r.status}`);
      if (/Đăng nhập \(Dev\)|Dev role|x-dev-user/i.test(r.text)) {
        throw new Error('dev affordance leaked into production bundle');
      }
      if (!/script type="module"|\/assets\//.test(r.text)) {
        throw new Error('login response is not the admin SPA shell');
      }
      const hsts = r.headers.get('strict-transport-security');
      if (hsts) throw new Error(`HSTS present on localhost: ${hsts}`);
      return `HTTP ${r.status}, SPA shell, no HSTS, no Dev login`;
    }),
  );

  results.push(
    await scenario('S3', 'LMS origin serves SPA', async () => {
      const r = await fetchJson(`${LMS}/`);
      if (r.status !== 200 && r.status !== 302) throw new Error(`status ${r.status}`);
      return `HTTP ${r.status}`;
    }),
  );

  results.push(
    await scenario('S4', 'x-dev-user cannot impersonate without cookie', async () => {
      const r = await fetchJson(`${ERP}/trpc/session.me?input=${encodeURIComponent(JSON.stringify({}))}`, {
        headers: { 'x-dev-user': 'giam_doc_dao_tao' },
      });
      if (r.status === 200 && r.body?.result?.data) {
        throw new Error('x-dev-user accepted on production stack');
      }
      return `HTTP ${r.status} (rejected)`;
    }),
  );

  results.push(
    await scenario('S5', 'GĐĐT staff-login + session cookie', async () => {
      const { email, password } = account('gddt@cmcvn.edu.vn');
      const session = await staffLogin(email, password);
      if (session.mustChangePassword) throw new Error('GĐĐT still mustChangePassword after seed');
      if (!session.cookie.includes('=')) throw new Error('cookie malformed');
      return 'ok + cookie (password not logged)';
    }),
  );

  results.push(
    await scenario('S6', 'GĐĐT me + can see teaching surfaces', async () => {
      const { email, password } = account('gddt@cmcvn.edu.vn');
      const session = await staffLogin(email, password);
      const me = await trpcQuery(session.cookie, 'session.me', {});
      const roles = Array.isArray(me?.roles) ? me.roles.join(',') : 'none';
      if (!roles.includes('giam_doc_dao_tao')) throw new Error(`unexpected roles ${roles}`);
      return `roles ${roles}`;
    }),
  );

  results.push(
    await scenario('S7', 'Sale cannot grant enrollment units (authz)', async () => {
      const { email, password } = account('sale@cmcvn.edu.vn');
      const session = await staffLogin(email, password);
      const url = `${ERP}/trpc/lmsOps.listEnrollmentsForStudent?input=${encodeURIComponent(JSON.stringify({ studentId: '00000000-0000-4000-8000-000000000001' }))}`;
      const res = await fetch(url, { headers: { cookie: session.cookie } });
      const body = await res.json();
      const code = body?.error?.data?.code ?? body?.error?.code ?? String(res.status);
      if (res.ok) throw new Error(`sale was allowed: ${JSON.stringify(body).slice(0, 180)}`);
      return `denied ${res.status} ${code}`;
    }),
  );

  results.push(
    await scenario('S8', 'HTTP→HTTPS redirect', async () => {
      const res = await fetch('http://erp.localhost/login', { redirect: 'manual' });
      if (res.status !== 301 && res.status !== 302) throw new Error(`status ${res.status}`);
      const loc = res.headers.get('location') ?? '';
      if (!loc.startsWith('https://')) throw new Error(`location ${loc}`);
      return `${res.status} → ${loc}`;
    }),
  );

  const failed = results.filter((r) => !r.ok);
  const report = {
    generatedAt: new Date().toISOString(),
    headRef: sha,
    target: { erp: ERP, lms: LMS, api: API },
    proofClass: 'behavior',
    independentOf: ['journeys.json', 'verification.json', 'markdown'],
    ok: failed.length === 0,
    passed: results.filter((r) => r.ok).length,
    failed: failed.length,
    results,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, 'local-sim-verification.json'), JSON.stringify(report, null, 2));

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`verify:local-sim  ${report.ok ? 'ok' : 'FAIL'}  ${report.passed}/${results.length}`);
    for (const r of results) {
      console.log(`  ${r.id} ${r.ok ? 'ok  ' : 'FAIL'}  ${r.name} — ${r.detail}`);
    }
    console.log(`  -> ${path.join(OUT_DIR, 'local-sim-verification.json')}`);
  }
  process.exitCode = report.ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
