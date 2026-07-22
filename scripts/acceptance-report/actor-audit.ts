// Cross-checks two things the repo already declares and never compared: the
// actor a flow says performs it, and whether the permission registry lets that
// role call anything in the flow.
//
// Four flows have already shipped with that pair contradicting each other —
// tuition receipts, session assessment, payroll, and exercises — each meaning
// a role was named as the owner of work it could not perform. Every one was
// found by a person tripping over it. This finds the rest by construction.
//
// Deliberately static: it reads the manifest, the routers' `requirePermission`
// keys, and `can()`. A runtime sweep cannot replace it, because a screen whose
// menu entry is hidden never issues the request that a runtime check watches
// for — which is exactly how the exercises flow looked clean.

import { ROLES, can, type Role } from '@cmc/auth';
import type { FlowEntry } from './types.js';

/** Actors that are not staff roles and therefore outside the registry.
 *  Listed with a reason so "not checked" never blurs into "checked and fine". */
const NON_STAFF_ACTORS: Record<string, string> = {
  he_thong: 'side-effect nội bộ (provisioning, worker) — không có người đóng vai',
  agent: 'tác vụ tự động',
  phu_huynh: 'phiên LMS — authz theo Guardian link, không qua registry',
  hoc_vien: 'phiên LMS — authz theo phiên học viên, không qua registry',
};

export interface ActorFinding {
  flowId: string;
  kind: 'invalid-actor' | 'idle-actor' | 'unreachable-procedure';
  subject: string;
  detail: string;
}

export interface ActorAuditResult {
  findings: ActorFinding[];
  /** Procedures the registry does not govern — reported so their absence from
   *  the findings is visibly a limitation, not a clean bill of health. */
  ungatedProcedureCount: number;
}

export function auditFlowActors(
  flows: readonly FlowEntry[],
  permissionKeys: ReadonlyMap<string, string>,
): ActorAuditResult {
  const findings: ActorFinding[] = [];
  const ungated = new Set<string>();

  for (const flow of flows) {
    const gated = flow.expected.trpc
      .map((procedure) => ({ procedure, key: permissionKeys.get(procedure) }))
      .filter((p): p is { procedure: string; key: string } => {
        if (!p.key) ungated.add(p.procedure);
        return p.key !== undefined;
      });

    const staffActors: Role[] = [];

    for (const actor of flow.actorRoles) {
      if (actor in NON_STAFF_ACTORS) continue;

      if (!(ROLES as readonly string[]).includes(actor)) {
        findings.push({
          flowId: flow.id,
          kind: 'invalid-actor',
          subject: actor,
          detail: `vai "${actor}" không tồn tại trong @cmc/auth ROLES — không ai có thể được phân công`,
        });
        continue;
      }

      const role = actor as Role;
      staffActors.push(role);

      // super_admin bypasses the registry, so it can always "do everything" and
      // proves nothing about whether the flow works for the people who run it.
      if (role === 'super_admin') continue;
      if (gated.length === 0) continue;

      const usable = gated.filter((p) => callable(role, p.key));
      if (usable.length === 0) {
        findings.push({
          flowId: flow.id,
          kind: 'idle-actor',
          subject: role,
          detail:
            `khai là actor nhưng không gọi được procedure nào trong ${gated.length} procedure có gate: ` +
            gated.map((p) => `${p.procedure} (${p.key})`).join(', '),
        });
      }
    }

    // The mirror check: work in the flow that none of its declared actors can
    // perform. A flow can have a busy actor and still contain a dead step.
    for (const { procedure, key } of gated) {
      const reachable = staffActors.some((role) => role === 'super_admin' || callable(role, key));
      if (!reachable) {
        findings.push({
          flowId: flow.id,
          kind: 'unreachable-procedure',
          subject: procedure,
          detail: `cần quyền ${key}, nhưng không actor nào của luồng có quyền đó`,
        });
      }
    }
  }

  return { findings, ungatedProcedureCount: ungated.size };
}

function callable(role: Role, permissionKey: string): boolean {
  const [module, action] = permissionKey.split('.');
  if (!module || !action) return false;
  return can({ userId: 'audit', roles: [role] }, module, action);
}
