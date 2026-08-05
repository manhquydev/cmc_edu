# Journal — Cook offline presentation deck

**When:** 2026-08-05  
**Plan:** `plans/260805-0811-deck-thuyet-trinh-van-hanh-he-thong/`  
**Mode:** `/ak:cook --tdd --auto`

## What landed

Offline reveal.js deck generator under `scripts/presentation/`:

- Data path: manifest + `verification.json` + `business-verification.json` → two-tier audience labels (D8/D9)
- Diagrams L1–L4 + SVG screen sketches (no real screenshots)
- Character spine (8 beats ≤25 words) + clickable home map + 38 flow lookup slides
- Presenter notes in `aside.notes`, PDF without notes, system fonts, UMD vendor ~261KB
- Scripts: `pnpm deck:build`, `pnpm deck:check`, `pnpm test:deck` (28 tests)
- Output: gitignored `/presentation-deck/`

## Hard lessons this session

1. **Reveal 5 UMD is `Reveal.initialize(...)`, not `new Reveal`.** Wrong API left `isReady() === false` and broke keyboard handlers.
2. **`Reveal.slide(domEl)` is wrong** — need `getIndices(el)` then `slide(h, v)`. H-key home map depended on this.
3. **Do not `rmSync` output before vendor succeeds** — missing `reveal.js` wiped a good deck. Fixed with staging dir.
4. **Branch switch mid-cook dropped uncommitted `package.json` / `.gitignore` wiring** while untracked `scripts/presentation/` survived. Always re-check package surface after subagents / branch moves.
5. **SVG `height="auto"` is invalid** and spam console errors on Chrome.

## Still open (human)

- Timed full dry-run 60–90 min (checklist in dry-run report)
- Refresh acceptance + business JSON to HEAD, then `pnpm deck:build -- --release`
- Presentation machine choice (plan Q1)

## Evidence

- `pnpm test:deck` → 28/28
- `file://` Chrome headless: Reveal ready, 64 slides, H → home-map, 0 page errors
- `--release` correctly fails on stale SHA (`d359249` ≠ `83b59b0`)
