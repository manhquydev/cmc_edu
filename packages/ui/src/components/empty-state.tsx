import { EmptyState as AstryxEmptyState } from '@astryxdesign/core/EmptyState';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <AstryxEmptyState title={title} description={description} icon={icon} actions={action} />
  );
}
