// See button-only.tsx for context.
import { useState } from 'react';
import { NumberInput } from '@astryxdesign/core/NumberInput';

export default function NumberInputOnly() {
  const [v, setV] = useState<number | null>(0);
  return <NumberInput label="Học phí" value={v} onChange={setV} />;
}
