// Named CmcTabs to avoid shadowing Astryx's own Tab/TabList exports.
import { TabList, Tab } from '@astryxdesign/core/TabList';
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
  const active = tabs.find((tab) => tab.id === activeTab);
  return (
    <div className="console-notebook">
      <TabList value={activeTab} onChange={onTabChange} hasDivider>
        {tabs.map((tab) => (
          <Tab key={tab.id} value={tab.id} label={tab.label} />
        ))}
      </TabList>
      {active?.content}
    </div>
  );
}
