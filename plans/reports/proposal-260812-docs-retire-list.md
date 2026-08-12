# Proposal — docs / plans retire list (READ-ONLY)

**Date:** 2026-08-12  
**Author:** ui-lean (S3)  
**Status:** **PROPOSAL ONLY** — no deletes, no moves, no archive automation in this wave  
**Authority context:** [`scout-260812-ui-workspace-residual-matrix.md`](./scout-260812-ui-workspace-residual-matrix.md) §5 · [`INDEX-live-260812.md`](./INDEX-live-260812.md)

---

## Intent

Give agents a short list of **historical / superseded** surfaces so they do not treat every file under `plans/` or older design docs as live product authority.  
**Do not** mass-delete `plans/*`, TL corpus, or reports to “clean” the tree.

---

## Live authority (do not retire)

| Path | Why live |
|------|----------|
| `docs/ux-resource-centric-structure.md` | LOCKED UX structure |
| `docs/design-system-console.md` | Admin Console chrome / tokens |
| `docs/06-kien-truc-url-routing.md` | URL grammar |
| `docs/system-architecture.md` | As-built |
| `docs/WORKSPACE-LEAN.md` | Agent workspace entry |
| `plans/reports/INDEX-live-260812.md` | Live pointer |
| `plans/reports/scout-260812-ui-workspace-residual-matrix.md` | Residual dual-HITL truth |
| TL00–TL31 under `docs/` | Frozen design corpus (history + decision trail) |

---

## Candidates for “prefer not as authority” (keep files)

| Candidate | Reason | Suggested treatment |
|-----------|--------|---------------------|
| `docs/12-design-system-ui.md` (TL12) | Superseded **for admin Console chrome** by `design-system-console.md`; TL12 remains design-corpus history | Prefer Console doc for admin UI work; keep TL12 for corpus completeness |
| Pre-UAT / early golive plan dirs under `plans/260707-*`, `plans/260708-*` (examples) | Superseded by later execution + as-built `system-architecture.md` | History only; open only when tracing old decisions |
| Older residual advise notes that predate scout matrix (e.g. coord residual table before `8ce3a24`) | Coord brief still useful as session context; dual-HITL rows outdated | Prefer scout matrix for residual status |
| Large brainstorm/research report backlog in `plans/reports/` (~300+) | Archive value; not day-to-day authority | Discover via INDEX + date; do not bulk delete |
| Root local noise already gitignored (`harness.db*`, design screenshots, `presentation-deck/`, …) | Not product source | Keep ignored; do not force-add |

---

## Explicit non-actions (this proposal)

1. **No file deletes** and no bulk `git rm` of `plans/*`.
2. **No** moving TL00–TL31 out of `docs/`.
3. **No** auto-archive scripts in this wave.
4. Leave `release-manifest.json` tracked if CI/release still uses it (scout §5).

---

## Optional future (human OK required)

- Add a one-line banner at the top of a few high-traffic superseded plan dirs: “historical — see INDEX-live + system-architecture”.
- If a doc is proven unused **and** broken-link free after a dedicated audit, consider archive branch or `docs/archive/` — only with owner approval and link rewrite plan.

---

## Acceptance for this proposal file

- [x] Written under `plans/reports/`
- [x] Linked from INDEX-live
- [x] Zero filesystem deletes
