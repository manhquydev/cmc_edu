import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  testDbBypass,
} from '../test/db.js';
import {
  BULK_IMPORT_MAX_ROWS,
  classifyBulkRows,
  parseBulkText,
} from './bulk-import-opportunities.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('parseBulkText + classifyBulkRows (pure)', () => {
  it('parses CSV with header and classifies create rows', () => {
    const text = `name,phone,email,source
A,0901111111,a@x.com,fanpage
B,0902222222,,hotline`;
    const parsed = parseBulkText(text);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].line).toBe(2);
    const rows = classifyBulkRows(parsed, new Set(), null);
    expect(rows.every((r) => r.status === 'create')).toBe(true);
  });

  it('skips duplicate phones inside the file', () => {
    const text = `A,0901111111\nB,0901 111 111\nC,0903333333`;
    const rows = classifyBulkRows(parseBulkText(text), new Set(), null);
    expect(rows.map((r) => r.status)).toEqual([
      'create',
      'skip_duplicate_in_file',
      'create',
    ]);
  });

  it('skips phones with an open opportunity', () => {
    const text = `A,0901111111\nB,0902222222`;
    const open = new Set(['84901111111']);
    const rows = classifyBulkRows(parseBulkText(text), open, null);
    expect(rows[0].status).toBe('skip_open_opportunity');
    expect(rows[1].status).toBe('create');
  });

  it('errors on missing name/phone and invalid source', () => {
    const text = `,0901111111\nNameOnly,\nX,0903333333,,tiktok`;
    const rows = classifyBulkRows(parseBulkText(text), new Set(), null);
    expect(rows[0].status).toBe('error');
    expect(rows[1].status).toBe('error');
    expect(rows[2].status).toBe('error');
  });
});

describe('crm.opportunityBulkPreview / Confirm', () => {
  let facility: { id: string };
  let facilityB: { id: string };
  let sale: Caller;
  let saleB: Caller;

  beforeEach(async () => {
    facility = await createTestFacility('Bulk Facility A');
    facilityB = await createTestFacility('Bulk Facility B');
    await seedAppUser({ facilityId: facility.id, userId: 'sale-bulk-a', roles: ['sale'] });
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-bulk-a', roles: ['sale'] }),
    );
    saleB = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityB.id, userId: 'sale-bulk-b', roles: ['sale'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupFacility(facilityB.id);
  });

  it('preview reports create/skip/error without writing', async () => {
    await sale.crm.opportunityCreate({ contactName: 'Existing', phone: '0901000001' });
    const text = [
      'name,phone,source',
      'New One,0901000002,fanpage',
      'Dup Open,0901000001,hotline',
      'Dup File,0901000002,event',
      ',0901000003,walkin',
    ].join('\n');

    const preview = await sale.crm.opportunityBulkPreview({ text, defaultSource: 'other' });
    expect(preview.summary.create).toBe(1);
    expect(preview.summary.skip).toBe(2);
    expect(preview.summary.error).toBe(1);

    const list = await sale.crm.opportunityList({ pageSize: 100 });
    // Only the original create — preview writes nothing.
    expect(list.total).toBe(1);
  });

  it('confirm creates N valid rows and skips open-phone dupes', async () => {
    await sale.crm.opportunityCreate({ contactName: 'Open', phone: '0902000001' });
    // Closed opp (lost) — bulk may create a new open opp for same phone.
    const lost = await sale.crm.opportunityCreate({ contactName: 'Was Lost', phone: '0902000002' });
    await sale.crm.opportunityAdvance({ opportunityId: lost.id, toStage: 'O2_CONTACTED' });
    await sale.crm.opportunityMarkLost({ opportunityId: lost.id, lostReason: 'no_response' });

    const text = [
      'NewA,0902000003,fanpage',
      'NewB,0902000004,fanpage',
      'SkipOpen,0902000001,fanpage',
      'ReopenAllowed,0902000002,fanpage',
    ].join('\n');

    const result = await sale.crm.opportunityBulkConfirm({ text, defaultSource: 'fanpage' });
    expect(result.summary.created).toBe(3);
    expect(result.summary.skipped).toBe(1);

    const list = await sale.crm.opportunityList({ pageSize: 100, lost: 'include' });
    // Open: original open + 3 new = 4 open-ish; plus 1 lost = 5 total with include
    // Actually: Open(open), Lost(lost), NewA, NewB, ReopenAllowed(open on same contact as lost)
    expect(list.items.filter((i) => !i.closedAt || i.stage === 'O5_ENROLLED').length).toBeGreaterThanOrEqual(4);

    const created = await testDbBypass((tx) =>
      tx.opportunity.findMany({
        where: { facilityId: facility.id, stage: 'O1_LEAD', closedAt: null },
        include: { contact: true },
      }),
    );
    // Open (pre-existing, no source) + NewA + NewB + ReopenAllowed = 4 open O1
    expect(created.length).toBe(4);
    const bulkCreated = created.filter((o) => o.source === 'fanpage');
    expect(bulkCreated).toHaveLength(3);
  });

  it('does not leak or create into another facility', async () => {
    const text = 'Only A,0903000001,event';
    await sale.crm.opportunityBulkConfirm({ text, defaultSource: 'event' });
    const listB = await saleB.crm.opportunityList({ pageSize: 100 });
    expect(listB.total).toBe(0);
  });

  it('rejects empty text', async () => {
    await expect(sale.crm.opportunityBulkPreview({ text: '' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it(`flags rows beyond ${BULK_IMPORT_MAX_ROWS}`, async () => {
    const lines = Array.from({ length: BULK_IMPORT_MAX_ROWS + 3 }, (_, i) => {
      const n = String(i).padStart(7, '0');
      return `Person ${i},090${n}`;
    });
    // phones need digits - 090 + 7 = 10 digits ok for VN-ish
    const preview = await sale.crm.opportunityBulkPreview({ text: lines.join('\n') });
    expect(preview.overLimit).toBe(true);
    expect(preview.summary.error).toBeGreaterThanOrEqual(3);
  });
});
