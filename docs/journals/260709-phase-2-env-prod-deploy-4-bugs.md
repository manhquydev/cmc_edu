# Phase 2 (env-prod): 4 Real Bugs Found During Actual Testing

**Date**: 2026-07-09 15:42
**Severity**: High
**Component**: infra (nginx, docker-compose), build system (Dockerfile.lms, .gitattributes), shell scripts, database seeding
**Status**: Resolved (4 bugs fixed); Partially Blocked (3 findings flagged)

## What Happened

Executed Phase 2 of the go-live sprint (`plans/260707-2308-golive-sprint-land-sso-env-uat/phase-02-env-prod-cmcv2.md`) against a running local `cmcv2-prod` docker-compose stack. Ran actual verification steps (not just status-code checks) and found 4 real bugs that would have surfaced during UAT or production. All 4 were fixed in-session. Additionally discovered 3 operational blockers and 1 documentation debt issue flagged for Phase 4.

## The Brutal Truth

This is exhausting and infuriating in equal measure. We almost shipped with **four bugs that would have catastrophically failed during go-live**:

1. Shell scripts that don't execute on the deployment host (CRLF line endings).
2. Nginx 502 errors after routine container restarts because DNS caching was never configured.
3. The LMS app serving nginx's default "Welcome to nginx!" page to real users because a build environment variable was silently missing.
4. A proxy rewrite bug that would have made the entire LMS inaccessible even if the env var had been there.

The infuriating part: **none of these would have been caught by status-code-only smoke tests**. All returned HTTP 200. The only reason we found them is because we actually *tested* (restarted containers, read response bodies, inspected bundle content) instead of trusting a green check mark. This needs to be the new standard for any proxy/SPA verification from now on.

The exhausting part: these are all *preventable* with minimal infrastructure (`.gitattributes`, DNS resolver config, a code review that reads HTML, env var parity checking). We should have caught at least 3 of these before the day of verification.

## Technical Details

### Bug #1: CRLF Line Endings in Shell Scripts

**Symptoms**: `scripts/isolation-check.sh` and `scripts/env-check.sh` fail on any Linux/Docker host with `$'\r': command not found` when sourced or executed.

**Root cause**: Windows CRLF line endings (CR LF = `\r\n`) were committed to git. No `.gitattributes` enforced LF-only for shell scripts. When cloned on a Linux host (Docker container, VPS), bash reads the `\r` as part of the command name, breaks.

**Fix applied**:
1. Added `.gitattributes` to the repo root:
   ```
   *.sh text eol=lf
   *.bash text eol=lf
   ```
2. Renormalized the two affected files: `git rm --cached *.sh`, `git add *.sh`, `git commit`.
3. Verified: re-cloned repo on container, executed both scripts successfully.

**Prevention**: This should have been in place from day 1. Added to pre-commit linting baseline going forward.

### Bug #2: Nginx DNS Caching Breaks After Container Restarts

**Symptoms**: After `docker compose up -d --no-deps api` (normal routine per runbook), upstream api requests return 502 Bad Gateway until nginx is manually restarted.

**Root cause**: `infra/nginx/nginx.conf` used `proxy_pass http://api:3000;` with a literal hostname. Nginx resolves this once at worker startup, caches the IP, and never re-resolves. When the `api` container restarts (new internal IP), nginx keeps routing to the dead IP. Docker's embedded DNS (127.0.0.11) has a 10-second TTL; nginx was ignoring it.

**Fix applied**:
1. Added `resolver 127.0.0.11 valid=10s;` at the http block level in nginx.conf. This tells nginx to use Docker's DNS with a 10-second refresh.
2. Converted all literal `proxy_pass http://api:...` to variable-based: `set $api_upstream "api:3000"; proxy_pass http://$api_upstream;`. Using a variable forces nginx to resolve on each request (documented behavior, the "right" way).
3. Applied same pattern to all upstream targets (lms, admin).
4. Verified: restarted the api container mid-session, issued a GET to `/`, confirmed no 502 and no manual nginx restart needed. DNS was live.

**Prevention**: This is a standard Docker+nginx gotcha. Should be in the nginx baseline config template. Testing must include at least one container restart.

### Bug #3: Nginx Variable + proxy_pass Silently Drops URI Suffix (nginx trac#1067)

