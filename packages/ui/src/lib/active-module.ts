import type { NavModule } from '../components/nav-types.js';

/**
 * Most-specific active module: longest matching path across module + its
 * children. Verbatim logic promoted from apps/admin/src/shell/shell.tsx
 * (P3 shell extraction) — do not change matching semantics without updating
 * the shell's active-state contract.
 */
export function activeModuleId(pathname: string, modules: NavModule[]): string | null {
  let bestId: string | null = null;
  let bestLen = 0;
  for (const mod of modules) {
    const paths = [mod.path, ...(mod.children?.map((c) => c.path) ?? [])];
    for (const p of paths) {
      if ((pathname === p || pathname.startsWith(p + '/')) && p.length > bestLen) {
        bestLen = p.length;
        bestId = mod.id;
      }
    }
  }
  return bestId;
}
