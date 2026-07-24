// Runtime capture: open every admin screen as every role that might reach it,
// and record what the browser actually asked the API for and what it got back.
//
// This inverts the usual direction of acceptance evidence. Instead of asking a
// person "which procedures does this flow need?" and checking those exist, it
// opens the real screen with a real role and writes down every call. A denied
// call is a finding — nobody has to have predicted it in advance.
//
// Two mistakes this is built to avoid:
//
// 1. HTTP status is not the discriminator. The admin client batches procedures
//    through `httpBatchLink`, so several calls share one request that returns
//    200 with a JSON array; a denial sits inside an element of that array.
//    Reading `response.status()` produces an empty findings table even on a
//    commit where flows are provably broken. The body is parsed instead.
//
// 2. An empty screen and a forbidden screen look identical. A dropdown with no
//    options may be missing data or missing permission — only the error code in
//    the body tells them apart, never the rendered content.
//
// 3. A screen can be silently empty. A client-side `canDo()` gate can stop a
//    screen from calling anything at all before any request is issued, and a
//    call that never fires leaves nothing in `denied`/`notFound` to find. This
//    capture additionally opens every `screen-should-call.ts` pair — one KNOWN
//    to fire ≥1 request when the role belongs there — and flags a zero-call
//    outcome as `silentScreens`.
//
// Known limitation, stated rather than buried: `silentScreens` only covers the
// pairs declared in `screen-should-call.ts`. A screen outside that declared
// set that goes silent for some other role is not caught here — the capture
// supplements a reading of those call sites; it does not replace one. Nor does
// this capture make any claim about payload shape: a call that returns
// `{items: []}` reads as `ok` here regardless of whether that is the correct
// answer for the seeded data. Proving a screen's data is non-empty for a real
// scenario is a journey's job (`*.journey.ui.spec.ts`), not this capture's —
// journeys create their own data through real UI action sequences, so a
// non-empty assertion there is meaningful; this capture runs against a
// deliberately empty DB (no business seed) where "empty" proves nothing about
// data-shape correctness.
//
// Run: PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium \
//        screen-role-capture

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { mintStaffCookie } from '../src/session-injection.js';
import { seedAppUser } from '../src/db.js';
import { STAFF_COOKIE_NAME } from '../../api/src/auth/staff-session.js';
import type { ScreenRolePair } from '../src/screen-role-matrix.js';
import { SCREEN_SHOULD_CALL } from '../src/screen-should-call.js';
import type { Role } from '@cmc/auth';

const here = path.dirname(fileURLToPath(import.meta.url));
const MATRIX_PATH = path.join(here, '..', 'screen-role-matrix.json');
const OUTPUT_PATH = path.join(here, '..', 'capture-output', 'screen-role-capture.json');

const facilityId = process.env.E2E_FACILITY_ID!;

interface MatrixFile {
  pairCount: number;
  pairs: ScreenRolePair[];
}

function matrixRoles(matrixPath: string): string[] {
  return (JSON.parse(readFileSync(matrixPath, 'utf8')) as MatrixFile).pairs.map((pair) => pair.role);
}

/** Outcome of one procedure call. `notFound` is deliberately its own category:
 *  a synthetic identity that matches no AppUser gets NOT_FOUND rather than
 *  FORBIDDEN from owner-checked procedures, and folding that into "clean" would
 *  report exactly the group the permission registry does not cover as healthy. */
type Outcome = 'ok' | 'forbidden' | 'notFound' | 'otherError';

interface CallRecord {
  path: string;
  role: string;
  procedure: string;
  outcome: Outcome;
  /** Error code only — never the raw message, which can carry connection
   *  strings and credentials into a report that gets shared. */
  code?: string;
}

/** Procedure names ride in the URL path segment, comma-separated, in the same
 *  order as the elements of the response array. */
function proceduresFromUrl(url: string): string[] {
  const afterTrpc = url.split('/trpc/')[1];
  if (!afterTrpc) return [];
  return decodeURIComponent(afterTrpc.split('?')[0]).split(',').filter(Boolean);
}

function outcomeFor(code: string | undefined): Outcome {
  if (!code) return 'ok';
  if (code === 'FORBIDDEN' || code === 'UNAUTHORIZED') return 'forbidden';
  if (code === 'NOT_FOUND') return 'notFound';
  return 'otherError';
}

/** Pulls the tRPC error code out of one element of a batch response. */
function codeOfElement(element: unknown): string | undefined {
  const err = (element as { error?: { data?: { code?: unknown } } } | null)?.error;
  if (!err) return undefined;
  const code = err.data?.code;
  return typeof code === 'string' ? code : 'UNKNOWN';
}