**Symptoms**: `GET /lms/dashboard` (and any `/lms/*` path) was being served a 200 with HTML content `<h1>Welcome to nginx!</h1>` instead of the LMS app. No error logs, status code was 200.

**Root cause**: During the fix for Bug #2, all proxy_pass targets were converted to variables. However, nginx has a documented quirk (nginx trac#1067): when `proxy_pass` includes a URI suffix (e.g., `proxy_pass http://upstream/lms/;`), nginx rewrites the path. But when the target is a *variable* (e.g., `proxy_pass http://$upstream/lms/;`), nginx **ignores the URI suffix entirely** and forwards the full original request path unmodified. So `GET /` → `GET /` to the lms container (which only serves `/lms/*`), and the container's base-image nginx serves its placeholder.

**Fix applied**:
1. Added explicit path rewrite before proxy_pass for lms:
   ```nginx
   location /lms/ {
       rewrite ^/(.*)$ /lms/$1 break;
       proxy_pass http://$lms_upstream;
   }
   ```
   The `rewrite` is applied before `proxy_pass` and still works with variable-based targets (unlike the URI suffix).
2. No rewrite needed for `/admin/` because the prefix `/admin/` already matched the container's sub-path (identity mapping), verified via a separate container restart and direct curl to `http://admin/admin/`.

**Verification**: Inspected the actual HTTP response body (not just status code), confirmed it now contains the real LMS React app HTML, not the nginx placeholder.

**Prevention**: This is a code-review catch. When converting proxy_pass to variables, the reviewer *must* read the resulting response body and trace where the path goes. Status-code-only checks are insufficient.

### Bug #4: LMS Prod Build Missing VITE_API_URL Environment Variable

**Symptoms**: While tracing Bug #3, discovered that `infra/docker/Dockerfile.lms` defined `VITE_API_BASE_URL` (unused) but not `VITE_API_URL` (required). The LMS bundle fallback was hardcoding `http://localhost:3000`. Every OTP login call and session-evidence API call from the LMS would target the end user's own machine, not the server.

**Root cause**: Env var name mismatch. The Dockerfile was copying the pattern from an old build script that used the wrong var name. The actual LMS code (`apps/lms/src/lib/trpc.ts`, `session-evidence.tsx`) reads `VITE_API_URL`. The prod Dockerfile never passed it through.

**Fix applied**:
1. Updated `Dockerfile.lms`:
   ```dockerfile
   ARG VITE_API_URL=http://localhost:3000
   ENV VITE_API_URL=${VITE_API_URL}
   ```
   (Mirrored the working pattern from `Dockerfile.admin`.)
2. Updated `docker-compose.prod.yml` lms build args to include `VITE_API_URL=${VITE_API_URL:-http://localhost:3000}`.
3. Updated `.env.prod` to pass `VITE_API_URL=http://localhost`.
4. Rebuilt and redeployed the lms image, verified the bundle no longer contains the literal string `localhost:3000` (used `strings` on the built image, then verified the live `/` response contains real app HTML with proper API endpoints).

**Verification**: Bundle inspection and response body analysis (not just status codes). This was invisible until we looked at the actual LMS HTML.

**Prevention**: Every SPA build must have env var parity checks between docs, Dockerfile, and compose file. Add a lint step that scans both app source and docker configs for all VITE_* references.

## What We Tried

1. **Status-code-only verification (failed)**: Initial checks saw 200/200 responses. All four bugs returned 200 OK. Only actual body inspection and container restart testing exposed them.

2. **Trust the Dockerfile pattern (failed)**: Assumed `VITE_API_BASE_URL` was correct because it matched the pattern. Should have grepped the actual app code first.

3. **Literal hostname proxy_pass (failed for durability)**: Works until the upstream restarts. Nginx DNS resolver config + variables is the standard Docker pattern; should have been from the start.

## Root Cause Analysis

Why did four bugs make it this far?

1. **Verification was too shallow**: Phase 2 didn't mandate actual body inspection or container restart cycles. We trusted HTTP status codes as evidence of correctness. They lied.

2. **Config drift without guardrails**: The Dockerfile had a wrong env var name because there's no lint step validating that all VITE_* vars in the app source are passed through build. Same for nginx proxy_pass patterns—no automated check that all upstreams are DNS-resolvable.

