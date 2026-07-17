# Trusted-Proxy Configuration

## Context

The CMC API runs as a raw Node.js `http.createServer` (no Express/Fastify/Hono). IP resolution and trust-proxy gating live in `apps/api/src/context.ts` (lines 123–181):

**TRUSTED_PROXY_CIDRS** (lines 123–128):
```typescript
const TRUSTED_PROXY_CIDRS: string[] = (
  process.env['TRUSTED_PROXY_CIDRS'] ?? '127.0.0.1/32,::1/128'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
```

**isTrustedProxy()** (lines 142–159): Validates IP against allowlist (IPv4 CIDR, IPv6 exact-match).

**resolveIp()** (lines 161–181): 
```typescript
function resolveIp(req: IncomingMessage | undefined): string | null {
  if (!req) return null;
  const remoteAddr = req.socket?.remoteAddress ?? null;
  const forwarded = req.headers['x-forwarded-for'];
  if (
    typeof forwarded === 'string' &&
    forwarded.length > 0 &&
    remoteAddr !== null &&
    isTrustedProxy(remoteAddr)  // ← gate: only trust XFF if remoteAddr is in allowlist
  ) {
    // Rightmost hop NOT in trust list = actual client
    const hops = forwarded.split(',').map((h) => h.trim());
    for (let i = hops.length - 1; i >= 0; i--) {
      if (!isTrustedProxy(hops[i]!)) return hops[i]!;
    }
    return remoteAddr;
  }
  return remoteAddr;  // fallback: no XFF or untrusted remoteAddr
}
```

**Key difference from naive implementations:** 
- Only trusts `X-Forwarded-For` when TCP `remoteAddr` is in `TRUSTED_PROXY_CIDRS` allowlist (default: loopback only).
- Takes the **rightmost untrusted hop** (nearest attacker-controlled boundary), not the leftmost.
- This is enforced at boot via `assertRequiredEnvForProd` in `apps/api/src/boot-checks.ts:180` — production refuses to start if `TRUSTED_PROXY_CIDRS` is not explicitly configured (never relies on the default loopback list in production).

## Required Reverse-Proxy Configuration

### nginx

```nginx
server {
  # Strip any client-supplied X-Forwarded-For before passing upstream.
  # Without this, a client can inject arbitrary IPs into the header chain.
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_set_header X-Real-IP      $remote_addr;

  location / {
    proxy_pass http://127.0.0.1:3000;
  }
}
```

`$remote_addr` is the TCP peer address — the nginx process controls it, the client cannot forge it.

### Caddy

```caddy
reverse_proxy 127.0.0.1:3000 {
  header_up X-Forwarded-For {remote_host}
}
```

Caddy rewrites `X-Forwarded-For` to `{remote_host}` (the actual TCP peer), discarding any client-supplied value.

## What Must NOT Happen

- Do **not** use `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` in nginx. This appends to the client-supplied header, allowing IP injection.
- Do **not** expose port 3000 directly to the internet. The Node process must only be reachable through the reverse proxy.

## Threat Reference

See `docs/threat-checklist.md` — T13 (IP clock-in spoofing). The app-level CIDR gate (`context.trusted-proxy.test.ts`, 6 tests) validates that:
1. Untrusted remoteAddr → XFF ignored (fallback to socket IP)
2. Trusted remoteAddr (loopback in dev, operator-configured in prod) → XFF trusted, rightmost-hop extracted
3. Custom `TRUSTED_PROXY_CIDRS` via env honored at runtime
4. Malformed/missing XFF → safe degradation

The reverse-proxy stripping (nginx/Caddy config below) is still mandatory defense-in-depth — it prevents an attacker between the LB and Node from rewriting the XFF header after the LB has already validated it.
