# Architecture

⚠️ **See [`docs/system-architecture.md`](./system-architecture.md) for the authoritative, as-built architecture.** That document is the current source of truth for CMC EDU v2's design and implementation.

---

## Purpose of This File

This file originally contained generic architecture questions and boundary rules for unknown stacks. CMC EDU v2 now has a built, tested, and documented architecture. All architecture decisions, layer design, and system shape are defined in `docs/system-architecture.md` (updated 2026-07-11).

**Refer directly to `docs/system-architecture.md` for:**
- C4 model and layer responsibilities
- All 27 tRPC routers and procedures
- P1–P4 workflow implementations
- Data model (48 Prisma models, 5 migrations)
- Row-level security (RLS) & append-only ledger enforcement
- Test coverage (532 tests, ≥90% statements)
- Known issues and deferrals
- Build & verification procedures

---

## Harness Reference (Preserved for Agent Context)

The below is a thinking template for future projects without an established stack. **For CMC EDU v2, skip this section and use `docs/system-architecture.md` instead.**

### Default Layering

```text
domain
  <- application
      <- infrastructure
          <- interface
              <- app surfaces
```

### Dependency Rule

Inner layers must not depend on outer layers.

| Layer | May depend on | Must not depend on |
| --- | --- | --- |
| domain | nothing project-external except tiny pure utilities | framework, database, UI, provider, process/env |
| application | domain | framework, UI, provider, database concrete clients |
| infrastructure | domain, application | interface controllers or UI |
| interface | all backend layers | UI state or platform shell assumptions |
| app surfaces | API contracts and app-facing clients | domain internals directly |

### Parse-First Boundary Rule

Unknown data must be parsed at boundaries before it enters inner code.

Boundaries include: HTTP request bodies, session payloads, environment variables, database rows, webhooks.

### Observability Contract

Emit one canonical JSON log line per request with: timestamp, level, request_id, user_id, action, duration_ms, status_code, message.

Audit logs are product records. Application logs are operational records.
