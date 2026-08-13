// Entry point for `pnpm acceptance:report`. Scans code at HEAD, matches
// against the flow manifest, writes acceptance-report/verification.json,
// then renders the HTML (Phase 2/3). No hand-written state persists between
// runs — everything here is recomputed from the current worktree.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { flows } from './flow-manifest.js';
import { scanTrpcRouters } from './scanners/trpc-scanner.js';
import { scanUiRoutesDetailed } from './scanners/route-scanner.js';
import { scanPrismaModels } from './scanners/prisma-scanner.js';
import { render } from './render.js';
import { auditFlowActors } from './actor-audit.js';
import { ingestPlaywrightResults } from './ingest-playwright-results.js';
import { composeFlowEvidence, findUnrunJourneys } from './flow-evidence.js';
import type { EvidenceRun, FlowStatus, FlowVerification, OrphanResult, RunFacts, VerificationResult } from './types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'acceptance-report');

// Written by the Playwright json reporter, gated on PLAYWRIGHT_UI so an
// API-only run can never rewrite it. Gitignored: it is a run artifact, and a
// committed one would be a hand-editable file claiming to be machine evidence.
//
// Deliberately NOT under apps/e2e/test-results/ — Playwright clears its
// outputDir at the start of every run, so evidence kept there is deleted by the
// next API run regardless of the reporter gate.
const RESULTS_PATH = 'apps/e2e/acceptance-results/journeys.json';

// Playwright reports spec paths relative to its testDir; the manifest declares
// them from the repo root.
const SPEC_ROOT = 'apps/e2e/tests';

// Namespaces that are wholly infrastructure, not business flows — real
// appRouter keys only. `audit`/`user`/`facilityNetwork` are NOT here: they are
// claimed by ADMIN flows (ADM-04/02/03), so orphan detection covers the admin
// surface too (plan 260718-0423 E4). Only `health` (probe) and `lmsAuth` (auth
// plumbing: OTP variants, student login, child-password reset) stay whitelisted.
const INFRA_NAMESPACE_WHITELIST = new Set(['health', 'lmsAuth']);

// Individual infrastructure procedures inside otherwise-business namespaces.
// STRICT rule (E4): only provably infra-pure, read-only, non-admin procedures.
// Never an admin/auth-sensitive procedure — those must become a manifest flow
// or a documented gap, never a silent whitelist entry. Each needs a 1-line why.
const INFRA_PROCEDURE_WHITELIST = new Set([
  'session.me', // phiên đăng nhập hiện tại — hạ tầng nav-gating, đọc-only, không admin
]);

