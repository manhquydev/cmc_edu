#!/usr/bin/env tsx
// Seeds the local-sim stack with staff accounts and one full enrollment, using
// the same HTTP surface a browser uses: email/password login, session cookie,
// tRPC over nginx. Nothing here depends on the `x-dev-user` impersonation
// header, which the production build rejects — so a green run is evidence the
// real auth path works end to end.
//
// Usage (stack must be up, see infra/compose.local-sim.yml):
//   LOCAL_SIM_SEED_ALLOW=1 tsx scripts/seed-local-sim-demo.ts
//
// Prerequisite (global curriculum catalog — exercise.create needs it):
//   LOCAL_SIM_SEED_ALLOW=1 DATABASE_URL=postgresql://…@127.0.0.1:5432/cmc_prod \
//     npx tsx scripts/ensure-curriculum-units.ts
//   (or full `pnpm --filter @cmc/db exec prisma db seed` once per empty DB)
//
// Reads the bootstrap super-admin credentials from .env.prod
// (SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD) and writes the final per-role
// passwords to .env.local-sim-accounts (gitignored) — they are never printed.

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const BASE = process.env.LOCAL_SIM_BASE ?? 'https://erp.localhost';

// The cert is self-signed; only ever for a loopback host.
if (!/^https:\/\/(erp\.)?localhost(:\d+)?$/.test(BASE)) {
  throw new Error(`Refusing to seed a non-loopback target: ${BASE}`);
}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

if (process.env.LOCAL_SIM_SEED_ALLOW !== '1') {
  throw new Error('Set LOCAL_SIM_SEED_ALLOW=1 to confirm you are seeding the local-sim stack.');
}

function envValue(file: string, key: string): string {
  const line = readFileSync(file, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} missing from ${file}`);
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '');
}

/** Password that satisfies the API's minimum-length rule and is safe in a shell. */
function newPassword(): string {
  return `Cmc${randomBytes(9).toString('base64url')}!`;
}

interface Session {
  cookie: string;
  mustChangePassword: boolean;
}

async function staffLogin(email: string, password: string): Promise<Session> {
  const res = await fetch(`${BASE}/auth/staff-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as { ok?: boolean; error?: string; mustChangePassword?: boolean };
  if (!res.ok || !body.ok) throw new Error(`login ${email} failed: ${res.status} ${body.error ?? ''}`);
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error(`login ${email}: no session cookie returned`);
  return { cookie: setCookie.split(';')[0]!, mustChangePassword: Boolean(body.mustChangePassword) };
}

/** Single tRPC call over the same origin the SPA uses. */
async function trpc<T>(session: Session, path: string, input: unknown, kind: 'query' | 'mutation'): Promise<T> {
  const url =
    kind === 'query'
      ? `${BASE}/trpc/${path}?input=${encodeURIComponent(JSON.stringify(input))}`
      : `${BASE}/trpc/${path}`;
  const res = await fetch(url, {
    method: kind === 'query' ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', cookie: session.cookie },
    ...(kind === 'mutation' ? { body: JSON.stringify(input) } : {}),
  });
  const body = (await res.json()) as { result?: { data: T }; error?: { message: string } };
  if (!res.ok || body.error) throw new Error(`${path}: ${res.status} ${body.error?.message ?? ''}`);
  return body.result!.data;
}

/** Logs in with the temp password and rotates it, so the account is ready to use. */
async function activate(email: string, tempPassword: string): Promise<string> {
  const finalPassword = newPassword();
  const session = await staffLogin(email, tempPassword);
  await trpc(session, 'user.changeOwnPassword', { currentPassword: tempPassword, newPassword: finalPassword }, 'mutation');
  return finalPassword;
}

const ROLES = [
  { email: 'gdkd@cmcvn.edu.vn', name: 'Trần Kinh Doanh', title: 'Giám đốc kinh doanh', role: 'giam_doc_kinh_doanh' },
  { email: 'gddt@cmcvn.edu.vn', name: 'Lê Đào Tạo', title: 'Giám đốc đào tạo', role: 'giam_doc_dao_tao' },
  { email: 'sale@cmcvn.edu.vn', name: 'Nguyễn Văn Sale', title: 'Nhân viên kinh doanh', role: 'sale' },
  { email: 'gv@cmcvn.edu.vn', name: 'Phạm Thị Giáo', title: 'Giáo viên', role: 'giao_vien' },
] as const;

const ACCOUNTS_FILE = '.env.local-sim-accounts';

