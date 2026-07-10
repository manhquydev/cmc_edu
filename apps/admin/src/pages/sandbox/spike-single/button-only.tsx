// Phase 1 bundle-delta re-measurement: isolates ONE Astryx component per
// chunk for a like-for-like comparison against Mantine's existing
// per-component chunks (see reports/spike-findings.md "Gate (e) re-check").
// Dev-only, same lifecycle as ../astryx-spike.tsx.
import { Button } from '@astryxdesign/core/Button';

export default function ButtonOnly() {
  return <Button label="Lưu" variant="primary" />;
}
