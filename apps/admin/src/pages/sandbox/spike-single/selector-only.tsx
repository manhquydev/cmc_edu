// See button-only.tsx for context.
import { useState } from 'react';
import { Selector } from '@astryxdesign/core/Selector';

export default function SelectorOnly() {
  const [v, setV] = useState('a');
  return <Selector label="Lớp" value={v} onChange={setV} options={['a', 'b', 'c']} />;
}