// Orphan procedures that ARE real capabilities but have no TL25 workflow / dedicated
// screen — deliberately NOT claimed by a flow and NOT whitelisted (E7 category c).
// These are honest "documented gaps": candidates for a future flow or a TL25 addendum.
// Keeping them out of the whitelist means they stay VISIBLE (not silently suppressed);
// this map only annotates them with a reason so the tool distinguishes triaged gaps
// from brand-new un-triaged orphans that need a decision.
const DOCUMENTED_GAPS: Record<string, string> = {
  // A1 nền lịch buổi (2026-08-13): bốn thủ tục dưới đây là NỀN cho việc đổi lịch
  // học của một lớp — trước A1 khung lịch chỉ tạo được một lần lúc lập lớp và
  // không có đường nào sửa hay gỡ. API đã có và có test, nhưng CHƯA MÀN NÀO GỌI:
  // `grep -rF "schedule.addSlot" apps/admin/src apps/lms/src` → 0 (cả bốn).
  // Không khai chúng vào luồng nào để bánh xe chắn orphan không đếm phủ không
  // tồn tại. Màn đổi lịch lớp là việc kế tiếp — tới lúc đó thì gỡ khỏi map này.
  'schedule.addSlot':
    'Thêm khung lịch cho lớp đang chạy; API + test có thật, chưa màn nào gọi (A1, 2026-08-13)',
  'schedule.updateSlot':
    'Sửa khung lịch của lớp; API + test có thật, chưa màn nào gọi (A1, 2026-08-13)',
  'schedule.archiveSlot':
    'Lưu trữ khung lịch (thay cho xoá, giữ dấu vết buổi cũ); API + test có thật, chưa màn nào gọi (A1, 2026-08-13)',
  'classSession.assignTeacher':
    'Đổi giáo viên cho một buổi (dạy thay); nhãn hiển thị, chưa phải nguồn quyền/chấm công; chưa màn nào gọi (A1, 2026-08-13)',
  // P2-04 chuyển soạn bài sang thư mục. curriculumUnit.list vẫn phục vụ màn lớp
  // (neo unit / assignUnit) nhưng chưa có luồng riêng khai procedure này.
  'curriculumUnit.list':
    'Danh mục unit còn dùng ở màn lớp; P2-04 soạn bài đã đổi sang exerciseFolder.* (2026-08-13)',
  // Procedure đổi tên / chuyển thư mục có thật. rg "exercise.update" trên
  // apps/admin/src + apps/lms/src = 0 (chỉ Prisma update status trong test API).
  // P2-04 không khai để bánh xe chắn orphan không đếm phủ không tồn tại.
  'exercise.update':
    'API đổi tên/chuyển thư mục bài có thật; chưa màn nào gọi (rg exercise.update apps/admin+lms = 0, 2026-08-13)',
  // PO quyết 2026-07-18: khoá học hiện import data, nhưng cần MÀN HÌNH tạo/quản lý
  // cho GĐĐT tự xử lý (không phụ thuộc IT chạy code) → tính năng tương lai cần xây;
  // trang /admin/courses hiện chỉ có danh sách (course.list), thiếu form tạo.
  'course.create': 'Tạo/quản lý khoá học cho GĐĐT — cần màn hình mới (hiện chỉ import data + trang danh sách; PO xác nhận là tính năng tương lai 2026-07-18)',
  // Triage 2026-07-24: P1-07 khai procedure này nhưng không màn LMS nào gọi
  // (`rg "enrollment\.mine" apps/lms/src` → 0 matches). Bỏ khỏi khai của luồng
  // để lời khai khớp thực tế; giữ ở đây để capability vẫn HIỆN, không bị whitelist
  // nuốt mất — trang phụ huynh hiện chưa có chỗ nào liệt kê lớp của con.
  'enrollment.mine': 'Danh sách lớp của con cho phụ huynh — procedure có thật nhưng chưa màn LMS nào gọi (triage 2026-07-24)',
  // LMS foundation unit-range spike (lmsOps namespace): real server capabilities
  // for class/unit grants, enrollment archive, delivery, session cancel+restamp.
  // `lmsOps.assignExerciseSequence` / `listExerciseSequence` đã có màn
  // /teaching/classes/:classBatchId/exercise-sequence và được P2-09 khai —
  // không còn trong map này. Các procedure còn lại chưa có UI/journey.
  'lmsOps.addWithUnits':
    'LMS foundation unit-range spike; no student-facing UI/journey yet; excluded from acceptance until wired',
  'lmsOps.archiveEnrollment':
    'LMS foundation unit-range spike; no student-facing UI/journey yet; excluded from acceptance until wired',
  'lmsOps.cancelSessionAndRestamp':
    'LMS foundation unit-range spike; no student-facing UI/journey yet; excluded from acceptance until wired',
  'lmsOps.createClassWithUnits':
    'LMS foundation unit-range spike; no student-facing UI/journey yet; excluded from acceptance until wired',
  'lmsOps.deliverSessionExercise':
    'LMS foundation unit-range spike; no student-facing UI/journey yet; excluded from acceptance until wired',
  'lmsOps.grantPast':
    'LMS foundation unit-range spike; no student-facing UI/journey yet; excluded from acceptance until wired',
  'lmsOps.revokeFromNext':
    'LMS foundation unit-range spike; no student-facing UI/journey yet; excluded from acceptance until wired',
  'lmsOps.rosterForSession':
    'LMS foundation unit-range spike; no student-facing UI/journey yet; excluded from acceptance until wired',
  'lmsOps.unarchiveEnrollment':
    'LMS foundation unit-range spike; no student-facing UI/journey yet; excluded from acceptance until wired',
};

/**
 * Structural honesty check on every declared `journey`. Two failures are
 * possible and they are treated very differently:
 *
 *  - a declared spec file that does not exist, or exists with no `test(` call,
 *    is a LIE IN THE MANIFEST — the ledger claims coverage that cannot exist.
 *    That fails the tool.
 *  - a flow whose spec runs and goes red is just a red flow. It renders with a
 *    reason badge and never fails the tool: a hard failure there would stop the
 *    whole ledger from rendering and reward typing any reason to unblock it.
 *
 * Returns the ids of flows whose declaration is structurally broken.
 */
