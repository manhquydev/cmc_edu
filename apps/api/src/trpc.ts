// tRPC 11 base: context, procedures, and authorization helpers.
//
// Conventions (TL11): procedures are named `module.action`; inputs validate
// with zod; errors use TRPCError with the 5 standard codes. Authorization
// always flows through @cmc/auth `can()` — never a hardcoded role array.

import { initTRPC, TRPCError } from '@trpc/server';
import { can, type AuthSubject } from '@cmc/auth';

export interface Context {
  /** Authenticated subject, or null for anonymous/public calls. */
  subject: AuthSubject | null;
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

/** Public procedures need no session. Reserved for health / public intake. */
export const publicProcedure = t.procedure;

const requireSession = t.middleware(({ ctx, next }) => {
  if (!ctx.subject) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Session required.' });
  }
  return next({ ctx: { ...ctx, subject: ctx.subject } });
});

/** Requires a valid staff session. */
export const protectedProcedure = t.procedure.use(requireSession);

/**
 * RBAC gate. Business procedures use `requirePermission('module','action')`,
 * reading the single @cmc/auth registry that nav and UI share.
 */
export function requirePermission(module: string, action: string) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!can(ctx.subject, module, action)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: `Missing permission ${module}.${action}.` });
    }
    return next();
  });
}