3. **No pre-deploy infra simulation**: We had the docker-compose stack, but didn't actually *operate* it (restart containers, trace requests, verify DNS resolution) before calling it "done."

4. **Enum dualism in shell scripts**: No `.gitattributes` meant CRLF wasn't caught during review. This is a git hygiene failure, not a code failure.

## Lessons Learned

1. **Status codes are not sufficient evidence of correctness for proxy/SPA infra**: A 200 with the wrong HTML content is worse than a 500, because it silently serves wrong data. Always inspect response bodies, especially for the first request to a new endpoint.

2. **Operate the infra, don't just check it**: Restarting a container mid-verification is not wasted time—it's essential testing. Routine operations (per the runbook) must be validated, not assumed.

3. **Env var parity must be enforced**: Every SPA needs a lint rule that greps the source code for all `VITE_*` references and confirms each is passed through the build. Same for nginx proxy_pass targets and DNS resolution.

4. **Code review for infra changes must include tracing**: If a code reviewer sees `proxy_pass http://$variable/path/;`, they *must* trace what that expands to and verify it's correct. Reading the config alone is insufficient.

5. **Config consistency matters more than individual correctness**: `Dockerfile.admin` worked because it had the right pattern. `Dockerfile.lms` failed because it deviated. Document the pattern once, enforce it everywhere.

6. **.gitattributes is not optional**: Any repo with shell scripts must enforce LF line endings from day 1. This is not a "nice to have"—it's a blocker for any Linux/Docker deployment.

## Next Steps

### Immediate (blocking Phase 4 UAT)

1. **Super-admin seeding workaround documented**: `scripts/seed-super-admin.ts` cannot run from the host as documented (DATABASE_URL uses Docker-internal hostname `postgres`, unreachable from host shell). Worked around via manual SQL upsert run through `docker compose exec postgres psql`. Added a note to `docs/runbook-deploy.md` §1.4 flagging this for the next operator.

2. **R2 API keypair creation is manual**: `wrangler` CLI cannot create S3 API keypairs (only buckets/lifecycle). Created the `cmc-db-backups` bucket, set 30-day lifecycle, disabled public access, and verified the S3 endpoint is deterministic from the account ID. **Blocker for Phase 2 step 7 (restore drill)**: R2 S3 keypair (access key + secret key) must be manually created via Cloudflare Dashboard. Not automated yet.

3. **Missing .env.prod vars**: Found that `.env.prod` was missing 3 vars that `.env.prod.example` had documented: `BACKUP_KEEP_DAYS`, `BACKUP_ENCRYPTION_PASSPHRASE`, `BACKUP_BUCKET_PRIVATE_CONFIRMED`. Filled them in. Generated fresh encryption passphrase; **needs escrow in password manager per the go-live runbook's decision**.

### Before Phase 4 UAT

4. **UAT checklist is stale**: `docs/uat-checklist-go-live.md` Section 2 still scripts test steps for `ke_toan`, `cskh`, `ctv_mkt`, `hr` roles (e.g., "ke_toan duyệt phiếu", "cskh approve guardian link"). Those roles now have 0 permissions (commit `57ee539`). This will block UAT scripts until rewritten to reflect the 5 active roles only.

### Backlog (after go-live)

5. **Add env var and proxy_pass lint steps**: Automated checks for VITE_* parity and nginx upstream resolution.

6. **Nginx baseline template**: Bake in DNS resolver config + variable-based proxy_pass as the default pattern for all projects.

---

**Commits**: 
- `.gitattributes` + shell script renormalization
- `infra/nginx/nginx.conf` (DNS resolver + variable-based proxy_pass)
- `infra/docker/Dockerfile.lms` + `docker-compose.prod.yml` (VITE_API_URL)
- `docs/runbook-deploy.md` §1.4 (seed-super-admin workaround note)

**Verification (bugs only)**: Isolation check ✅ · Env check ✅ · Nginx 502 recovery (container restart) ✅ · LMS response body (real app HTML, no localhost:3000) ✅ · Admin proxy (identity mapping verified) ✅

**Testing baseline gap identified**: Status-code-only checks insufficient for proxy/SPA infra. Recommend adding mandatory body inspection + container restart cycle to Phase 2 verification template for future go-lives.
