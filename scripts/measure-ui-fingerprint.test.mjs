import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFingerprint, REAL_TYPE_SCALE } from './measure-ui-fingerprint.mjs';

test('REAL_TYPE_SCALE matches console.css declared values, not a doc-role list', () => {
  // Regression guard for the exact bug a red-team pass caught: an earlier
  // version hardcoded [11,12,13,14,16,18,24,32] (a typography *role* list —
  // label/meta/body/title/h3/page/metric — from design docs), not the real
  // --font-size-* scale console.css declares under .o_web_client, which
  // includes 10/15/20/22 too. 15px/22px were wrongly flagged off-scale.
  assert.ok(REAL_TYPE_SCALE.includes('15px'), '15px is a real declared step, not off-scale');
  assert.ok(REAL_TYPE_SCALE.includes('22px'), '22px is a real declared step, not off-scale');
});

test('counts only text-leaf nodes as off-scale, ignores non-leaf/non-text nodes', () => {
  const nodes = [
    { fontSize: '12.5px', isTextLeaf: true, borderRadius: '0px', ownerSelector: 'span.console-page-indicator' },
    { fontSize: '12.5px', isTextLeaf: false, borderRadius: '0px', ownerSelector: 'div.wrapper' },
    { fontSize: '14px', isTextLeaf: true, borderRadius: '0px', ownerSelector: 'span.body' },
  ];
  const result = analyzeFingerprint(nodes);
  assert.equal(result.offScaleTotal, 1);
  assert.deepEqual(result.offScale, { '12.5px': 1 });
});

test('attributes ownership by the element\'s own tag+class, not a sibling utility class', () => {
  // The exact shape of the bug: attributing an off-scale font-size to
  // `x1ghz6dp` (a `{margin:0}` reset class with no causal relationship to
  // font-size) instead of the element that actually declares the font-size.
  const nodes = [
    { fontSize: '13.5px', isTextLeaf: true, borderRadius: '0px', ownerSelector: 'h3.console-callout-title' },
  ];
  const result = analyzeFingerprint(nodes);
  assert.deepEqual(result.offScaleOwners['13.5px'], ['h3.console-callout-title']);
});

test('collects distinct radii regardless of leaf/text status', () => {
  const nodes = [
    { fontSize: '14px', isTextLeaf: true, borderRadius: '4px', ownerSelector: 'div.a' },
    { fontSize: '', isTextLeaf: false, borderRadius: '12px', ownerSelector: 'button.b' },
    { fontSize: '', isTextLeaf: false, borderRadius: '0px', ownerSelector: 'div.c' },
  ];
  const result = analyzeFingerprint(nodes);
  assert.deepEqual(result.radii, ['4px', '12px']);
  assert.equal(result.radiiCount, 2);
});

test('a fully on-scale, radius-free page reports empty', () => {
  const nodes = [
    { fontSize: '14px', isTextLeaf: true, borderRadius: '0px', ownerSelector: 'span.a' },
    { fontSize: '13px', isTextLeaf: true, borderRadius: '0px', ownerSelector: 'span.b' },
  ];
  const result = analyzeFingerprint(nodes);
  assert.equal(result.offScaleTotal, 0);
  assert.equal(result.radiiCount, 0);
});
