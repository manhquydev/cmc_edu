// Phase 4B: mutation manifest — pins the entityId source for the
// create-shaped staff mutations the audit middleware covers. Each entry says
// whether the mutation's INPUT names something other than the record it
// creates; those must appear in AUDIT_ENTITY_ID_RESULT_ACTIONS so the
// middleware stores the created row's id, not the unrelated input id.
//
// This is the regression net plan step 8 asks for: reclassification means
// editing this manifest consciously. A NEW create-shaped mutation with an
// unrelated input id that someone forgets to classify will not be caught
// automatically here — add it to BOTH the manifest and the registry (or give
// it a handler-written audit row and document why it is unclassified).
// Wrapped-return mutations (finance.receiptCreate, rewards.redeem) keep
// input-first derivation + explicit handler audit rows — see the long note
// on deriveEntityId.

import { describe, expect, it } from 'vitest';
import { AUDIT_ENTITY_ID_RESULT_ACTIONS } from './audit-helpers.js';

/** [action, inputNamesUnrelatedRecord] — hand-audited against each router. */
const CREATE_SHAPED_MANIFEST: ReadonlyArray<readonly [string, boolean]> = [
  // user.create: input carries auth userId; record is the AppUser row.
  ['user.create', true],
  // afterSale.create: input studentId; record is the AfterSaleCase.
  ['afterSale.create', true],
  // parentMeeting.schedule / testAppointment.schedule: input studentId/
  // opportunityId; record is the meeting/appointment.
  ['parentMeeting.schedule', true],
  ['testAppointment.schedule', true],
  // shift.createTemplate / shift.submit: input shiftGroupId; record is the
  // template/registration.
  ['shift.createTemplate', true],
  ['shift.submit', true],
  // Wrapped-return mutations — out of registry scope, documented on
  // deriveEntityId: input-first stays, handler writes the true-id row.
  ['finance.receiptCreate', false],
  ['rewards.redeem', false],
];

describe('create-shaped mutation entity-id manifest (Phase 4B)', () => {
  it('every manifest entry flagged as unrelated IS in the registry', () => {
    for (const [action, inputUnrelated] of CREATE_SHAPED_MANIFEST) {
      if (inputUnrelated) {
        expect(
          AUDIT_ENTITY_ID_RESULT_ACTIONS.has(action),
          `${action} input names an unrelated record but is missing from AUDIT_ENTITY_ID_RESULT_ACTIONS`,
        ).toBe(true);
      }
    }
  });

  it('registry contains no unclassified manifest action', () => {
    const manifestActions = new Set(CREATE_SHAPED_MANIFEST.map(([a]) => a));
    for (const action of AUDIT_ENTITY_ID_RESULT_ACTIONS) {
      expect(
        manifestActions.has(action),
        `${action} is in the registry but not in the manifest — classify it`,
      ).toBe(true);
    }
  });
});
