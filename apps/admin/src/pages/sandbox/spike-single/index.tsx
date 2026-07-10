// Phase 1 bundle-delta re-measurement harness. Each button below is a
// separate lazy import so Vite emits one chunk per component, letting us
// read isolated per-component gzip sizes from the build log instead of one
// lumped multi-component chunk. See reports/spike-findings.md "Gate (e)
// re-check". Dev-only, same lifecycle as ../astryx-spike.tsx.
import { lazy, Suspense, useState } from 'react';

const modules = {
  Button: lazy(() => import('./button-only.js')),
  NumberInput: lazy(() => import('./number-input-only.js')),
  Selector: lazy(() => import('./selector-only.js')),
  Table: lazy(() => import('./table-only.js')),
};

export default function SpikeSingleIndex() {
  const [active, setActive] = useState<keyof typeof modules | null>(null);
  const Active = active ? modules[active] : null;
  return (
    <div style={{ padding: 24 }}>
      {(Object.keys(modules) as (keyof typeof modules)[]).map((name) => (
        <button key={name} onClick={() => setActive(name)} style={{ marginRight: 8 }}>
          {name}
        </button>
      ))}
      <Suspense fallback="loading">{Active ? <Active /> : null}</Suspense>
    </div>
  );
}
