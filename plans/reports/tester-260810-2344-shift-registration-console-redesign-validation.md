# Shift Registration Console Redesign — Validation

## Summary

Focused component, type, build, static-contract, and Playwright collection checks pass. The real Chromium lifecycle journey was not runnable in this isolated checkout because a non-production test database configuration and the Playwright Chromium binary are absent.

## Acceptance evidence

| Criterion | Result | Evidence |
|---|---|---|
| Exact `shift.submit` payload | PASS | Component test asserts `{ shiftGroupId, fromDate, toDate, entries: [{ date, shiftTemplateId }] }`; 20/20 focused tests passed. |
| SINGLE / MULTIPLE native controls | PASS | Component maps SINGLE to `radio`, MULTIPLE to `checkbox`; focused tests cover replacing a SINGLE selection and retaining two MULTIPLE selections. |
| Preserve selection after submit error | PASS | `onError` only sets result state; focused test confirms the selected radio remains checked. |
| No 375px horizontal page overflow | STATIC ONLY | Mobile CSS stacks period fields and day cards below 768px; journey contains `document.documentElement.scrollWidth <= window.innerWidth` at 375px, but runtime proof is blocked locally. |
| Submit → reject → resubmit → approve → cancel selectors | COLLECTED / STATIC ONLY | Playwright lists the intended single journey; selectors match current labels and dialog roles, but the browser lifecycle was not runnable locally. |

## Commands and results

| Command | Result |
|---|---|
| `pnpm exec vitest run src/pages/attendance/shifts.test.tsx --reporter=verbose` (in `apps/admin`) | PASS — rerun: 1 file, 20 tests, 5.37s. JSDOM emitted existing `scrollTo` notices only. |
| `pnpm --filter @cmc/admin typecheck` | PASS |
| `pnpm --filter @cmc/e2e typecheck` | PASS |
| `pnpm --filter @cmc/admin build` | PASS — rerun: TypeScript and Vite production build completed. |
| `pnpm check:ui-a11y-roles` | PASS — 8/8 repository role checks. |
| `git diff --check` | PASS — no whitespace errors. |
| `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e exec playwright test --list --project=ui-chromium tests/journeys/shift-register-approve-reject.journey.ui.spec.ts` | PASS — collected exactly 1 lifecycle journey. |
| `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium -- tests/journeys/shift-register-approve-reject.journey.ui.spec.ts` | NOT RUN — `APP_DATABASE_URL` / `DATABASE_URL` were unset and local port 5432 was closed. Chromium is now available, but cannot replace the required disposable database. |

## Note on one non-scoping command

`pnpm --filter @cmc/admin test -- src/pages/attendance/shifts.test.tsx` was attempted first. The package script forwarded a separator that caused all 56 admin test files to run; 54 passed and two unrelated existing tests timed out (`my-hr.test.tsx`, `permission-gate.test.tsx`). The direct Vitest command above correctly scoped to `shifts.test.tsx` and passed.

## Unresolved questions

- Run the exact Chromium lifecycle command in CI or a local environment with the disposable test PostgreSQL variables and Chromium installed to convert responsive and selector evidence from static/collected to runtime proof.
