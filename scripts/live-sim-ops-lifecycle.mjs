#!/usr/bin/env node
/**
 * Day-in-the-life browser run against the live local-sim (email/password, TLS).
 * Drives the only fully UI-backed product lifecycle: CRM funnel → receipt
 * (≥ second-eye threshold) → GĐĐT approve/provision → GĐĐT student roster →
 * teacher schedule → student LMS first-login gate.
 *
 * Not a CI journey. Not *.ui.spec.ts. Credentials never printed.
 *
 *   LOCAL_SIM_LIVE=1 node scripts/live-sim-ops-lifecycle.mjs
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomInt, randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const requireFromE2e = createRequire(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../apps/e2e/package.json'),
);
const { chromium } = requireFromE2e('@playwright/test');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ERP = process.env.LOCAL_SIM_BASE ?? 'https://erp.localhost';
const LMS = process.env.LOCAL_SIM_LMS ?? 'https://hoc.localhost';
const ACCOUNTS = path.join(root, '.env.local-sim-accounts');
const OUT = path.join(root, 'plans/reports/live-sim-ops');
const CLASS_CODE = 'CMCDEVEL-UCREA-2026-001';
/** 1 + 250×100000 — HTML5 step on Học phí; above 20M second-eye (GĐĐT). */
const TUITION = '25000001';
const STUDENT_DEFAULT_PASSWORD = 'Cmc2026@';
const NAV_MS = 20_000;

if (process.env.LOCAL_SIM_LIVE !== '1') {
  throw new Error('Set LOCAL_SIM_LIVE=1 to confirm you are driving the local-sim browser.');
}

function gitHead() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function account(email) {
  const map = {};
  for (const line of readFileSync(ACCOUNTS, 'utf8').split('\n')) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    map[line.slice(0, i)] = line.slice(i + 1).trim();
  }
  const password = map[email];
  if (!password) throw new Error(`Missing ${email} in .env.local-sim-accounts`);
  return { email, password };
}

function randomVnPhone() {
  let digits = '9';
  for (let i = 0; i < 8; i += 1) digits += String(randomInt(0, 10));
  return `0${digits}`;
}

