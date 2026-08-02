# Tier 2 (cut scope) — Trivy misconfig job + action SHA pinning

Branch: `feat/tier2-trivy-misconfig` (off `main`, uncommitted — controller PRs).
Plan: `plans/260802-0651-tier-2-vendored-semgrep-trivy-scanners/plan.md`
("Decision đã chốt (SAU red-team)" section). Red-team basis:
`plans/reports/red-team-260802-0651-tier2-vendored-scanners.md`.

## Scope executed (only the 2 in-scope items)

1. New `security-scan` job in `.github/workflows/ci.yml` — Trivy `config`
   (misconfig/IaC) scan, report-only, SHA-pinned `trivy-action`.
2. Pinned the 4 pre-existing first-party actions (`actions/checkout`,
   `actions/setup-node`, `pnpm/action-setup`, `actions/upload-artifact`) to
   commit SHAs with `# v4` comments, at all call sites (3 jobs × 3 actions +
   1 upload-artifact = 10 lines total).

Not touched (per decision — Semgrep, vendoring, CodeQL UI toggle are out of
this task's scope): confirmed no Semgrep/vendored-script references exist in
this repo to begin with.

## `security-scan` job (full step list)

```yaml
security-scan:
  runs-on: ubuntu-latest
  continue-on-error: true
  steps:
    - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4

    - name: Trivy config scan (Dockerfile/compose/nginx misconfig)
      uses: aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25 # v0.36.0
      with:
        scan-type: config
        scan-ref: .
        skip-dirs: .claude,node_modules,.git
        format: table
        output: trivy-config-report.txt
        exit-code: '0'

    - name: Upload Trivy report artifact
      if: always()
      uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
      with:
        name: trivy-config-report-${{ github.sha }}
        path: trivy-config-report.txt
        if-no-files-found: warn
```

Design choices and why:
- **`scan-type: config`** (not `fs`/`vuln`/`secret`) — the only non-overlapping
  signal per red-team F3 (Dependabot owns CVE, GH secret-scanning+push
  protection owns secrets, and CI checkout only sees committed files anyway —
  the untracked `.env.prod`/`privkey.pem` the advisor found are gitignored,
  verified: `git check-ignore -v infra/nginx/certs/{privkey,fullchain}.pem`
  → both match `.gitignore:180`, `git ls-files` on that dir returns empty).
- **`exit-code: '0'` + job-level `continue-on-error: true`** — report-only,
  never fails the job or the check. Not added to branch-protection required
  checks (nothing in `.github/` or repo settings references it as required —
  only additive).
- **Trigger** — no job-level `on`/`if` override, so it inherits the workflow's
  top-level `pull_request` + `push` triggers, same as `typecheck-and-test`.
- **`format: table`** (not `sarif`) — chosen over sarif because nothing in
  this repo uploads to GitHub code-scanning (that's CodeQL's UI-managed slot,
  explicitly out of scope here); a human doing the "weekly glance" the
  red-team recommends (second-order effects section) can just open the
  artifact text file, no SARIF viewer needed. `format`/`output`/`scan-type`/
  `scan-ref`/`skip-dirs`/`exit-code` input names verified against the actual
  `action.yaml` at tag `v0.36.0` (fetched via `gh api .../contents/action.yaml?ref=v0.36.0`).
- **`skip-dirs: .claude,node_modules,.git`** — excludes the noise called out
  in the task (`.claude/**`) plus the two dirs with no IaC content.
- **No `trivyignore`/baseline file** — red-team F6 parks that; report-only
  needs none.

## Pinned actions (all 4, resolved via `gh api .../git/refs/tags/<tag>`)

| Action | Tag resolved | Commit SHA | Verified real commit |
|---|---|---|---|
| `actions/checkout` | `v4` | `11d5960a326750d5838078e36cf38b85af677262` | yes, 2026-07-16 (matches release `v4.4.0`) |
| `actions/setup-node` | `v4` | `49933ea5288caeca8642d1e84afbd3f7d6820020` | yes, 2025-04-02 (matches release `v4.4.0`) |
| `pnpm/action-setup` | `v4` | `b906affcce14559ad1aafd4ab0e942779e9f58b1` | yes, 2026-03-11 (matches release `v4.3.0` — see note) |
| `actions/upload-artifact` | `v4` | `ea165f8d65b6e75b540449e92b4886f43607fa02` | yes, 2025-03-19 (matches release `v4.6.2`) |
| `aquasecurity/trivy-action` (new) | `v0.36.0` (latest stable, checked `prerelease:false`/`draft:false`) | `ed142fd0673e97e23eac54620cfb913e5ce36c25` | yes, 2026-04-22 |

Every SHA re-verified with a second call (`gh api repos/<owner>/<repo>/commits/<sha>`)
that returned the same SHA + a real commit date — none 404'd.

**Note on `pnpm/action-setup`:** the `v4` tag/ref is an *annotated* tag (unlike
the other 3, which are lightweight), so `git/refs/tags/v4` returns the tag
object's own SHA, not the commit — required an extra peel via
`gh api repos/pnpm/action-setup/git/tags/<tag-sha>` to reach the commit SHA.
Also worth flagging: that `v4` ref currently points at the commit tagged
`v4.3.0`, even though `v4.4.0` already exists as a separate tag — i.e.
upstream hasn't moved the major-version alias forward yet. Pinning to what
`v4` resolves to *today* is correct here: it's a zero-behavior-change pin
(byte-identical to what CI already runs), matching the "no breaking change"
constraint; Dependabot (github-actions ecosystem, already enabled) will PR
the SHA+comment forward on its own schedule regardless of which patch it
started from.

## Verify

```
$ python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML OK — jobs:', list(d['jobs'].keys()))"
YAML OK — jobs: ['typecheck-and-test', 'e2e', 'ui-e2e', 'security-scan']

$ grep -n 'uses:.*@v[0-9]' .github/workflows/ci.yml
none found — all pinned
```

`git diff --stat`: `.github/workflows/ci.yml | 54 +++++++++++++++++++++++++++++++++++++++---------` —
44 insertions / 10 deletions, single file, additive only (existing job bodies
otherwise untouched). Did not run full CI locally (per instructions).

## State

Branch `feat/tier2-trivy-misconfig`, uncommitted, working tree has exactly
one modified file (`.github/workflows/ci.yml`). No commit made — leaving for
controller/git-manager per instructions.

## Unresolved questions

None blocking. One FYI already covered above: `pnpm/action-setup`'s `v4` ref
lags its own `v4.4.0` release by one minor — not a defect in this change, just
noted in case the controller wants to intentionally bump to `v4.4.0`
(`fc06bc1257f339d1d5d8b3a19a8cae5388b55320`) instead of the exact-current pin;
I kept the zero-behavior-change pin per the "no breaking change" constraint.

Status: DONE
Summary: Added report-only `security-scan` job (Trivy config/misconfig scan, SHA-pinned trivy-action@v0.36.0) and SHA-pinned all 4 existing first-party actions in ci.yml with `# v4` comments; YAML verified valid, all SHAs verified against GitHub API.
Concerns/Blockers: none — pnpm/action-setup's `v4` alias trails its `v4.4.0` release by one minor (noted above), purely informational.
