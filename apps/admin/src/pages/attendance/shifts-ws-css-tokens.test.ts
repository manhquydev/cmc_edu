import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// Source lock: Work Schedule compose chrome must use Console/CMC tokens,
// not free TEKY teal makeup (#00a09d / #017e84). Authority:
// docs/design-system-console.md (interactive accent = --cmc-brand).

const source = readFileSync(resolve(process.cwd(), 'src/pages/attendance/shifts.tsx'), 'utf8');

describe('shifts compose WS_CSS — Console token authority', () => {
  it('does not hardcode TEKY free teal (#00a09d / #017e84)', () => {
    expect(source).not.toMatch(/#00a09d/i);
    expect(source).not.toMatch(/#017e84/i);
  });

  it('aliases --ws-teal* to CMC brand tokens already used in Console', () => {
    expect(source).toMatch(/--ws-teal:\s*var\(--cmc-brand\)/);
    expect(source).toMatch(/--ws-teal-dark:\s*var\(--cmc-brand-hover\)/);
  });
});
