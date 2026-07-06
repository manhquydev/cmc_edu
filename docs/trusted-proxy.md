# Trusted-Proxy Configuration

## Context

The CMC API runs as a raw Node.js `http.createServer` (no Express/Fastify/Hono), so there is no framework-level `trust proxy` toggle. IP resolution lives in `apps/api/src/context.ts → resolveIp()`:

```typescript
const forwarded = req.headers['x-forwarded-for'];
if (typeof forwarded === 'string' && forwarded.length > 0) {
  return forwarded.split(',')[0]!.trim();
}
return req.socket?.remoteAddress ?? null;
```

This takes the **first** value in `X-Forwarded-For`. The security guarantee depends entirely on the reverse proxy stripping any client-supplied `X-Forwarded-For` before it reaches Node — otherwise an attacker can spoof their IP and bypass the CIDR clock-in gate (T13).

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

See `docs/threat-checklist.md` — T13 (IP clock-in spoofing). The app-level CIDR check in `@cmc/domain-identity → ipMatchesCidr` is tested in `apps/api/src/checkin/ip-match.test.ts`, but that test injects `ctx.ip` directly. The reverse-proxy stripping is the mandatory prerequisite for that check to be meaningful in production.