function checkJourneyCoverage(manifestFlows: typeof flows): string[] {
  const broken: string[] = [];
  for (const flow of manifestFlows) {
    if (!flow.journey) continue;
    const specPath = path.join(REPO_ROOT, flow.journey);
    if (!existsSync(specPath)) {
      console.error(`  JOURNEY MISSING: flow "${flow.id}" declares journey "${flow.journey}" — file not found.`);
      broken.push(flow.id);
      continue;
    }
    // `test.fixme(...)` and `test.skip(...)` count as declared tests. Matching
    // the bare substring "test(" would fail this check the moment a red flow is
    // parked as `test.fixme` — which is precisely the ritual the plan requires
    // for a broken flow, so the tool would break on correct usage.
    const contents = readFileSync(specPath, 'utf8');
    if (!/\btest(\.(fixme|skip|only|describe))?\s*\(/.test(contents)) {
      console.error(`  JOURNEY EMPTY: flow "${flow.id}"'s journey "${flow.journey}" has no \`test(\` call.`);
      broken.push(flow.id);
    }
  }
  return broken;
}

function getHeadCommit(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

/** Full SHA, because that is what the run records. The short form above stays
 *  for display only — comparing evidence against a truncated commit would let
 *  two different commits look identical. */
function getHeadSha(): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

/** Reads the Playwright results file if one is there. A missing file is the
 *  normal state (nobody has run the UI suite yet), not an error — it just means
 *  no flow can be proven this run. */
function readRunFacts(): RunFacts | null {
  const resultsPath = path.join(REPO_ROOT, RESULTS_PATH);
  if (!existsSync(resultsPath)) return null;
  try {
    return ingestPlaywrightResults(JSON.parse(readFileSync(resultsPath, 'utf8')), { specRoot: SPEC_ROOT });
  } catch (error) {
    console.warn(`  RESULTS UNREADABLE: ${RESULTS_PATH} — ${(error as Error).message}`);
    return null;
  }
}

function verifyFlow(
  flow: (typeof flows)[number],
  scan: {
    procedures: ReadonlySet<string>;
    uiRoutes: ReadonlySet<string>;
    models: readonly string[];
    uiRouteInfo: ReadonlyMap<string, { placeholder: boolean; placeholderKind?: string }>;
  },
): Omit<FlowVerification, 'evidence'> {
  const missingTrpc = flow.expected.trpc.filter((p) => !scan.procedures.has(p));
  const missingRoutes = flow.expected.uiRoutes.filter((r) => !scan.uiRoutes.has(r));
  const missingModels = flow.expected.models.filter((m) => !scan.models.includes(m));

  const totalExpected = flow.expected.trpc.length + flow.expected.uiRoutes.length + flow.expected.models.length;
  const totalMissing = missingTrpc.length + missingRoutes.length + missingModels.length;

  // A route that resolves but renders a placeholder is not a delivered screen.
  // Without this the flow counts as built purely because the path exists, which
  // is how a "feature not implemented yet" page was reported as done.
  const placeholderRoutes = flow.expected.uiRoutes
    .map((path) => ({ path, info: scan.uiRouteInfo.get(path) }))
    .filter((r) => r.info?.placeholder)
    .map((r) => ({ path: r.path, kind: r.info!.placeholderKind ?? 'placeholder' }));

  const status: FlowStatus =
    totalMissing === totalExpected && totalExpected > 0
      ? 'missing'
      : totalMissing === 0 && placeholderRoutes.length === 0
        ? 'built'
        : 'partial';

  return {
    flow,
    status,
    missing: { trpc: missingTrpc, uiRoutes: missingRoutes, models: missingModels },
    placeholderRoutes,
  };
}

function computeProcedureOrphans(
  scannedProcedures: ReadonlySet<string>,
  manifestFlows: typeof flows,
): OrphanResult {
  const referenced = new Set(manifestFlows.flatMap((f) => f.expected.trpc));
  const orphans: string[] = [];
  for (const proc of scannedProcedures) {
    const namespace = proc.split('.')[0];
    if (INFRA_NAMESPACE_WHITELIST.has(namespace)) continue;
    if (INFRA_PROCEDURE_WHITELIST.has(proc)) continue;
    if (!referenced.has(proc)) orphans.push(proc);
  }
  orphans.sort();
  const documented = orphans
    .filter((p) => p in DOCUMENTED_GAPS)
    .map((procedure) => ({ procedure, reason: DOCUMENTED_GAPS[procedure] }));
  const untriaged = orphans.filter((p) => !(p in DOCUMENTED_GAPS));
  return { procedures: orphans, documented, untriaged };
}

function main(): void {
  const trpcScan = scanTrpcRouters();
  const uiRouteInfo = scanUiRoutesDetailed();
  const uiRoutes = new Set(uiRouteInfo.keys());
  const models = scanPrismaModels();

  // Whitelist entries must resolve to a real scanned namespace — a dead
  // entry means the whitelist is guessing, not describing the code (red-team #14).
  for (const ns of INFRA_NAMESPACE_WHITELIST) {
    if (!trpcScan.namespaces.includes(ns)) {
      throw new Error(`INFRA_NAMESPACE_WHITELIST entry "${ns}" does not match any scanned appRouter key`);
    }
  }

  // Liveness guard for the procedure-level whitelist (mirror of the namespace
  // guard above, E4): a dead entry means the whitelist is stale config nobody
  // can prove still describes real infra — fail loud so it can't silently rot.
  for (const proc of INFRA_PROCEDURE_WHITELIST) {
    if (!trpcScan.procedures.has(proc)) {
      throw new Error(`INFRA_PROCEDURE_WHITELIST entry "${proc}" does not match any scanned procedure`);
    }
  }

  // Liveness guard for documented gaps: a gap entry that no longer resolves to a
  // real procedure is stale — drop it from the map rather than leaving a lie.
  for (const proc of Object.keys(DOCUMENTED_GAPS)) {
    if (!trpcScan.procedures.has(proc)) {
      throw new Error(`DOCUMENTED_GAPS entry "${proc}" does not match any scanned procedure`);
    }
  }

  // A flow with zero expected symbols across all three dimensions would
  // vacuously compute totalMissing === totalExpected === 0 -> "built" with
  // nothing actually verified. That is a manifest-authoring mistake, not a
  // real flow — fail loudly instead of silently reporting false green.
  for (const flow of flows) {
    const totalExpected = flow.expected.trpc.length + flow.expected.uiRoutes.length + flow.expected.models.length;
    if (totalExpected === 0) {
      throw new Error(`Flow "${flow.id}" has no expected trpc/uiRoutes/models — manifest entry is empty`);
    }
  }

  const runFacts = readRunFacts();
  const headSha = getHeadSha();
  const evidenceRun: EvidenceRun = {
    resultsPath: RESULTS_PATH,
    present: runFacts !== null,
    sha: runFacts?.sha ?? null,
    headSha,
    dirty: runFacts?.dirty ?? false,
    projects: runFacts?.projects ?? [],
    runErrors: runFacts?.runErrors ?? 0,
    unrunJourneys: findUnrunJourneys(flows, runFacts),
  };

  const flowResults = flows.map((flow) => {
    const verification = verifyFlow(flow, { procedures: trpcScan.procedures, uiRoutes, models, uiRouteInfo });
    return {
      ...verification,
      evidence: composeFlowEvidence(flow, verification.status, runFacts, headSha),
    };
  });
  const orphans = computeProcedureOrphans(trpcScan.procedures, flows);
  const actorAudit = auditFlowActors(flows, trpcScan.permissionKeys);

  const result: VerificationResult = {
    generatedAt: new Date().toISOString(),
    commit: getHeadCommit(),
    evidenceRun,
    flows: flowResults,
    orphans,
    actorAudit,
    scan: {
      trpcNamespaceCount: trpcScan.namespaces.length,
      unresolvedNamespaces: trpcScan.unresolved,
    },
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(path.join(OUTPUT_DIR, 'verification.json'), JSON.stringify(result, null, 2));

  render(result, OUTPUT_DIR);

  const built = flowResults.filter((f) => f.status === 'built').length;
  const partial = flowResults.filter((f) => f.status === 'partial').length;
  const missing = flowResults.filter((f) => f.status === 'missing').length;
  console.log(
    `acceptance:report — ${flowResults.length} luồng (${built} built, ${partial} partial, ${missing} missing), ` +
      `${orphans.procedures.length} orphan (${orphans.documented.length} documented gap, ${orphans.untriaged.length} chưa phân loại), ` +
      `${trpcScan.unresolved.length} unresolved namespaces.`,
  );

  const brokenJourneys = checkJourneyCoverage(flows);
  const h2Mismatches = flows.filter((f) => f.statusReason?.code === 'h2-mismatch');
  for (const flow of h2Mismatches) {
    console.error(`  H2 MISMATCH: flow "${flow.id}" — ${flow.statusReason!.detail}`);
  }

  const journeyCount = flows.filter((f) => f.journey).length;
  const proven = flowResults.filter((f) => f.evidence.state === 'proven').length;
  console.log(`journey coverage — ${journeyCount}/${flows.length} luồng có journey spec.`);
  console.log(
    evidenceRun.present
      ? `bằng chứng chạy — ${proven}/${flows.length} luồng đã chứng minh chạy ` +
          `(results @ ${evidenceRun.sha ?? 'không ghi commit'}${evidenceRun.dirty ? '-dirty' : ''}, ` +
          `HEAD ${headSha.slice(0, 7)}, project ${evidenceRun.projects.join('+') || '—'})`
      : `bằng chứng chạy — KHÔNG có kết quả nào (${RESULTS_PATH} chưa tồn tại); mọi luồng dừng ở "chưa chứng minh".`,
  );
  if (evidenceRun.present && evidenceRun.sha !== headSha) {
    console.warn(`  KẾT QUẢ CŨ: results chạy ở commit khác HEAD — toàn bộ luồng hạ về "chưa chứng minh".`);
  }
  if (evidenceRun.dirty) {
    console.warn(
      `  WORKTREE BẨN: lần chạy diễn ra khi cây làm việc có thay đổi chưa commit — kết quả CHỈ THAM KHẢO, ` +
        `không phải sổ chính danh (sổ chính danh chỉ nhận artifact CI).`,
    );
  }
  if (evidenceRun.runErrors > 0) {
    console.warn(`  LẦN CHẠY CÓ LỖI MỨC RUN: ${evidenceRun.runErrors} lỗi (vd. globalSetup chết) — kết quả không đầy đủ.`);
  }
  // Liveness guard for hand-written statusReason entries, matching the guards
  // the infra whitelists above already have. Without it a reason outlives the
  // problem it describes, and stakeholders later read a stale "nguyên nhân đã
  // xác định" attached to a completely different failure.
  for (const flow of flows) {
    const reason = flow.statusReason;
    if (!reason) continue;
    if (reason.code === 'red-fixme' && runFacts?.specs[flow.journey ?? '']?.outcome === 'pass') {
      console.warn(`  STATUSREASON CŨ: luồng "${flow.id}" khai red-fixme nhưng spec đã chạy xanh — xoá lý do.`);
    }
    if (reason.code === 'no-ui-path' && flow.journey) {
      console.warn(`  STATUSREASON CŨ: luồng "${flow.id}" khai no-ui-path nhưng đã có journey — xoá lý do.`);
    }
  }
  if (evidenceRun.unrunJourneys.length > 0) {
    console.warn(
      `  CHẠY THIẾU (partial run): ${evidenceRun.unrunJourneys.length} spec đã khai nhưng không có trong kết quả — ` +
        `không dùng lần chạy này làm sổ chính danh.`,
    );
  }
  if (orphans.untriaged.length > 0) {
    console.warn(`  ORPHAN CHƯA PHÂN LOẠI (cần quyết định): ${orphans.untriaged.join(', ')}`);
  }
  if (trpcScan.unresolved.length > 0) {
    console.warn(`  UNRESOLVED namespaces (scanner could not parse): ${trpcScan.unresolved.join(', ')}`);
  }

  // Actor-vs-permission consistency. Reported, not yet fatal: the backlog it
  // surfaces predates this check, and a gate that fails on day one gets muted
  // rather than fixed. Promote to exit-code once the existing findings are
  // triaged.
  const byKind = (kind: string) => actorAudit.findings.filter((f) => f.kind === kind);
  console.log(
    `actor-audit — ${actorAudit.findings.length} phát hiện ` +
      `(${byKind('invalid-actor').length} vai không tồn tại, ${byKind('idle-actor').length} actor không làm được gì, ` +
      `${byKind('unreachable-procedure').length} procedure không actor nào gọi được); ` +
      `${actorAudit.ungatedProcedureCount} procedure ngoài tầm registry, ` +
      `${actorAudit.inconclusiveActorCount} (luồng, vai) không kết luận được`,
  );
  for (const f of [...byKind('invalid-actor'), ...byKind('idle-actor')]) {
    console.warn(`  ${f.kind.toUpperCase()} ${f.flowId} · ${f.subject}`);
  }
  console.log(`  -> ${path.join(OUTPUT_DIR, 'index.html')}`);

  // The report is written and rendered first, then the exit code is set: a
  // failing run must still leave the artifact behind to read. An untriaged
  // orphan means a procedure exists that no flow claims — either the manifest
  // is stale or something shipped nobody described; both need a decision, and
  // a warning nobody reads is how this went unnoticed until now.
  //
  // The two journey conditions here are structural claims that cannot be true:
  // a declared spec file that isn't there, and a declared mapping triage proved
  // wrong. A merely red flow is NOT in this list on purpose — see
  // checkJourneyCoverage.
  if (
    orphans.untriaged.length > 0 ||
    trpcScan.unresolved.length > 0 ||
    brokenJourneys.length > 0 ||
    h2Mismatches.length > 0
  ) {
    process.exitCode = 1;
  }
}

main();
