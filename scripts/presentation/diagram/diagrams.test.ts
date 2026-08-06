import { describe, expect, it } from 'vitest';

import { renderBeforeAfter } from './before-after.js';
import { renderControlGate } from './control-gate.js';
import { renderHomeMap } from './home-map.js';
import { renderJourney } from './journey.js';
import { renderScreenSketch } from './screen-sketch.js';
import { renderSwimlane } from './swimlane.js';

describe('diagram components', () => {
  it('renders swimlane with system lane', () => {
    const html = renderSwimlane([
      { actor: 'sale', action: 'Lập phiếu' },
      { actor: 'he_thong', action: 'Ghi sổ', system: true },
    ]);
    expect(html).toMatch(/Lập phiếu/);
    expect(html).toMatch(/Hệ thống tự làm/);
    expect(html).not.toMatch(/tRPC|procedure/);
  });

  it('renders journey milestones', () => {
    const html = renderJourney([
      { time: 'Sáng', title: 'Vào' },
      { time: 'Chiều', title: 'Ra' },
    ]);
    expect(html).toMatch(/Sáng/);
    expect(html).toMatch(/Vào/);
  });

  it('renders control gate branches', () => {
    const html = renderControlGate([
      { kind: 'approve', label: 'Duyệt' },
      { kind: 'reject', label: 'Từ chối' },
    ]);
    expect(html).toMatch(/Duyệt/);
    expect(html).toMatch(/Từ chối/);
  });

  it('renders before-after', () => {
    const html = renderBeforeAfter(
      { title: 'Trước', items: ['Excel'] },
      { title: 'Sau', items: ['Hệ thống'] },
    );
    expect(html).toMatch(/Excel/);
    expect(html).toMatch(/Hệ thống/);
  });

  it('renders screen sketch svg without real data paths', () => {
    const html = renderScreenSketch('Phiếu thu', [
      { x: 10, y: 10, w: 80, h: 20, label: 'Duyệt', kind: 'button' },
    ]);
    expect(html).toMatch(/<svg/);
    expect(html).toMatch(/Duyệt/);
    expect(html).not.toMatch(/cmc_prod|localhost|\.png/);
  });

  it('renders home map clickable blocks', () => {
    const html = renderHomeMap([
      { id: 'a', label: 'Sale', kind: 'role', href: 'role-sale' },
      { id: 'b', label: 'Cổng tiền', kind: 'gate', href: 'spine-03' },
    ]);
    expect(html).toMatch(/href="#\/role-sale"/);
    expect(html).toMatch(/Cổng tiền/);
  });
});