test.describe('screen × role runtime capture', () => {
  // The ui-chromium project points at the parent/student preview by default.
  // Without this override every admin path would land on an app that has no
  // such route, fire no requests, and be recorded as clean.
  test.use({ baseURL: 'http://localhost:4173' });

  test('records every tRPC call each role makes on each admin screen', async ({ browser }) => {
    // One test opens every pair in sequence, so the budget is the whole sweep,
    // not one page load: roughly a hundred navigations at a couple of seconds
    // each. The default 30s cuts the run off partway and reports a timeout
    // instead of the findings.
    test.setTimeout(20 * 60 * 1000);

    // Each role gets a real seeded staff profile. A minted session is believed
    // verbatim, so an invented userId matches no AppUser — and the procedures
    // whose authorization is an ownership check rather than a permission key
    // answer "no profile here" with FORBIDDEN. Those denials look exactly like
    // a permission bug and are not one, which is precisely the group the
    // registry does not cover, so the identity has to be real.
    const identities = new Map<string, string>();
    for (const role of [...new Set(matrixRoles(MATRIX_PATH))]) {
      const userId = `capture-${role}`;
      await seedAppUser({ facilityId, userId, roles: [role as Role], position: role });
      identities.set(role, userId);
    }

    const matrix = JSON.parse(readFileSync(MATRIX_PATH, 'utf8')) as MatrixFile;
    // Param routes need a real id to open; they are reported as skipped rather
    // than silently dropped, so the counts still reconcile.
    const runnable = matrix.pairs.filter((pair) => !pair.needsParam);
    const records: CallRecord[] = [];

    for (const pair of runnable) {
      const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
      await context.addCookies([
        {
          name: STAFF_COOKIE_NAME,
          value: mintStaffCookie({ userId: identities.get(pair.role)!, roles: [pair.role], facilityId }),
          domain: 'localhost',
          path: '/',
        },
      ]);
      const page = await context.newPage();

      // Every `.json()` promise is collected here as it fires, rather than
      // fire-and-forget (the prior `void response.json().then(...)` race):
      // the parse can outlive the fixed wait below under load or CI resource
      // contention, and closing the context while a parse is still pending
      // drops that call's record — a pair that DID call something would then
      // look identical to a genuine `silentScreens` finding. `allSettled`
      // below waits out every promise collected here before either count is
      // trusted.
      const pending: Promise<void>[] = [];

      page.on('response', (response) => {
        const url = response.url();
        if (!url.includes('/trpc/')) return;
        const procedures = proceduresFromUrl(url);
        pending.push(
          response
            .json()
            .then((body: unknown) => {
              const elements = Array.isArray(body) ? body : [body];
              elements.forEach((element, index) => {
                const code = codeOfElement(element);
                records.push({
                  path: pair.path,
                  role: pair.role,
                  procedure: procedures[index] ?? procedures[0] ?? 'unknown',
                  outcome: outcomeFor(code),
                  ...(code ? { code } : {}),
                });
              });
            })
            .catch(() => {
              /* Non-JSON responses carry no procedure outcome. */
            }),
        );
      });

      // Deliberately not `networkidle`: a screen whose queries are being denied
      // is exactly the screen that retries and never goes idle, so waiting for
      // idle spends the longest on the screens this exists to find — enough to
      // blow the budget on a run with real findings. The calls are made on
      // mount, so loading the document and giving them a moment is enough.
      await page.goto(pair.path, { waitUntil: 'domcontentloaded', timeout: 10_000 }).catch(() => {
        /* A screen that fails to load still yields whatever it called. */
      });
      // Still needed to let requests get issued in the first place — not part
      // of the race, a separate already-accepted design choice.
      await page.waitForTimeout(1_200);
      // Drains every `.json()` promise collected above before the pair's call
      // count is read anywhere below (the `denied`/`notFound` filters and,
      // crucially, the `silentScreens` zero-call check after the loop) and
      // before the context that owns those in-flight parses closes.
      await Promise.allSettled(pending);
      await context.close();
    }

    const denied = records.filter((r) => r.outcome === 'forbidden');
    const notFound = records.filter((r) => r.outcome === 'notFound');

    // `session.me` fires on every single pair — `SessionProvider`
    // (apps/admin/src/main.tsx) mounts once above the router and queries it
    // for the whole app shell, not per screen. A falsification run proved
    // this the hard way: counting raw `records.length` never went to zero for
    // ANY pair, session.me alone always keeping it at 1+, so a real
    // client-side gate that blocked a screen's own query produced no finding
    // at all. Only a screen's OWN on-mount call says anything about that
    // screen, so the shell-level identity call is excluded here before the
    // zero-call check below.
    const SHELL_PROCEDURES = new Set(['session.me']);
    const screenOwnRecords = records.filter((r) => !SHELL_PROCEDURES.has(r.procedure));

    // Trusted only now: every response `.json()` promise fired during the
    // sweep has been awaited (Promise.allSettled above), so a pair with zero
    // screen-own records here really made zero screen-level calls — it is not
    // an artifact of the context closing on an unresolved parse.
    const silentScreens = SCREEN_SHOULD_CALL.filter(
      (pair) => !screenOwnRecords.some((r) => r.path === pair.path && r.role === pair.role),
    );

    mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(
      OUTPUT_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          pairsInMatrix: matrix.pairCount,
          pairsRun: runnable.length,
          pairsSkippedNeedingParam: matrix.pairs.length - runnable.length,
          callsObserved: records.length,
          denied,
          notFound,
          silentScreens,
          records,
        },
        null,
        2,
      ),
    );

    const summary = new Map<string, Set<string>>();
    for (const record of denied) {
      const key = `${record.path} [${record.role}]`;
      summary.set(key, (summary.get(key) ?? new Set()).add(record.procedure));
    }
    console.log(`\nscreen-role-capture — ${runnable.length} pairs, ${records.length} calls, ${denied.length} denied, ${silentScreens.length} silent`);
    for (const [key, procedures] of [...summary.entries()].sort()) {
      console.log(`  DENIED ${key}: ${[...procedures].sort().join(', ')}`);
    }
    for (const pair of silentScreens) {
      console.log(`  SILENT ${pair.path} [${pair.role}]`);
    }
    if (notFound.length > 0) {
      console.log(`  (${notFound.length} NOT_FOUND results — owner-checked procedures, reported separately)`);
    }

    // The capture is only meaningful if screens actually talked to the API.
    // Zero calls means the run opened the wrong app or never authenticated,
    // which would otherwise read as a perfectly clean result.
    expect(records.length, 'capture observed no tRPC calls at all').toBeGreaterThan(0);
  });
});
