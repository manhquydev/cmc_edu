// @cmc/db — database access surface.
//
// Re-exports the generated Prisma client. Consumers create their own instance
// via `createPrismaClient()` so importing this module has no side effects (no
// connection is opened at import time). A single shared connection strategy
// lands with the first data story.

export { PrismaClient } from '@prisma/client';
export type { Prisma } from '@prisma/client';

import { PrismaClient } from '@prisma/client';

/** Factory for a Prisma client. Callers own the lifecycle (connect/disconnect). */
export function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}
