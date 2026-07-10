import { HStack } from '@astryxdesign/core/Stack';
import type { ReactNode } from 'react';

export interface MasterDetailProps {
  list: ReactNode;
  detail: ReactNode;
  selectedId?: string;
  listWidth?: number | string;
}

export function MasterDetail({ list, detail, selectedId, listWidth = 320 }: MasterDetailProps) {
  return (
    <HStack gap={0} align="stretch" style={{ height: '100%', overflow: 'hidden' }}>
      <div
        style={{
          width: listWidth,
          flexShrink: 0,
          borderRight: '1px solid var(--cmc-border)',
          overflowY: 'auto',
          background: 'var(--cmc-surface)',
        }}
      >
        {list}
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          background: selectedId ? 'var(--cmc-surface)' : 'var(--cmc-surface-2)',
        }}
      >
        {detail}
      </div>
    </HStack>
  );
}
