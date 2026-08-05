// Clickable home-map blocks → reveal slide ids.

import type { HomeMapBlock } from '../types.js';

export const homeMapBlocks: HomeMapBlock[] = [
  // Roles
  { id: 'role-sale', label: 'Sale', kind: 'role', href: 'role-sale' },
  { id: 'role-gdkd', label: 'GĐ Kinh doanh', kind: 'role', href: 'role-gdkd' },
  { id: 'role-gddt', label: 'GĐ Đào tạo', kind: 'role', href: 'role-gddt' },
  { id: 'role-gv', label: 'Giáo viên', kind: 'role', href: 'role-gv' },
  { id: 'role-ph', label: 'Phụ huynh', kind: 'role', href: 'role-ph' },
  { id: 'role-hv', label: 'Học viên', kind: 'role', href: 'role-hv' },
  { id: 'role-admin', label: 'Quản trị', kind: 'role', href: 'cluster-admin' },
  // System / AI
  { id: 'sys', label: '⚙️ Hệ thống tự làm', kind: 'system', href: 'role-system' },
  { id: 'ai', label: '🤖 AI soạn nháp', kind: 'ai', href: 'role-ai' },
  // Clusters
  { id: 'c-p1', label: 'Tuyển sinh & ghi danh', kind: 'cluster', href: 'cluster-p1' },
  { id: 'c-p2', label: 'Vận hành lớp', kind: 'cluster', href: 'cluster-p2' },
  { id: 'c-p3', label: 'Nhân sự · ca · lương', kind: 'cluster', href: 'cluster-p3' },
  { id: 'c-p4', label: 'Đổi quà · họp · sau bán', kind: 'cluster', href: 'cluster-p4' },
  { id: 'c-admin', label: 'Quản trị hệ thống', kind: 'cluster', href: 'cluster-admin' },
  // Gates
  { id: 'g-money', label: 'Cổng tiền', kind: 'gate', href: 'spine-03' },
  { id: 'g-shift', label: 'Cổng lịch-ca', kind: 'gate', href: 'flow-P3-04' },
  { id: 'g-auto', label: 'Cổng tự động', kind: 'gate', href: 'spine-04' },
];
