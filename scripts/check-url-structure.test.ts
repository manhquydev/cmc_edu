import { describe, expect, it } from 'vitest';

import type { UiRouteInfo } from './acceptance-report/scanners/route-scanner.js';
import {
  auditUrlStructure,
  extractTl06Paths,
  loadLiveAuditInput,
} from './check-url-structure.js';
import { URL_CONTRACT, type UrlContractEntry } from './url-structure-contract.js';

function screen(routePath: string, app: UiRouteInfo['app'] = 'admin'): UiRouteInfo {
  return { path: routePath, app, kind: 'screen', placeholder: false };
}

function redirect(routePath: string, target: string): UiRouteInfo {
  return { path: routePath, app: 'admin', kind: 'redirect', placeholder: false, redirectTarget: target };
}

const tinyCatalog: UrlContractEntry[] = [
  { id: 'students', app: 'admin', paper: '/students', asBuilt: '/admin/students', family: 'admin-module' },
  { id: 'receipts', app: 'admin', paper: '/finance/receipts', asBuilt: '/finance', family: 'index-resource' },
];

describe('auditUrlStructure', () => {
  it('passes when routes, links, and nav match the as-built catalog', () => {
    const report = auditUrlStructure({
      routes: [screen('/admin/students'), screen('/admin/students/:id'), screen('/finance')],
      linkPatterns: { student: '/admin/students/:id' },
      workspacePaths: ['/finance'],
      navPaths: ['/admin/students'],
      paperPaths: ['/students', '/students/:id', '/finance/receipts'],
      catalog: [
        ...tinyCatalog,
        { id: 'students-detail', app: 'admin', paper: '/students/:id', asBuilt: '/admin/students/:id', family: 'admin-module' },
      ],
    });
    expect(report.findings).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.authority).toBe('router+links+nav');
    expect(report.familyCounts['admin-module']).toBe(2);
    expect(report.familyCounts['index-resource']).toBe(1);
    expect(report.paperNotes.some((note) => note.reason === 'differs')).toBe(true);
  });

  it('does not fail when July paper documents a path the catalog never listed', () => {
    const report = auditUrlStructure({
      routes: [screen('/admin/students')],
      linkPatterns: {},
      workspacePaths: [],
      navPaths: [],
      paperPaths: ['/students', '/curriculum'],
      catalog: tinyCatalog.filter((row) => row.id === 'students'),
    });
    expect(report.ok).toBe(true);
    expect(report.findings).toEqual([]);
    expect(report.paperNotes.some((note) => note.paper === '/curriculum' && note.reason === 'uncatalogued-paper')).toBe(
      true,
    );
  });

  it('fails an uncatalogued registered route', () => {
    const report = auditUrlStructure({
      routes: [screen('/admin/students'), screen('/legacy/hash-style')],
      linkPatterns: {},
      workspacePaths: [],
      navPaths: [],
      paperPaths: ['/students'],
      catalog: tinyCatalog.filter((row) => row.id === 'students'),
    });
    expect(report.ok).toBe(false);
    expect(report.findings.some((finding) => finding.code === 'unknown-route')).toBe(true);
  });

  it('fails a dangling links builder', () => {
    const report = auditUrlStructure({
      routes: [screen('/admin/students')],
      linkPatterns: { receipt: '/finance/:id' },
      workspacePaths: [],
      navPaths: [],
      paperPaths: ['/students'],
      catalog: tinyCatalog.filter((row) => row.id === 'students'),
    });
    expect(report.ok).toBe(false);
    expect(report.findings.some((finding) => finding.code === 'dangling-link')).toBe(true);
  });

  it('fails a forbidden stale path', () => {
    const report = auditUrlStructure({
      routes: [screen('/admin/students'), screen('/login/otp-phone')],
      linkPatterns: {},
      workspacePaths: [],
      navPaths: [],
      paperPaths: ['/students'],
      catalog: tinyCatalog.filter((row) => row.id === 'students'),
    });
    expect(report.ok).toBe(false);
    expect(report.findings.some((finding) => finding.code === 'forbidden')).toBe(true);
  });

  it('fails when a catalog asBuilt path disappears', () => {
    const report = auditUrlStructure({
      routes: [screen('/finance')],
      linkPatterns: {},
      workspacePaths: [],
      navPaths: [],
      paperPaths: ['/students', '/finance/receipts'],
      catalog: tinyCatalog,
    });
    expect(report.ok).toBe(false);
    expect(report.findings.some((finding) => finding.code === 'missing-as-built')).toBe(true);
  });

  it('requires documented redirects to stay redirects', () => {
    const catalog: UrlContractEntry[] = [
      {
        id: 'classes',
        app: 'admin',
        paper: '/classes',
        asBuilt: '/admin/classes',
        redirectFrom: ['/classes'],
        family: 'admin-module',
      },
    ];
    const ok = auditUrlStructure({
      routes: [screen('/admin/classes'), redirect('/classes', '/admin/classes')],
      linkPatterns: {},
      workspacePaths: [],
      navPaths: [],
      paperPaths: ['/classes'],
      catalog,
    });
    expect(ok.findings).toEqual([]);

    const broken = auditUrlStructure({
      routes: [screen('/admin/classes'), screen('/classes')],
      linkPatterns: {},
      workspacePaths: [],
      navPaths: [],
      paperPaths: ['/classes'],
      catalog,
    });
    expect(broken.findings.some((finding) => finding.code === 'wrong-redirect')).toBe(true);
  });

  it('fails a flow-manifest uiRoute that is not registered', () => {
    const report = auditUrlStructure({
      routes: [screen('/admin/students')],
      linkPatterns: {},
      workspacePaths: [],
      navPaths: [],
      paperPaths: ['/students'],
      catalog: tinyCatalog.filter((row) => row.id === 'students'),
      manifestRoutes: [{ flowId: 'P1-03', path: '/finance/receipts/:id' }],
    });
    expect(report.ok).toBe(false);
    expect(report.findings.some((finding) => finding.code === 'dangling-manifest')).toBe(true);
  });
});

