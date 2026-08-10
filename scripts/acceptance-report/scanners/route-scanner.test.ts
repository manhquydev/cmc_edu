import assert from 'node:assert/strict';
import test from 'node:test';

import { scanAdminUiRoutesDetailed, scanUiRoutesDetailed } from './route-scanner.js';

test('admin route inventory includes imported spread routes and classifies the go resolver', () => {
  const routes = scanAdminUiRoutesDetailed();

  assert.deepEqual(
    {
      app: routes.get('/go/:entity/:id')?.app,
      kind: routes.get('/go/:entity/:id')?.kind,
      fallback: routes.get('/go/:entity/:id')?.fallbackKind,
      placeholder: routes.get('/go/:entity/:id')?.placeholder,
    },
    {
      app: 'admin',
      kind: 'dynamic-redirect',
      fallback: 'invalid-id-empty-state',
      placeholder: false,
    },
  );
  assert.equal(routes.get('/login')?.app, 'admin');
  assert.equal(routes.get('/login')?.kind, 'screen');
});

test('scanner records static Navigate routes as redirects', () => {
  const routes = scanUiRoutesDetailed();

  assert.equal(routes.get('/parent/home')?.app, 'lms');

  assert.deepEqual(
    {
      kind: routes.get('/classes')?.kind,
      target: routes.get('/classes')?.redirectTarget,
    },
    { kind: 'redirect', target: '/admin/classes' },
  );
});
