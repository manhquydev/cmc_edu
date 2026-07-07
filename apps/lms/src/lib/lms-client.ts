// lms-client.ts — spec-required entry point, re-exports trpc.ts with LMS names.
//
// `lmsTrpc` is the same createTRPCReact instance as `trpc` in trpc.ts so that
// hooks share the single <trpc.Provider> in main.tsx. Exporting under a second
// name satisfies the acceptance-criteria export contract without creating a
// duplicate provider tree.

export {
  trpc as lmsTrpc,
  makeTrpcClient as makeLmsTrpcClient,
  makeQueryClient,
} from './trpc.js';

import { getStoredSession } from './trpc.js';

/**
 * Returns the raw sessionToken string from localStorage.
 * The token is a base64url-encoded JSON blob: { parentAccountId, kind, studentId? }.
 */
export function getLmsToken(): string | null {
  try {
    return getStoredSession()?.sessionToken ?? null;
  } catch {
    return null;
  }
}
