import assert from 'node:assert/strict';
import test from 'node:test';
import { auditRoutes, discoverRoutes } from './resource-depth-audit.mjs';

test('resource-depth audit classifies the current production route tree', () => {
  const result = auditRoutes(discoverRoutes());
  assert.equal(result.duplicateRoutes.length, 0);
  assert.equal(result.unknownRoutes.length, 0);
  assert.equal(result.unclassifiedDetails.length, 0);
  assert.ok(result.routes.length >= 70);
});

test('resource-depth audit fails an unregistered route', () => {
  const result = auditRoutes(['/admin/new-unknown-surface']);
  assert.deepEqual(result.unknownRoutes, ['/admin/new-unknown-surface']);
});