describe('live HEAD contract', () => {
  it('is closed on router + links + nav; paper mismatch is advisory', () => {
    const input = loadLiveAuditInput();
    const report = auditUrlStructure(input);
    expect(report.findings, report.findings.map((finding) => finding.message).join('\n')).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.authority).toBe('router+links+nav');
    expect(input.catalog).toBe(URL_CONTRACT);
    expect(report.familyCounts['admin-module']).toBeGreaterThanOrEqual(8);
    expect(report.familyCounts['index-resource']).toBeGreaterThanOrEqual(4);
    expect(report.familyCounts['form-depth']).toBeGreaterThanOrEqual(8);
    expect(report.paperNotes.length).toBeGreaterThan(0);
  });
});

describe('extractTl06Paths', () => {
  it('reads the URL column, including escaped table pipes for shifts', () => {
    const md = [
      '## 3. Map',
      '| Trang | URL | Chi tiết |',
      '| --- | --- | --- |',
      '| Ca | `/hr/shifts?scope=mine\\|inbox` → `/hr/shifts/new` | Không dùng `/attendance/shifts` |',
      '| HS | `/students` → `/students/{id}` | `/{id}/grades` |',
      '> - `/login` — LMS',
      '> - `/login/otp-phone` — removed',
      '`/child/{studentId}/report-card`',
      '## 4. Next',
    ].join('\n');
    const paths = extractTl06Paths(`preamble\n${md}`);
    expect(paths).toContain('/hr/shifts');
    expect(paths).toContain('/hr/shifts/new');
    expect(paths).toContain('/students');
    expect(paths).toContain('/students/:id');
    expect(paths).toContain('/login');
    expect(paths).toContain('/child/:id/report-card');
    expect(paths).not.toContain('/attendance/shifts');
    expect(paths).not.toContain('/login/otp-phone');
    expect(paths).not.toContain('/grades');
  });
});
