// Single policy surface for post-login redirects. Both RequireAuth (capture)
// and login/change-password (restore) must import from here — never keep a
// second allow/deny list elsewhere. Also used by the /go resolver (Phase 2)
// as a second redirect sink, so open-redirect rules stay in one place.

/** Paths that must never be captured as returnTo and never restored as dest. */
export const RETURN_TO_EXCLUDED = ['/', '/login', '/change-password'] as const;

/** Synthetic origin used only to detect scheme/host injection via `new URL`. */
const SAFE_ORIGIN = 'http://safe.invalid';

/** ASCII controls + whitespace + DEL — unsafe in a path before URL parsers. */
const CONTROL_OR_WS = /[\u0000-\u0020\u007f]/;

/**
 * True when RequireAuth should append ?returnTo= for this pathname.
 * Excludes auth chrome so a mid-rotation session loss cannot nest returnTo.
 */
export function shouldCaptureReturnTo(pathname: string): boolean {
  return !RETURN_TO_EXCLUDED.includes(pathname as (typeof RETURN_TO_EXCLUDED)[number]);
}

/**
 * True when `segment` contains control/whitespace either literally or after
 * one decode pass (catches `/%09//evil` still percent-encoded).
 */
function pathHasUnsafeChars(segment: string): boolean {
  if (CONTROL_OR_WS.test(segment)) return true;
  try {
    return CONTROL_OR_WS.test(decodeURIComponent(segment));
  } catch {
    // Malformed percent-encoding in the path → reject.
    return true;
  }
}

/**
 * Validate a returnTo value from `searchParams.get` (already once-decoded) or
 * a bare path string. Accept only an internal path that stays on a synthetic
 * origin under `new URL` (no scheme, no protocol-relative host, no control
 * chars that browsers strip before `//host`).
 *
 * Callers must pass the value from `searchParams.get('returnTo')` — do not
 * pre-encode. A second full-string `decodeURIComponent` is only attempted when
 * the raw string does not already look like a path, so legitimate `%xx` in
 * query values (e.g. `100%25off`) are not corrupted.
 *
 * Everything else falls back to `/` (index redirects to /cockpit). Hash is
 * always dropped (out of scope).
 */
export function safeReturnTo(raw: string | null | undefined): string {
  if (raw == null || raw === '') return '/';

  // Prefer the already-decoded form from searchParams.get. Only decode when
  // the value still looks percent-encoded / not-yet-a-path (defense for
  // double-encoded attackers or non-searchParams callers).
  let candidate: string;
  if (raw.startsWith('/')) {
    candidate = raw;
  } else {
    try {
      candidate = decodeURIComponent(raw);
    } catch {
      return '/';
    }
  }

  // Must be a same-origin path: single leading slash, not // or /\.
  if (!/^\/(?![/\\])/.test(candidate)) return '/';

  // Inspect the path portion only — query may legitimately contain %20 etc.
  const pathPart = candidate.split(/[?#]/, 1)[0] ?? candidate;
  if (pathHasUnsafeChars(pathPart)) return '/';

  let url: URL;
  try {
    url = new URL(candidate, SAFE_ORIGIN);
  } catch {
    return '/';
  }
  // Host/scheme injection → origin leaves the synthetic base.
  if (url.origin !== SAFE_ORIGIN) return '/';

  const pathOnly = url.pathname;
  // URL parser may normalize; re-check pathname after parse.
  if (pathHasUnsafeChars(pathOnly)) return '/';
  if (RETURN_TO_EXCLUDED.includes(pathOnly as (typeof RETURN_TO_EXCLUDED)[number])) {
    return '/';
  }

  // Drop hash (plan: out of scope). Keep search as parsed by URL.
  return `${url.pathname}${url.search}`;
}
