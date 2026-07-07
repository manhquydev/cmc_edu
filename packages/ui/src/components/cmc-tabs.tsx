// Named CmcTabs to avoid shadowing Mantine's own Tabs export.
import { Tabs } from '@mantine/core';
import type { ReactNode } from 'react';

export interface CmcTabDef {
  id: string;
  label: string;
  content: ReactNode;
}

export interface CmcTabsProps {
  tabs: CmcTabDef[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function CmcTabs({ tabs, activeTab, onTabChange }: CmcTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onChange={(v) => {
        if (v) onTabChange(v);
      }}
      radius="xs"
    >
      <Tabs.List style={{ borderBottom: '1px solid var(--cmc-border)' }}>
        {tabs.map((tab) => (
          <Tabs.Tab key={tab.id} value={tab.id} fz="sm">
            {tab.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {tabs.map((tab) => (
        <Tabs.Panel key={tab.id} value={tab.id}>
          {tab.content}
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}
