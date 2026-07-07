import { Box, Group } from '@mantine/core';
import type { ReactNode } from 'react';

export interface MasterDetailProps {
  list: ReactNode;
  detail: ReactNode;
  selectedId?: string;
  listWidth?: number | string;
}

export function MasterDetail({ list, detail, selectedId, listWidth = 320 }: MasterDetailProps) {
  return (
    <Group gap={0} align="stretch" style={{ height: '100%', overflow: 'hidden' }}>
      <Box
        style={{
          width: listWidth,
          flexShrink: 0,
          borderRight: '1px solid var(--cmc-border)',
          overflowY: 'auto',
          background: 'var(--cmc-surface)',
        }}
      >
        {list}
      </Box>
      <Box
        style={{
          flex: 1,
          overflowY: 'auto',
          background: selectedId ? 'var(--cmc-surface)' : 'var(--cmc-surface-2)',
        }}
      >
        {detail}
      </Box>
    </Group>
  );
}