async function main() {
  // Best-effort: fill empty CurriculumUnit catalog so exercise UI is usable.
  // Requires host-reachable DATABASE_URL (rewrite postgres→127.0.0.1 is inside
  // ensure-curriculum-units). Failure is non-fatal — HTTP staff seed continues.
  const viaTsx = spawnSync('npx', ['tsx', 'scripts/ensure-curriculum-units.ts'], {
    env: { ...process.env, LOCAL_SIM_SEED_ALLOW: '1' },
    encoding: 'utf8',
    cwd: new URL('..', import.meta.url).pathname,
  });
  if (viaTsx.stdout) process.stdout.write(viaTsx.stdout);
  if (viaTsx.status !== 0 && viaTsx.stderr) {
    process.stderr.write(`[curriculum-ensure] ${viaTsx.stderr}`);
  }

  const accounts: Record<string, string> = {};

  // Written after every rotation, not at the end: a password that has already
  // replaced the one in .env.prod is unrecoverable if the run dies before the
  // file exists, and the only way back is a direct database write.
  const persist = () => {
    const lines = [
      '# Local-sim demo accounts — generated by scripts/seed-local-sim-demo.ts.',
      '# Gitignored. Local self-signed stack only; these are not production credentials.',
      `# Updated ${new Date().toISOString()}`,
      '',
      ...Object.entries(accounts).map(([email, password]) => `${email}=${password}`),
      '',
      '# LMS student: phone 0912345678, product default password (change forced on first login).',
    ];
    writeFileSync(ACCOUNTS_FILE, `${lines.join('\n')}\n`);
  };

  // ── Super admin: first login still carries the forced rotation ───────────
  const saEmail = envValue('.env.prod', 'SUPER_ADMIN_EMAIL');
  const saBootstrap = envValue('.env.prod', 'SUPER_ADMIN_PASSWORD');
  let sa = await staffLogin(saEmail, saBootstrap);
  if (sa.mustChangePassword) {
    const rotated = newPassword();
    await trpc(sa, 'user.changeOwnPassword', { currentPassword: saBootstrap, newPassword: rotated }, 'mutation');
    accounts[saEmail] = rotated;
    persist();
    sa = await staffLogin(saEmail, rotated);
  } else {
    accounts[saEmail] = saBootstrap;
    persist();
  }
  console.log(`super admin ready: ${saEmail}`);

  // ── Staff accounts, created and permissioned the way an admin would ──────
  for (const r of ROLES) {
    const created = await trpc<{ id: string }>(
      sa,
      'user.create',
      { userId: r.email, fullName: r.name, email: r.email, position: r.title },
      'mutation',
    );
    await trpc(sa, 'user.updateRoles', { appUserId: created.id, roles: [r.role] }, 'mutation');
    const temp = newPassword();
    await trpc(sa, 'user.resetPassword', { appUserId: created.id, tempPassword: temp }, 'mutation');
    accounts[r.email] = await activate(r.email, temp);
    persist();
    console.log(`staff ready: ${r.email} (${r.role})`);
  }

  const gddt = await staffLogin('gddt@cmcvn.edu.vn', accounts['gddt@cmcvn.edu.vn']!);
  const sale = await staffLogin('sale@cmcvn.edu.vn', accounts['sale@cmcvn.edu.vn']!);

  // ── Course + class with a generated session schedule ─────────────────────
  const course = await trpc<{ id: string }>(gddt, 'course.create', { program: 'UCREA', name: 'UCREA Sáng tạo 1' }, 'mutation');
  const batch = await trpc<{ classBatch: { id: string; code: string } }>(
    gddt,
    'classBatch.create',
    {
      courseId: course.id,
      startDate: '2026-07-28',
      endDate: '2026-10-20',
      slots: [
        { weekday: 1, startTime: '18:00', endTime: '19:30' },
        { weekday: 4, startTime: '18:00', endTime: '19:30' },
      ],
    },
    'mutation',
  );
  console.log(`class ready: ${batch.classBatch.code}`);

  // ── CRM lead -> tested -> receipt -> approval -> LMS provisioning ────────
  const parentPhone = '0912345678';
  const opp = await trpc<{ id: string }>(
    sale,
    'crm.opportunityCreate',
    { contactName: 'Chị Hoa (PH bé Minh Anh)', phone: parentPhone, email: 'hoa.parent@example.com' },
    'mutation',
  );
  for (const toStage of ['O2_CONTACTED', 'O3_TEST_SCHEDULED', 'O4_TESTED']) {
    await trpc(sale, 'crm.opportunityAdvance', { opportunityId: opp.id, toStage }, 'mutation');
  }
  const receipt = await trpc<{ status: string; receipt: { id: string; code: string }; message?: string }>(
    sale,
    'finance.receiptCreate',
    {
      opportunityId: opp.id,
      studentName: 'Nguyễn Minh Anh',
      parentPhone,
      parentEmail: 'hoa.parent@example.com',
      classBatchId: batch.classBatch.id,
      amount: 25_000_000,
    },
    'mutation',
  );
  if (receipt.status !== 'success') throw new Error(`receiptCreate: ${receipt.status} ${receipt.message ?? ''}`);
  console.log(`receipt created: ${receipt.receipt.code} (25.000.000 d, above the second-eye threshold)`);

  // Above 20M, so only GĐĐT/super_admin may approve — and never the creator.
  await trpc(gddt, 'finance.receiptApprove', { receiptId: receipt.receipt.id }, 'mutation');
  console.log('receipt approved -> student, parent, enrollment and LMS accounts provisioned');

  console.log(`credentials in ${ACCOUNTS_FILE}`);
}

main().catch((err: unknown) => {
  console.error(String(err instanceof Error ? err.message : err));
  process.exitCode = 1;
});
