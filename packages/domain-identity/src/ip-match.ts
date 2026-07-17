/** Returns true if `ip` (IPv4 dotted-decimal) falls within `cidr`.
 *  `cidr` may be either CIDR notation ("192.168.1.0/24") or a single IP ("10.0.0.5").
 *  Non-IPv4 input (IPv6 literals, empty strings) always returns false. */
export function ipMatchesCidr(ip: string, cidr: string): boolean {
  // Reject non-IPv4: IPv6 literals contain ':', empty string is not an IP.
  if (!ip || ip.includes(':')) return false;
  if (!cidr.includes('/')) return ip === cidr;
  const [networkAddr, prefixStr] = cidr.split('/') as [string, string];
  const prefix = parseInt(prefixStr, 10);
  // Guard against malformed prefix (NaN, out-of-range) — fail closed.
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipToUint32(ip) & mask) === (ipToUint32(networkAddr) & mask);
}

function ipToUint32(ip: string): number {
  return ip.split('.').reduce((acc, octet) => ((acc << 8) | parseInt(octet, 10)) >>> 0, 0);
}

const IPV4_OCTET_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

function isValidIpv4(ip: string): boolean {
  const octets = ip.split('.');
  return octets.length === 4 && octets.every((o) => IPV4_OCTET_RE.test(o));
}

/** Validates admin-entered CIDR/IP input for `FacilityNetwork` rows —
 *  either a bare IPv4 ("10.0.0.5") or CIDR notation ("192.168.1.0/24").
 *  Rejects malformed octets, out-of-range prefixes, and non-IPv4 input. */
export function isValidCidr(input: string): boolean {
  if (!input) return false;
  const [ip, prefixStr, ...rest] = input.split('/');
  if (rest.length > 0 || !ip || !isValidIpv4(ip)) return false;
  if (prefixStr === undefined) return true;
  const prefix = Number(prefixStr);
  return /^\d+$/.test(prefixStr) && prefix >= 0 && prefix <= 32;
}
