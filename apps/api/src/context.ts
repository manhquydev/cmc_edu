// Request context factory.
//
// P0 scaffolding does not open a database connection or resolve a session yet;
// it returns an anonymous context. The type-only `PrismaClient` import proves
// @cmc/db resolves across the workspace and marks where the DB handle will be
// threaded once data stories land.

import type { PrismaClient } from '@cmc/db';
import type { Context } from './trpc.js';

export function createContext(_db?: PrismaClient): Context {
  return { subject: null };
}
