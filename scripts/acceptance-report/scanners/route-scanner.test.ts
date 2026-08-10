import { expect, test } from 'vitest';

import { scanAdminUiRoutesDetailed, scanUiRoutesDetailed } from './route-scanner.js';

test('admin route inventory includes imported spread routes and classifies the go resolver', () => {
  const routes = scanAdminUiRoutesDetailed();

  expect({
    app: routes.get('/go/:entity/:id')?.app,
    kind: routes.get('/go/:entity/:id')?.kind,
    fallback: routes.get('/go/:entity/:id')?.fallbackKind,
    placeholder: routes.get('/go/:entity/:id')?.placeholder,
  }).toEqual({
    app: 'admin',
    kind: 'dynamic-redirect',
    fallback: 'invalid-id-empty-state',
    placeholder: false,
  });
  expect(routes.get('/login')?.app).toBe('admin');
  expect(routes.get('/login')?.kind).toBe('screen');
});

test('scanner records static Navigate routes as redirects', () => {
  const routes = scanUiRoutesDetailed();

  expect(routes.get('/parent/home')?.app).toBe('lms');

  expect({
    kind: routes.get('/classes')?.kind,
    target: routes.get('/classes')?.redirectTarget,
  }).toEqual({ kind: 'redirect', target: '/admin/classes' });
});
