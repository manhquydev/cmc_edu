/** Returns true if `ip` (IPv4 dotted-decimal) falls within `cidr`.
 *  `cidr` may be either CIDR notation ("192.168.1.0/24") or a single IP ("10.0.0.5"). */
export function ipMatchesCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes('/')) return ip === cidr;
  const [networkAddr, prefixStr] = cidr.split('/') as [string, string];
  const prefix = parseInt(prefixStr, 10);
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipToUint32(ip) & mask) === (ipToUint32(networkAddr) & mask);
}

function ipToUint32(ip: string): number {
  return ip.split('.').reduce((acc, octet) => ((acc << 8) | parseInt(octet, 10)) >>> 0, 0);
}
