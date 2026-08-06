import type { FlowCopy } from '../../types.js';
import { adminFlows } from './admin.js';
import { p1Flows } from './p1.js';
import { p2Flows } from './p2.js';
import { p3Flows } from './p3.js';
import { p4Flows } from './p4.js';

export const allFlowCopies: FlowCopy[] = [
  ...p1Flows,
  ...p2Flows,
  ...p3Flows,
  ...p4Flows,
  ...adminFlows,
];

export function flowCopyById(id: string): FlowCopy | undefined {
  return allFlowCopies.find((f) => f.id === id);
}
