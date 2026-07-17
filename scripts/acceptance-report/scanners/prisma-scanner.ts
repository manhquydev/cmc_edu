// Extracts model names from packages/db/prisma/schema.prisma. Prisma's
// schema grammar is regular (`model Name {`), so a line-anchored regex is
// sufficient here — unlike the tRPC router graph, there is no dynamic
// composition to resolve.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'packages/db/prisma/schema.prisma');

export function scanPrismaModels(): string[] {
  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  const modelPattern = /^model\s+(\w+)\s*\{/gm;
  return [...schema.matchAll(modelPattern)].map((match) => match[1]);
}
