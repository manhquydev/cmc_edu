import { describe, expect, it } from 'vitest';

import {
  checkFlowCopy,
  checkHtmlVisible,
  checkSpineBeat,
  countWords,
  findForbidden,
  LOOKUP_WORD_LIMIT,
  SPINE_WORD_LIMIT,
} from './check-copy.js';
import type { FlowCopy, SpineBeat } from './types.js';

describe('countWords', () => {
  it('counts Vietnamese words separated by spaces', () => {
    expect(countWords('Sale lập phiếu thu nháp')).toBe(5);
  });
  it('returns 0 for empty', () => {
    expect(countWords('   ')).toBe(0);
  });
});

describe('findForbidden', () => {
  it('finds jargon case-insensitively', () => {
    expect(findForbidden('dùng tRPC procedure')).toEqual(
      expect.arrayContaining(['tRPC', 'procedure']),
    );
  });
  it('allows KPI', () => {
    expect(findForbidden('chấm KPI cuối tháng')).toEqual([]);
  });
  it('flags geofence and OR gate from displayName jargon', () => {
    expect(findForbidden('geofence OR gate')).toEqual(
      expect.arrayContaining(['geofence', 'OR gate']),
    );
  });
});

describe('checkSpineBeat', () => {
  it('flags over 25 words on main spine body', () => {
    const beat: SpineBeat = {
      id: 'x',
      title: 'Tiêu đề',
      lines: [
        'Một hai ba bốn năm sáu bảy tám chín mười mười một mười hai mười ba mười bốn mười lăm mười sáu mười bảy mười tám mười chín hai mươi hai mươi mốt',
      ],
    };
    const v = checkSpineBeat(beat);
    expect(v.some((x) => x.kind === 'word-limit')).toBe(true);
    expect(countWords([...beat.lines, beat.title].join(' '))).toBeGreaterThan(SPINE_WORD_LIMIT);
  });

  it('accepts a short beat', () => {
    const beat: SpineBeat = {
      id: 'ok',
      title: 'Cổng tiền',
      lines: ['Giám đốc duyệt phiếu.', 'Vượt ngưỡng cần thêm một mắt.'],
    };
    expect(checkSpineBeat(beat)).toEqual([]);
  });
});

describe('checkFlowCopy', () => {
  it('flags forbidden words in lookup copy', () => {
    const copy: FlowCopy = {
      id: 'P1-01',
      title: 'Test',
      diagram: 'journey',
      whoStarts: 'Sale',
      whoApproves: 'Không',
      systemDoes: 'Gọi endpoint tRPC',
      resultScreen: 'CRM',
      milestones: [{ title: 'A' }],
    };
    expect(checkFlowCopy(copy).some((v) => v.kind === 'forbidden')).toBe(true);
  });

  it('enforces lookup word limit separately from spine', () => {
    expect(LOOKUP_WORD_LIMIT).toBeGreaterThan(SPINE_WORD_LIMIT);
  });
});

describe('checkHtmlVisible', () => {
  it('ignores notes and scripts for forbidden words', () => {
    const html = `<html><body><p>Xin chào</p>
      <aside class="notes">tRPC procedure endpoint</aside>
      <script>const x = "https://example.com"</script>
    </body></html>`;
    // script still has https — plan says grep entire output for http(s)
    // so network check still fires; forbidden in notes should NOT fire
    const v = checkHtmlVisible(html);
    expect(v.some((x) => x.detail.includes('tRPC'))).toBe(false);
    expect(v.some((x) => x.where === 'html:network')).toBe(true);
  });

  it('passes clean offline html', () => {
    const html = `<html><body><p>Giám đốc duyệt phiếu</p><script>var a=1</script></body></html>`;
    expect(checkHtmlVisible(html)).toEqual([]);
  });
});