function escapeRe(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function visible(locator, timeoutMs = NAV_MS) {
  await locator.waitFor({ state: 'visible', timeout: timeoutMs });
}

async function menuNav(page, moduleLabel, childLabel, role) {
  const toggle = page.getByRole('button', { name: 'Mở app switcher', exact: true });
  await visible(toggle);
  await toggle.click();
  const menu = page.getByRole('menu', { name: 'App switcher' });
  const moduleTile = menu.getByRole('menuitem', { name: moduleLabel, exact: true });
  await visible(moduleTile);
  await moduleTile.click();
  if (childLabel === moduleLabel) return;
  const nav = page.locator('nav.console-navbar, nav[aria-label="Ứng dụng"]');
  const child = nav.getByRole('button', { name: childLabel, exact: true });
  try {
    await visible(child);
  } catch (error) {
    throw new Error(
      `menuNav ${moduleLabel} → ${childLabel} (${role}): child not visible — ${error.message}`,
    );
  }
  await child.click();
}

async function assertNavChildAbsent(page, moduleLabel, childLabel, role) {
  const toggle = page.getByRole('button', { name: 'Mở app switcher', exact: true });
  await visible(toggle);
  await toggle.click();
  const menu = page.getByRole('menu', { name: 'App switcher' });
  await visible(menu.getByRole('menuitem', { name: 'Tổng quan', exact: true }));
  const moduleTile = menu.getByRole('menuitem', { name: moduleLabel, exact: true });
  if ((await moduleTile.count()) === 0) {
    await toggle.click().catch(() => undefined);
    return;
  }
  await moduleTile.click();
  const nav = page.locator('nav.console-navbar, nav[aria-label="Ứng dụng"]');
  const child = nav.getByRole('button', { name: childLabel, exact: true });
  await page.waitForTimeout(400);
  const n = await child.count();
  await toggle.click().catch(() => undefined);
  if (n > 0) {
    throw new Error(`SoD: ${role} can see ${moduleLabel} → ${childLabel} (expected absent)`);
  }
}

async function findInList(page, predicate, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let last = [];
  while (Date.now() < deadline) {
    const rows = page.locator('table tbody tr, [role="row"]');
    const count = await rows.count();
    last = [];
    for (let i = 0; i < count; i += 1) {
      const row = rows.nth(i);
      const text = (await row.innerText()).trim();
      last.push(text);
      if (predicate(text)) return row;
    }
    await page.waitForTimeout(200);
  }
  throw new Error(`findInList: no match. saw ${last.length} row(s): ${JSON.stringify(last.slice(0, 8))}`);
}

async function loginStaff(page, creds) {
  await page.goto(`${ERP}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await visible(page.getByRole('button', { name: 'Đăng nhập', exact: true }));
  const body = await page.locator('body').innerText();
  if (/Đăng nhập \(Dev\)/i.test(body)) {
    throw new Error('Dev login visible on local-sim ERP — not a production stack');
  }
  await page.locator('input[type="email"]').fill(creds.email);
  await page.locator('input[type="password"]').fill(creds.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
  await visible(page.getByRole('button', { name: 'Mở app switcher', exact: true }), 30_000);
}

function newStepRecorder() {
  const steps = [];
  return {
    steps,
    async run(id, name, role, fn) {
      const started = Date.now();
      const rec = { id, name, role, ok: false, ms: 0, notes: '', screenshot: null, error: null };
      try {
        const notes = (await fn()) ?? '';
        rec.ok = true;
        rec.notes = typeof notes === 'string' ? notes : JSON.stringify(notes);
      } catch (error) {
        rec.error = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        rec.ms = Date.now() - started;
        steps.push(rec);
      }
      return rec;
    },
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const stamp = randomUUID().slice(0, 8);
  const studentName = `Nguyễn Vận Hành ${stamp}`;
  const parentPhone = randomVnPhone();
  const parentEmail = `ops.${stamp}@example.com`;
  const sale = account('sale@cmcvn.edu.vn');
  const gddt = account('gddt@cmcvn.edu.vn');
  const gv = account('gv@cmcvn.edu.vn');
  const recorder = newStepRecorder();
  const evidence = {
    generatedAt: new Date().toISOString(),
    head: gitHead(),
    target: { erp: ERP, lms: LMS },
    studentName,
    classCode: CLASS_CODE,
    tuition: Number(TUITION),
    receiptCode: null,
    receiptId: null,
    limits: [
      'P2-05 student open/submit remains no-ui-path (worker delivers after endTime; Phát bài is GĐĐT break-glass).',
      'Parent email-OTP is blocked-on-comms on local-sim; student phone+password is the live path.',
    ],
  };

  const browser = await chromium.launch({ headless: true });
  const ctxOpts = {
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    locale: 'vi-VN',
  };

  const shot = async (page, name) => {
    const file = `${name}.png`;
    await page.screenshot({ path: path.join(OUT, file), fullPage: true });
    return file;
  };

  let fatal = null;
  try {
    // ── 1. Sale: CRM funnel → receipt ──────────────────────────────────
    const saleCtx = await browser.newContext(ctxOpts);
    const salePage = await saleCtx.newPage();

    await recorder.run('S1', 'Sale đăng nhập ERP (email/password, không mint cookie)', 'sale', async () => {
      await loginStaff(salePage, sale);
      evidence.screenshots = { ...(evidence.screenshots ?? {}), s1: await shot(salePage, '01-sale-login') };
      return salePage.url();
    });

    await recorder.run('S2', 'Tạo cơ hội CRM và chuyển 3 bước tới O4 Ghi danh', 'sale', async () => {
      await menuNav(salePage, 'Tài chính & Điều hành', 'CRM', 'sale');
      await salePage.waitForURL(/\/crm/, { timeout: NAV_MS });
      await salePage.getByRole('button', { name: 'Thêm cơ hội' }).click();
      await salePage.getByLabel('Họ tên').fill(studentName);
      await salePage.getByLabel('Số điện thoại').fill(parentPhone);
      await salePage.getByRole('button', { name: 'Tạo', exact: true }).click();
      await visible(salePage.getByText(studentName));
      const contactCardName = new RegExp(`^${escapeRe(studentName)}`);
      for (let step = 0; step < 3; step += 1) {
        const card = salePage.getByRole('button', { name: contactCardName });
        const advance = card.getByRole('button', { name: 'Chuyển lên', exact: true });
        await visible(advance);
        await advance.click();
        await visible(salePage.getByText(studentName));
      }
      evidence.screenshots = { ...(evidence.screenshots ?? {}), s2: await shot(salePage, '02-crm-o4') };
      const card = salePage.getByRole('button', { name: contactCardName });
      const enroll = card.getByRole('button', { name: 'Ghi danh', exact: true });
      await visible(enroll);
      return 'O4 Ghi danh visible';
    });

    await recorder.run('S3', 'Ghi danh → phiếu thu 25.000.001đ lớp demo (sale không tự duyệt)', 'sale', async () => {
      const contactCardName = new RegExp(`^${escapeRe(studentName)}`);
      await salePage
        .getByRole('button', { name: contactCardName })
        .getByRole('button', { name: 'Ghi danh', exact: true })
        .click();
      await salePage.waitForURL(/\/finance\/new\?opportunityId=/, { timeout: NAV_MS });
      // Opportunity prefill is async — submitting before name/phone land is a
      // silent client-side validate() no-op (no success banner).
      const nameField = salePage.getByLabel('Họ tên học viên');
      await visible(nameField);
      const prefillUntil = Date.now() + NAV_MS;
      while (Date.now() < prefillUntil) {
        if ((await nameField.inputValue()) === studentName) break;
        await salePage.waitForTimeout(150);
      }
      const filledName = await nameField.inputValue();
      if (filledName !== studentName) {
        throw new Error(`Opportunity did not prefill name (got ${JSON.stringify(filledName)})`);
      }
      await salePage.getByLabel('Email phụ huynh').fill(parentEmail);
      const classSearch = salePage.getByPlaceholder('Tìm kiếm...');
      if ((await classSearch.count()) > 0) {
        await classSearch.fill(CLASS_CODE);
        await salePage.waitForTimeout(500);
      }
      await salePage.getByRole('combobox', { name: /^Lớp học/ }).click();
      const option = salePage.getByRole('option', { name: new RegExp(escapeRe(CLASS_CODE)) });
      await visible(option, 15_000);
      await option.click();
      const fee = salePage.getByRole('spinbutton', { name: /^Học phí/ });
      await fee.fill('');
      await fee.fill(TUITION);
      await salePage.getByRole('button', { name: 'Tạo phiếu thu' }).click();
      const success = salePage.getByText(/Đã tạo phiếu thu /);
      const apiError = salePage.getByText('Lỗi tạo phiếu thu');
      const confirm = salePage.getByText('Cần xác nhận học sinh');
      const fieldErr = salePage.getByText('Vui lòng chọn lớp học');
      try {
        await success.or(apiError).or(confirm).or(fieldErr).first().waitFor({ state: 'visible', timeout: 20_000 });
      } catch {
        evidence.screenshots = { ...(evidence.screenshots ?? {}), s3fail: await shot(salePage, '03-receipt-failed') };
        const body = (await salePage.locator('body').innerText()).slice(0, 1200);
        throw new Error(`No receipt outcome. url=${salePage.url()} body=${body.replace(/\s+/g, ' ')}`);
      }
      if (await apiError.isVisible().catch(() => false)) {
        const desc = (await salePage.locator('body').innerText()).slice(0, 800);
        throw new Error(`API rejected receiptCreate: ${desc.replace(/\s+/g, ' ')}`);
      }
      if (await confirm.isVisible().catch(() => false)) {
        await salePage.getByRole('button', { name: /Đây là bé mới/ }).click();
        await visible(success, 20_000);
      }
      if (await fieldErr.isVisible().catch(() => false)) {
        evidence.screenshots = { ...(evidence.screenshots ?? {}), s3fail: await shot(salePage, '03-receipt-failed') };
        throw new Error('Class combobox did not stick — Vui lòng chọn lớp học');
      }
      const bannerText = (await success.textContent()) ?? '';
      evidence.receiptCode = bannerText.replace(/^Đã tạo phiếu thu\s+/, '').trim();
      if (!evidence.receiptCode) throw new Error('Banner created but no receipt code');
      evidence.screenshots = { ...(evidence.screenshots ?? {}), s3: await shot(salePage, '03-receipt-created') };
      return evidence.receiptCode;
    });

    await recorder.run('S4', 'Sale không thấy menu Phiếu thu (SoD ADR-B)', 'sale', async () => {
      await assertNavChildAbsent(salePage, 'Tài chính & Điều hành', 'Phiếu thu', 'sale');
      return 'Phiếu thu absent';
    });

    await saleCtx.close();

    // ── 2. GĐĐT: second-eye approve + roster ───────────────────────────
    const gddtCtx = await browser.newContext(ctxOpts);
    const gddtPage = await gddtCtx.newPage();

    await recorder.run('S5', 'GĐĐT tìm phiếu theo tên học viên và duyệt kích hoạt LMS', 'giam_doc_dao_tao', async () => {
      await loginStaff(gddtPage, gddt);
      await menuNav(gddtPage, 'Tài chính & Điều hành', 'Phiếu thu', 'giam_doc_dao_tao');
      const row = await findInList(gddtPage, (text) => text.includes(studentName));
      evidence.screenshots = { ...(evidence.screenshots ?? {}), s5a: await shot(gddtPage, '04-gddt-receipt-list') };
      await row.click();
      await gddtPage.waitForURL(/\/finance\/[0-9a-f-]{36}$/, { timeout: NAV_MS });
      evidence.receiptId = gddtPage.url().split('/').pop();
      await visible(gddtPage.getByRole('heading', { name: /^Phiếu thu /, level: 4 }));
      await gddtPage.getByRole('button', { name: 'Duyệt & Kích hoạt' }).click();
      const dialog = gddtPage.getByRole('alertdialog');
      await visible(dialog);
      await dialog.getByRole('button', { name: 'Duyệt & Kích hoạt' }).click();
      await visible(
        gddtPage.getByText('Phiếu đã được duyệt — tài khoản LMS đã tạo và email thông báo đã gửi'),
        30_000,
      );
      evidence.screenshots = { ...(evidence.screenshots ?? {}), s5b: await shot(gddtPage, '05-gddt-approved') };
      return evidence.receiptId;
    });

    await recorder.run('S6', 'GĐĐT tra cứu học viên → tab Lớp học thấy enrollment + cấp range', 'giam_doc_dao_tao', async () => {
      await menuNav(gddtPage, 'Lớp & Học sinh', 'Học viên', 'giam_doc_dao_tao');
      await gddtPage.getByLabel('Tìm kiếm').fill(studentName);
      const row = await findInList(gddtPage, (text) => text.includes(studentName), 20_000);
      await row.click();
      await gddtPage.waitForURL(/\/admin\/students\/[0-9a-f-]{36}/, { timeout: NAV_MS });
      await visible(gddtPage.getByText(studentName).first());
      const enrollTab = gddtPage.getByLabel('Tabs').getByRole('button', { name: 'Lớp học', exact: true });
      await visible(enrollTab);
      await enrollTab.click();
      await gddtPage.waitForTimeout(800);
      evidence.screenshots = { ...(evidence.screenshots ?? {}), s6: await shot(gddtPage, '06-gddt-student-class') };
      const body = await gddtPage.locator('body').innerText();
      const hasClass = body.includes(CLASS_CODE);
      const hasGrantUi =
        body.includes('Cấp / cắt range') ||
        body.includes('Cấp range') ||
        body.includes('Lớp đã ghi danh');
      const denied = body.includes('Không có quyền cấp unit');
      const empty = body.includes('Chưa ghi danh lớp');
      if (denied) throw new Error('GĐĐT saw grant-denied empty state on Lớp học tab');
      if (empty) throw new Error('Approved student has no enrollment on Lớp học tab');
      if (!hasClass || !hasGrantUi) {
        throw new Error(
          `Lớp học tab missing class/grant UI. hasClass=${hasClass} hasGrantUi=${hasGrantUi} body=${body.slice(0, 1500).replace(/\s+/g, ' ')}`,
        );
      }
      return `${CLASS_CODE}; grant UI visible`;
    });

    await gddtCtx.close();

    // ── 3. Teacher: schedule of the live class ─────────────────────────
    const gvCtx = await browser.newContext(ctxOpts);
    const gvPage = await gvCtx.newPage();

    await recorder.run('S7', 'Giáo viên mở Lịch dạy, xem lớp demo đang vận hành', 'giao_vien', async () => {
      await loginStaff(gvPage, gv);
      await menuNav(gvPage, 'Giảng dạy', 'Lịch dạy', 'giao_vien');
      await gvPage.locator('button[data-view="list"]').click();
      await visible(gvPage.getByText(CLASS_CODE), 15_000);
      evidence.screenshots = { ...(evidence.screenshots ?? {}), s7: await shot(gvPage, '07-gv-schedule') };
      return CLASS_CODE;
    });

    await gvCtx.close();

    // ── 4. Student: first login held at change-password ────────────────
    const lmsCtx = await browser.newContext(ctxOpts);
    const lmsPage = await lmsCtx.newPage();

    await recorder.run('S8', 'Học viên đăng nhập LMS bằng SĐT phụ huynh → cổng đổi mật khẩu', 'student', async () => {
      await lmsPage.goto(`${LMS}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      const studentTab = lmsPage.getByRole('tab', { name: /Học sinh/ });
      if ((await studentTab.count()) > 0) await studentTab.click();
      await lmsPage.getByLabel('Số điện thoại phụ huynh').fill(parentPhone);
      await lmsPage.getByLabel('Mật khẩu', { exact: true }).fill(STUDENT_DEFAULT_PASSWORD);
      await lmsPage.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
      await lmsPage.waitForURL(/\/student\/change-password/, { timeout: 30_000 });
      await visible(lmsPage.getByRole('heading', { name: 'Cần đổi mật khẩu' }));
      evidence.screenshots = { ...(evidence.screenshots ?? {}), s8: await shot(lmsPage, '08-student-password-gate') };
      return lmsPage.url();
    });

    await lmsCtx.close();
  } catch (error) {
    fatal = error;
  } finally {
    await browser.close();
  }

  const ok = recorder.steps.length > 0 && recorder.steps.every((s) => s.ok) && !fatal;
  const report = {
    ...evidence,
    ok,
    fatal: fatal instanceof Error ? fatal.message : fatal ? String(fatal) : null,
    steps: recorder.steps,
  };
  writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

  const md = [
    `# Test Report — local-sim ops lifecycle`,
    ``,
    `**HEAD:** \`${report.head}\`  `,
    `**When:** ${report.generatedAt}  `,
    `**Stack:** live local-sim (${ERP} / ${LMS}), real email/password, no minted cookies.`,
    ``,
    `## What this run is`,
    ``,
    `Một ngày vận hành trung tâm trên UI thật: sale đưa lead qua phễu CRM, lập phiếu thu trên ngưỡng second-eye, GĐĐT duyệt kích hoạt LMS, tra cứu học viên và range unit, giáo viên thấy lớp trên lịch, học viên vào cổng bị giữ ở đổi mật khẩu.`,
    ``,
    `Đây **không** phải P2-05 (học viên mở/nộp bài). Happy-path phát bài vẫn là worker sau \`endTime\`.`,
    ``,
    `## Identity under test`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| Học viên | ${studentName} |`,
    `| Lớp | ${CLASS_CODE} |`,
    `| Học phí | ${Number(TUITION).toLocaleString('vi-VN')} đ (≥ 20 triệu, GĐĐT second-eye) |`,
    `| Mã phiếu | ${evidence.receiptCode ?? '—'} |`,
    `| Receipt id | ${evidence.receiptId ?? '—'} |`,
    ``,
    `## Steps`,
    ``,
    `| Id | Role | Step | Result | ms |`,
    `|----|------|------|--------|----|`,
    ...recorder.steps.map(
      (s) =>
        `| ${s.id} | ${s.role} | ${s.name} | ${s.ok ? 'ok' : 'FAIL'} | ${s.ms} |`,
    ),
    ``,
    `## Notes`,
    ``,
    ...recorder.steps.map((s) => `- **${s.id}:** ${s.ok ? s.notes : s.error}`),
    ``,
    `## Limits (product, not test bugs)`,
    ``,
    ...evidence.limits.map((l) => `- ${l}`),
    ``,
    `## Screenshots`,
    ``,
    `\`plans/reports/live-sim-ops/\``,
    ``,
    `| File | What it shows |`,
    `|------|----------------|`,
    `| \`01-sale-login.png\` | Sale cockpit after production email/password login |`,
    `| \`02-crm-o4.png\` | Opportunity at O4 with Ghi danh |`,
    `| \`03-receipt-created.png\` | Sale stays on /finance/new; receipt code banner |`,
    `| \`04-gddt-receipt-list.png\` | GĐĐT finds the student by visible name |`,
    `| \`05-gddt-approved.png\` | Approved, LMS provisioned, second-eye banner |`,
    `| \`06-gddt-student-class.png\` | Tab Lớp học: enrollment range + Cấp/cắt |`,
    `| \`07-gv-schedule.png\` | GV Lịch dạy list has the demo class |`,
    `| \`08-student-password-gate.png\` | LMS /student/change-password |`,
    ``,
    `## Re-run`,
    ``,
    '```bash',
    'LOCAL_SIM_LIVE=1 pnpm verify:local-sim:ops',
    '```',
    ``,
    `Overall: **${ok ? 'ok' : 'FAIL'}**`,
    ``,
  ].join('\n');

  const mdPath = path.join(root, 'plans/reports/test-260813-1405-local-sim-ops-lifecycle.md');
  writeFileSync(mdPath, md);
  writeFileSync(path.join(OUT, 'report.md'), md);

  console.log(`live-sim-ops-lifecycle  ${ok ? 'ok' : 'FAIL'}  student=${studentName} receipt=${evidence.receiptCode ?? '-'}`);
  for (const s of recorder.steps) {
    console.log(`  ${s.ok ? 'ok' : 'FAIL'}  ${s.id}  ${s.name}${s.ok ? '' : `  — ${s.error}`}`);
  }
  console.log(`  -> ${OUT}`);
  console.log(`  -> ${mdPath}`);
  process.exitCode = ok ? 0 : 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
