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
