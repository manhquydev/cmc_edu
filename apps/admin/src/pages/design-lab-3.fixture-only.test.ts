/**
 * Fixture-only guard for /design3: the lab page must not import production
 * nav, session, or tRPC surfaces (Phase 1 security constraint).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const pageSource = readFileSync(resolve(process.cwd(), 'src/pages/design-lab-3.tsx'), 'utf8');
const routesSource = readFileSync(resolve(process.cwd(), 'src/routes/index.tsx'), 'utf8');

describe('design-lab-3 fixture-only + DEV gate', () => {
  it('does not import nav-registry, session context, or tRPC', () => {
    // Import/identifier coupling only — comments may mention forbidden surfaces.
    expect(pageSource).not.toMatch(/from ['"][^'"]*nav-registry/);
    expect(pageSource).not.toMatch(/from ['"][^'"]*session-context/);
    expect(pageSource).not.toMatch(/from ['"][^'"]*trpc/);
    expect(pageSource).not.toMatch(/\buseSession\b/);
    expect(pageSource).not.toMatch(/\btrpc\./);
  });

  it('uses only fixture/demo data and @cmc/ui odoo components', () => {
    expect(pageSource).toMatch(/DEMO_RECORDS|fixture|demo/i);
    expect(pageSource).toMatch(/OdooNavbar|KanbanBoard/);
    expect(pageSource).toMatch(/o_web_client/);
  });

  it('gates /design3 behind import.meta.env.DEV in the route tree', () => {
    expect(routesSource).toMatch(/path:\s*['"]\/design3['"]/);
    const design3Idx = routesSource.indexOf("path: '/design3'");
    expect(design3Idx).toBeGreaterThan(-1);
    const design3Block = routesSource.slice(design3Idx, design3Idx + 600);
    // Require the real ternary shape (not a bare DEV comment).
    expect(design3Block).toMatch(/import\.meta\.env\.DEV\s*\?/);
    expect(design3Block).toMatch(/Navigate\s+to=["']\/login["']/);
  });
});
