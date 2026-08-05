/**
 * Design Lab 3 — source-grounded Odoo backend UI recreation (parity harness).
 * Route: /design3 — DEV-only, outside RequireAuth/Shell (see routes/index.tsx).
 * Uses @cmc/ui odoo layer (OdooNavbar, KanbanBoard) + fixture data only.
 * Supersedes page-local design-lab-3.css as the design source of truth.
 */
import { useState } from 'react';
import {
  Button,
  KanbanBoard,
  KanbanCard,
  KanbanColumn,
  LineIcon,
  OdooNavbar,
  useToast,
  type NavModule,
} from '@cmc/ui';

type DemoStatus = 'draft' | 'confirmed' | 'done';

interface DemoRecord {
  id: string;
  name: string;
  program: string;
  status: DemoStatus;
  amount: string;
}

/** Fixture data only — no production session or data-layer coupling. */
const DEMO_RECORDS: DemoRecord[] = [
  { id: '1', name: 'Nguyễn Hoàng Nam', program: 'English Kids A2', status: 'draft', amount: '4.800.000 đ' },
  { id: '2', name: 'Trần Minh Anh', program: 'Coding Robotics B1', status: 'confirmed', amount: '6.500.000 đ' },
  { id: '3', name: 'Lê Quốc Bảo', program: 'IELTS Master 7.5', status: 'confirmed', amount: '12.000.000 đ' },
  { id: '4', name: 'Phạm Thu Thảo', program: 'Math Logic A1', status: 'done', amount: '3.200.000 đ' },
  { id: '5', name: 'Đỗ Gia Hân', program: 'Art & Design Studio', status: 'draft', amount: '5.100.000 đ' },
  { id: '6', name: 'Vũ Minh Khang', program: 'Chess Masters', status: 'done', amount: '2.900.000 đ' },
];

const STATUS_STEPS: DemoStatus[] = ['draft', 'confirmed', 'done'];

const STATUS_LABEL: Record<DemoStatus, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  done: 'Done',
};

// Maps to --odoo-kanban-color-N tokens (odoo.css), status→index table.
const STATUS_COLOR_INDEX: Record<DemoStatus, 1 | 2 | 3 | 4 | 5 | 6> = {
  draft: 1,
  confirmed: 4,
  done: 6,
};

/** Demo nav tree for the OdooNavbar parity harness (fixture only). */
const DEMO_APPS: NavModule[] = [
  {
    id: 'crm',
    label: 'CRM',
    icon: 'users',
    path: '/crm',
    children: [
      { id: 'students', label: 'Học viên', path: '/crm/students', icon: 'user' },
      { id: 'reports', label: 'Báo cáo', path: '/crm/reports', icon: 'layers' },
      { id: 'config', label: 'Cấu hình', path: '/crm/config', icon: 'shield' },
    ],
  },
  { id: 'finance', label: 'Finance', icon: 'dollar', path: '/finance' },
  { id: 'hr', label: 'HR', icon: 'user', path: '/hr' },
  { id: 'teaching', label: 'Teaching', icon: 'book', path: '/teaching' },
  { id: 'ops', label: 'Ops', icon: 'layers', path: '/ops' },
  { id: 'admin', label: 'Admin', icon: 'shield', path: '/admin' },
];

export default function DesignLab3Page() {
  const { info, success } = useToast();
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [activeStatus, setActiveStatus] = useState<DemoStatus>('confirmed');
  const [activeAppId, setActiveAppId] = useState('crm');

  return (
    <div className="o_web_client">
      <OdooNavbar
        apps={DEMO_APPS}
        activeAppId={activeAppId}
        isChildVisible={() => true}
        brand="CMC EDU"
        onNavigate={(path) => {
          const app = DEMO_APPS.find((a) => a.path === path || a.children?.some((c) => c.path === path));
          if (app) setActiveAppId(app.id);
          info(`Demo navigate → ${path}`);
        }}
        systray={
          <button
            type="button"
            className="o-systray-badge"
            onClick={() => info('3 thông báo mới')}
            aria-label="Thông báo"
          >
            <LineIcon name="alert" size={16} strokeWidth={2.25} />
            <span className="o-badge-count">3</span>
          </button>
        }
      />

      <div className="o-control-panel">
        <div className="o-breadcrumbs">
          <button
            type="button"
            className="o-breadcrumb-link"
            onClick={() => info('Điều hướng tới Học viên (demo)')}
          >
            Học viên
          </button>
          <span className="o-breadcrumb-sep">/</span>
          <span className="o-breadcrumb-current">Ghi danh</span>
        </div>
        <div className="o-panel-buttons">
          <Button
            label="+ New"
            variant="primary"
            size="sm"
            onClick={() => success('Khởi tạo phiếu ghi danh mới (demo)')}
          />
        </div>
        <button
          type="button"
          className="o-search"
          onClick={() => info('Tìm kiếm nâng cao (demo)')}
        >
          <LineIcon name="search" size={14} strokeWidth={2.25} />
          <span>Tìm kiếm...</span>
        </button>
        <div className="o-actions">
          <div className="o-view-switcher" role="group" aria-label="Chuyển chế độ xem">
            <button
              type="button"
              aria-pressed={viewMode === 'list'}
              aria-label="Xem dạng danh sách"
              className={viewMode === 'list' ? 'is-active' : ''}
              onClick={() => setViewMode('list')}
            >
              <LineIcon name="list" size={15} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'kanban'}
              aria-label="Xem dạng kanban"
              className={viewMode === 'kanban' ? 'is-active' : ''}
              onClick={() => setViewMode('kanban')}
            >
              <LineIcon name="kanban" size={15} strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </div>

      <div className="o-content">
        <div className="o-statusbar">
          {STATUS_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              className={`o-statusbar-step${activeStatus === step ? ' is-active' : ''}`}
              onClick={() => setActiveStatus(step)}
            >
              {STATUS_LABEL[step]}
            </button>
          ))}
        </div>

        {viewMode === 'list' ? (
          <table className="o-list-table">
            <thead>
              <tr>
                <th className="o-list-checkbox-col">
                  <input type="checkbox" aria-label="Chọn tất cả" />
                </th>
                <th>Học viên</th>
                <th>Chương trình</th>
                <th>Trạng thái</th>
                <th className="o-list-number-col">Học phí</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_RECORDS.map((record) => (
                <tr key={record.id} className="o-list-row">
                  <td className="o-list-checkbox-col">
                    <input type="checkbox" aria-label={`Chọn ${record.name}`} />
                  </td>
                  <td>{record.name}</td>
                  <td>{record.program}</td>
                  <td>{STATUS_LABEL[record.status]}</td>
                  <td className="o-list-number-col">{record.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <KanbanBoard>
            {STATUS_STEPS.map((step) => {
              const records = DEMO_RECORDS.filter((record) => record.status === step);
              return (
                <KanbanColumn key={step} title={STATUS_LABEL[step]} count={records.length}>
                  {records.map((record) => (
                    <KanbanCard
                      key={record.id}
                      title={record.name}
                      subtitle={record.program}
                      footer={record.amount}
                      colorIndex={STATUS_COLOR_INDEX[record.status]}
                    />
                  ))}
                </KanbanColumn>
              );
            })}
          </KanbanBoard>
        )}
      </div>
    </div>
  );
}
