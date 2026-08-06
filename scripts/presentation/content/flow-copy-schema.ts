// Runtime validation for FlowCopy — missing required fields fail the build.

import type { DiagramKind, FlowCopy } from '../types.js';

const DIAGRAM_KINDS: DiagramKind[] = ['swimlane', 'journey', 'control-gate', 'before-after'];

export interface FlowCopyIssue {
  id: string;
  field: string;
  message: string;
}

export function validateFlowCopy(copy: Partial<FlowCopy> & { id?: string }): FlowCopyIssue[] {
  const id = copy.id ?? '(missing-id)';
  const issues: FlowCopyIssue[] = [];
  const req = (field: keyof FlowCopy, label: string) => {
    const v = copy[field];
    if (typeof v !== 'string' || v.trim().length === 0) {
      issues.push({ id, field, message: `Thiếu ${label}` });
    }
  };
  req('id', 'mã luồng');
  req('title', 'tiêu đề tiếng Việt');
  req('whoStarts', 'ai bắt đầu');
  req('whoApproves', 'ai duyệt');
  req('systemDoes', 'hệ thống tự làm gì');
  req('resultScreen', 'màn hình kết quả');

  if (copy.diagram && !DIAGRAM_KINDS.includes(copy.diagram)) {
    issues.push({ id, field: 'diagram', message: `Loại hình không hợp lệ: ${String(copy.diagram)}` });
  }

  if (copy.diagram === 'swimlane' && (!copy.steps || copy.steps.length === 0)) {
    issues.push({ id, field: 'steps', message: 'Swimlane cần steps' });
  }
  if (copy.diagram === 'journey' && (!copy.milestones || copy.milestones.length === 0)) {
    issues.push({ id, field: 'milestones', message: 'Journey cần milestones' });
  }
  if (copy.diagram === 'control-gate' && (!copy.gateOptions || copy.gateOptions.length === 0)) {
    issues.push({ id, field: 'gateOptions', message: 'Control-gate cần gateOptions' });
  }
  if (copy.diagram === 'before-after' && (!copy.before || !copy.after)) {
    issues.push({ id, field: 'before/after', message: 'Before-after cần before và after' });
  }

  return issues;
}

export function assertAllFlowCopies(
  copies: FlowCopy[],
  expectedIds: string[],
): void {
  const byId = new Map(copies.map((c) => [c.id, c]));
  const issues: FlowCopyIssue[] = [];

  for (const id of expectedIds) {
    const c = byId.get(id);
    if (!c) {
      issues.push({ id, field: 'id', message: 'Thiếu nội dung luồng so với manifest' });
      continue;
    }
    issues.push(...validateFlowCopy(c));
  }

  for (const c of copies) {
    if (!expectedIds.includes(c.id)) {
      issues.push({ id: c.id, field: 'id', message: 'Thừa so với manifest' });
    }
  }

  if (issues.length > 0) {
    const lines = issues.map((i) => `  ${i.id}.${i.field}: ${i.message}`);
    throw new Error(`Flow copy schema fail (${issues.length}):\n${lines.join('\n')}`);
  }
}
