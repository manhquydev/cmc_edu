# Harness Backlog

Use this file when an agent discovers a missing harness capability but should
not change the operating model immediately.

## Template

```md
## Missing Harness Capability

### Title

Short name.

### Discovered While

Task or story that exposed the gap.

### Current Pain

What was hard, repeated, ambiguous, or unsafe?

### Suggested Improvement

What should be added or changed?

### Risk

Tiny, normal, or high-risk.

CLI value: `--risk tiny`, `--risk normal`, or `--risk high-risk`.

### Status

proposed | accepted | implemented | rejected
```

## Items

## Missing Harness Capability

### Title

MCP tool-call audit trail (design-in, not vá sau)

### Discovered While

Log system remediation Hướng A+ (2026-07-19) — T8 threat-model gap analysis
found `packages/mcp-server` is currently a skeleton stub
(`src/tools.ts:1-10`, no `@modelcontextprotocol/sdk` wired yet).

### Current Pain

No pain yet — the gap is that when the walk-phase wires the real MCP SDK into
`packages/mcp-server` (currently a skeleton stub — `src/tools.ts:1-10`), there
is no standing requirement forcing every `callTool` invocation to write an
`AuditLog` row (actor=agent principal, tool name, args sanitized via the same
`sanitizeAuditData` denylist as tRPC mutations). `docs/13-ai-agent-llm-integration.md:114`
/ threat-model T8 already require this for LLM/agent actions generally.

### Suggested Improvement

When wiring the real MCP SDK, add tool-call auditing to the design from the
start — mirror the tRPC `auditLogMiddleware` pattern
(`apps/api/src/trpc.ts:148-172`): wrap every `callTool` handler, write one
`AuditLog` row per call (best-effort, non-blocking), sanitize args through
`sanitizeAuditData`. Do not treat this as a post-launch patch — the OTP
denylist incident (`docs/journals/260716-super-admin-completion-audit-middleware.md`)
is the cautionary precedent for "add the audit gap-fix after the fact instead
of at design time."

### Risk

Normal — no immediate user-facing impact (skeleton has no real tool calls
yet), but a real gap once the walk-phase lands MCP tool execution.

### Status

proposed

---

## Missing Harness Capability

### Title

Log shipping before go-live (Docker rotation alone is anti-forensic)

### Discovered While

Log system remediation Hướng A+ (2026-07-19), phase 4 (Docker log rotation).
Red-team finding SA-5.

### Current Pain

Phase 4 of this plan adds Docker `json-file` log rotation
(`max-size: "10m"`, `max-file: "3"`, ~30MB cap/service) to stop an
error-looping container from filling the VPS disk. That rotation cap is
sufficient for "investigate the most recent incident" but is **anti-forensic**
against a deliberate attacker: someone who can trigger log volume (e.g.
repeated failed logins, OTP brute-force attempts) can flood a service's own
stdout to roll its own attack evidence out of the 30MB window before anyone
looks. Separately, pre-session security events (failed login, OTP
brute-force) currently exist ONLY in stdout logs — they are never written to
`AuditLog` (which requires an authenticated session/actor to attribute a
row to), so once rotated out, they are gone.

### Suggested Improvement

Before go-live, ship container logs to storage outside the host (or, as a
cheaper interim step, raise the rotation cap and accept the trade-off
explicitly) — add this to the go-live checklist alongside the other
`docs/uat-checklist-go-live.md` items. This is a deliberate deferral, not an
oversight: the project has not gone live yet (`docs/project-changelog.md`
infra decisions), so log shipping infra is out of scope for this pre-launch
remediation pass.

### Risk

Normal for now (pre-launch, no real attacker); becomes high-risk if left
unaddressed past go-live (anti-forensic gap + missing pre-session security
event trail).

### Status

proposed

---

## Missing Harness Capability

### Title

T8 audit gap: LLM provider HTTP-failure-after-egress writes 0 audit rows

### Discovered While

Independent code review of log system remediation Hướng A+ (2026-07-19),
phase 1 (T8 LLM-egress audit). Not raised in either of the 2 prior red-team
rounds on this plan.

### Current Pain

`assessment.draftComment` (`apps/api/src/assessment/router.ts`) writes a T8
`.llm` audit row in a `finally` block wrapping the mutation transaction — but
only once `llmClient.draftAssessment(prompt)` has returned successfully. The
plan's Risk Assessment (`phase-01-t8-agent-audit-patch.md`) states that any
throw from `draftAssessment` means "no egress happened, so no row is
correct" — true for the PII guard and the prod-guard (both throw BEFORE any
network call), but **not true** for the real (non-stub) LLM client's HTTP
failure paths (`packages/llm/src/index.ts`): a non-2xx response or an
unparseable response body throws AFTER the `fetch()` request was already
transmitted — i.e. after real egress. That throw propagates straight past
the audit-write block, so a genuine LLM-provider failure (rate limit,
outage, auth rotation, malformed response) in production leaves **zero**
audit row for an egress event that did happen — the exact blind spot T8
exists to close, for that one sub-case.

Not a PII-exposure risk (the prompt is PII-free by separate design), but an
audit-completeness gap.

### Suggested Improvement

Either (a) accept this as a documented, deliberately-scoped limitation of
this pass, or (b) restructure `draftAssessment`'s real-path error handling
to signal "the network request was dispatched" distinctly from "rejected
before dispatch" (e.g. tag the thrown error, or move audit-row writing to
wrap the `fetch()` call itself), then extend the router's outer catch to
write a `.llm` row with a new `outcome` value (e.g. `'llm_error'`) for that
case. Needs a PO/lead decision on which — this is new evidence against a
premise the plan recorded as settled (`review-audit-self-decision.md`:
present, don't silently reverse), not a rejected red-team finding.

### Risk

Normal — narrow window (provider failure specifically, not the common
success/mutation-fail paths, both already covered by tests), but is exactly
the failure mode T8 was designed to catch.

### Status

proposed
