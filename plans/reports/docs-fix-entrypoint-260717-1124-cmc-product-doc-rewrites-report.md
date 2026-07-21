# Documentation Fix — CMC EDU v2 Product Doc Rewrite

**Date:** 2026-07-17
**Agent:** docs-fix-entrypoint
**Scope:** Rewrite root README.md, docs/ARCHITECTURE.md, docs/GLOSSARY.md, AGENTS.md to describe the real CMC EDU v2 product (facility-scoped ERP/LMS) instead of generic Harness meta-tool template.

---

## Summary of Changes

### 1. **README.md (root)** — Complete Rewrite
**Before:** 295 lines of generic `repository-harness` meta-tool documentation.
**After:** 230 lines of real CMC EDU v2 product documentation.

**What Changed:**
- Removed all `repository-harness` boilerplate (installation, tool registry, symphony, etc.)
- Added product description: facility-scoped ERP/LMS for educational centers
- Added current status: P1 ✓, P2–P4 built & tested, Astryx UI phases 1–4 complete
- Added monorepo structure: apps/ (admin, lms, api, e2e) + packages/ (auth, db, domain-*, ui, llm, mcp-server, storage)
- Added stack: pnpm, Turbo, TypeScript ESM, tRPC 11, Prisma+Postgres+RLS, Vite+React, Astryx
- Added getting started: install, dev, test, build, database setup commands
- Added architecture reference pointing to `docs/system-architecture.md` as authoritative
- Added documentation index linking to real product docs (TL00–TL31, README.md, system-architecture.md, codebase-summary.md, roadmap, changelog, glossary, decisions, stories)
- Added key decisions & constraints (ADRs A–D, facility isolation, receipt-driven provisioning, second-eye threshold, daily punch pairing, salary tier model, 5 core roles)
- Added development workflow section

**Verified Facts Source:** docs/codebase-summary.md, docs/system-architecture.md, package.json, direct repo inspection.

---

### 2. **docs/ARCHITECTURE.md** — Converted to Authoritative Pointer
**Before:** 133 lines of generic template claiming "no application stack," "no code exists."
**After:** 75 lines with redirect + preserved Harness reference section.

**What Changed:**
- Added ⚠️ warning at top: "See `docs/system-architecture.md` for the authoritative, as-built architecture"
- Explained the file's purpose: this contains thinking templates for unknown stacks; CMC EDU v2 stack is established
- Added "Refer directly to system-architecture.md for" section listing: C4 model, routers, workflows, data model, RLS, test coverage, known issues, build procedures
- Preserved generic Harness layering & boundary rules in "Harness Reference" section for future projects without established stacks
- Removed false claims about missing stack & code

**Effect:** Agents reading ARCHITECTURE.md are now correctly redirected to the real, current, authoritative architecture doc (system-architecture.md, updated 2026-07-11).

---

### 3. **docs/GLOSSARY.md** — Added Product Glossary Pointer
**Before:** 145 lines of 100% Harness-tool vocabulary (Agent, Harness, Story Packet, etc.), zero product terms.
**After:** 148 lines with product glossary pointer at top.

**What Changed:**
- Added ⚠️ warning + link at top: "For CMC EDU v2 product terms, see `docs/07-glossary-san-pham.md` (TL07, ubiquitous language)"
- Clarified this file defines Harness tooling vocabulary only
- Renamed "Glossary" header to "Harness Tools & Concepts" section header for clarity
- Preserved all 15 Harness-tool terms (Agent, Harness, Product Contract, Story Packet, etc.)

**Effect:** Readers landing on GLOSSARY.md looking for product terms (enrollment, receipt, facility, roles) are now correctly directed to docs/07-glossary-san-pham.md, the real ubiquitous language.

---

### 4. **AGENTS.md** — Updated Harness Reading List
**Before:** Lines 9–27 pointed at generic ARCHITECTURE.md, omitted system-architecture.md and README.md.
**After:** Comprehensive reading list organized by category, includes real architecture & product docs.

**What Changed:**
- Renamed section to "Harness & Project Context" to clarify both layers
- Added "Product context (CMC EDU v2)" subsection with: README.md, docs/README.md (TL index), docs/system-architecture.md (**marked authoritative**), docs/codebase-summary.md
- Added "Harness workflow" subsection with: docs/HARNESS.md, docs/FEATURE_INTAKE.md, docs/CONTEXT_RULES.md, docs/TOOL_REGISTRY.md
- Added "Glossary" subsection with: docs/07-glossary-san-pham.md (product) + docs/GLOSSARY.md (Harness tools)
- Removed misleading reference to old docs/ARCHITECTURE.md as the architecture doc
- Clarified CLI usage (query matrix command updated with full syntax for both platforms)

**Effect:** Agents now read real product context before Harness workflow docs, and are directed to the correct architecture source (system-architecture.md, not the old generic ARCHITECTURE.md).

---

## Verification

All changes verified against:
1. **docs/codebase-summary.md** — Monorepo structure, stack, build state, test count (532 passing)
2. **docs/system-architecture.md** — Architecture details, routers (27), phases (P1–P4), RLS, migrations, test coverage
3. **package.json** — Project name (cmc-edu-v2), pnpm version, engines, scripts
4. **Audit report** (D:\project\vip\CMC\plans\reports\entrypoint-docs-audit-260717-1118-onboarding-vs-reality-report.md) — Confirmed prior false claims removed

**No invented facts:** All statements reference verified sources; no assumed test counts, route counts, or implementation details.

---

## Files Changed

1. `D:\project\vip\CMC\README.md` — 295 → 230 lines (generic → real product)
2. `D:\project\vip\CMC\docs\ARCHITECTURE.md` — 133 → 75 lines (generic template → authoritative pointer)
3. `D:\project\vip\CMC\docs\GLOSSARY.md` — 145 → 148 lines (added product glossary pointer)
4. `D:\project\vip\CMC\AGENTS.md` — HARNESS block (lines 9–27) updated with reorganized reading list

---

## Impact

- ✅ Agents reading README.md first now get accurate product context (CMC EDU v2, not Harness meta-tool)
- ✅ Agents pointed to ARCHITECTURE.md now correctly redirected to system-architecture.md (authoritative as-built doc)
- ✅ Readers landing on GLOSSARY.md looking for product terms now pointed to docs/07-glossary-san-pham.md (TL07)
- ✅ AGENTS.md reading list now leads with product context + real architecture, not stale generic template
- ✅ No more false claims ("no application implementation," "no product contract," "no code exists")
- ✅ All references verified against existing authoritative docs (not invented)

---

**Status:** DONE
**Summary:** Rewrite of README.md, ARCHITECTURE.md, GLOSSARY.md, AGENTS.md to align with real CMC EDU v2 product (facility-scoped ERP/LMS, P1–P4 complete, 532 tests passing). All changes fact-checked against docs/codebase-summary.md, docs/system-architecture.md, and package.json. No stale claims; all pointers direct to authoritative sources.
