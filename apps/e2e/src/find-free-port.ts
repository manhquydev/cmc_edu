// Finds an OS-assigned free TCP port for the ephemeral api server this e2e
// run spawns. There is a small time-of-check/time-of-use race between
// closing this probe socket and the api server binding the same port, but
// that window is negligible for a single local/CI test run (no other process
// on the box is racing us for it) — acceptable here, not for production code.

import net from 'node:net';

export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        probe.close();
        reject(new Error('Could not determine a free port.'));
        return;
      }
      const { port } = address;
      probe.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(port);
      });
    });
  });
}
