/**
 * Design Lab 3 — source-grounded Odoo backend UI recreation.
 * Route: /design3 (top-level, outside RequireAuth/Shell — see routes/index.tsx).
 * Supersedes the approximated "Odoo Cockpit" section in design-lab-2.tsx: navbar
 * color, statusbar shape, and kanban card treatment are ported from Odoo's real
 * source (see design-lab-3.css header for provenance), not guessed.
 */
import { useState, type CSSProperties } from 'react';
import { Button, LineIcon, useToast, type IconName } from '@cmc/ui';
import './design-lab-3.css';

type DemoStatus = 'draft' | 'confirmed' | 'done';

interface DemoRecord {
  id: string;
  name: string;
  program: string;
  status: DemoStatus;
  amount: string;
}

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

// Maps to --odoo-kanban-color-N tokens (design-lab-3.css), per Phase 1's status→index table.
const STATUS_COLOR_INDEX: Record<DemoStatus, number> = {
  draft: 1,
  confirmed: 4,
  done: 6,
};

const APP_SWITCHER_MODULES: { id: string; label: string; icon: IconName }[] = [
  { id: 'crm', label: 'CRM', icon: 'users' },
  { id: 'finance', label: 'Finance', icon: 'dollar' },
  { id: 'hr', label: 'HR', icon: 'user' },
  { id: 'teaching', label: 'Teaching', icon: 'book' },
  { id: 'ops', label: 'Ops', icon: 'layers' },
  { id: 'admin', label: 'Admin', icon: 'shield' },
];

export default function DesignLab3Page() {
  const { info, success } = useToast();
  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [activeStatus, setActiveStatus] = useState<DemoStatus>('confirmed');

  return (
    <div className="odoo-lab-root">
      <nav className="odoo-lab-navbar">
        <button
          type="button"
          className="odoo-lab-app-switcher-toggle"
          onClick={() => setAppSwitcherOpen((open) => !open)}
          aria-expanded={appSwitcherOpen}
          aria-label="Mở app switcher"
        >
          <LineIcon name="grid" size={18} strokeWidth={2.25} />
        </button>
        <span className="odoo-lab-brand">CMC EDU</span>
        <ul className="odoo-lab-menu-sections">
          <li className="odoo-lab-menu-item">Học viên</li>
          <li className="odoo-lab-menu-item">Báo cáo</li>
          <li className="odoo-lab-menu-item">Cấu hình</li>
        </ul>
        <div className="odoo-lab-systray">
          <button
            type="button"
            className="odoo-lab-systray-badge"
            onClick={() => info('3 thông báo mới')}
            aria-label="Thông báo"
          >
            <LineIcon name="alert" size={16} strokeWidth={2.25} />
            <span className="odoo-lab-badge-count">3</span>
          </button>
        </div>
        {appSwitcherOpen && (
          <div className="odoo-lab-app-switcher-menu">
            {APP_SWITCHER_MODULES.map((mod) => (
              <button
                key={mod.id}
                type="button"
                className="odoo-lab-app-switcher-tile"
                onClick={() => {
                  info(`Đã chuyển tới module ${mod.label}`);
                  setAppSwitcherOpen(false);
                }}
              >
                <LineIcon name={mod.icon} size={20} strokeWidth={2} />
                <span>{mod.label}</span>
              </button>
            ))}
          </div>
        )}
      </nav>

      <div className="odoo-lab-control-panel">
        <div className="odoo-lab-breadcrumbs">
          <span>Học viên</span>
          <span className="odoo-lab-breadcrumb-sep">/</span>
          <span className="odoo-lab-breadcrumb-current">Ghi danh</span>
        </div>
        <button
          type="button"
          className="odoo-lab-search"
          onClick={() => info('Tìm kiếm nâng cao (demo)')}
        >
          <LineIcon name="search" size={14} strokeWidth={2.25} />
          <span>Tìm kiếm...</span>
        </button>
        <div className="odoo-lab-actions">
          <div className="odoo-lab-view-switcher" role="group" aria-label="Chuyển chế độ xem">
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
          <Button
            label="+ New"
            variant="primary"
            size="sm"
            onClick={() => success('Khởi tạo phiếu ghi danh mới (demo)')}
          />
        </div>
      </div>

      <div className="odoo-lab-content">
        <div className="odoo-lab-statusbar">
          {STATUS_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              className={`odoo-lab-statusbar-step${activeStatus === step ? ' is-active' : ''}`}
              onClick={() => setActiveStatus(step)}
            >
              {STATUS_LABEL[step]}
            </button>
          ))}
        </div>

        {viewMode === 'list' ? (
          <table className="odoo-lab-list-table">
            <thead>
              <tr>
                <th className="odoo-lab-list-checkbox-col">
                  <input type="checkbox" aria-label="Chọn tất cả" />
                </th>
                <th>Học viên</th>
                <th>Chương trình</th>
                <th>Trạng thái</th>
                <th className="odoo-lab-list-number-col">Học phí</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_RECORDS.map((record) => (
                <tr key={record.id} className="odoo-lab-list-row">
                  <td className="odoo-lab-list-checkbox-col">
                    <input type="checkbox" aria-label={`Chọn ${record.name}`} />
                  </td>
                  <td>{record.name}</td>
                  <td>{record.program}</td>
                  <td>{STATUS_LABEL[record.status]}</td>
                  <td className="odoo-lab-list-number-col">{record.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="odoo-lab-kanban-board">
            {STATUS_STEPS.map((step) => {
              const records = DEMO_RECORDS.filter((record) => record.status === step);
              return (
                <div key={step} className="odoo-lab-kanban-col">
                  <div className="odoo-lab-kanban-col-header">
                    <span>{STATUS_LABEL[step]}</span>
                    <span className="odoo-lab-kanban-col-count">{records.length}</span>
                  </div>
                  {records.map((record) => {
                    const cardStyle = {
                      '--odoo-kanban-card-color': `var(--odoo-kanban-color-${STATUS_COLOR_INDEX[record.status]})`,
                    } as CSSProperties;
                    return (
                      <div key={record.id} className="odoo-lab-kanban-card" style={cardStyle}>
                        <div className="odoo-lab-kanban-card-title">{record.name}</div>
                        <div className="odoo-lab-kanban-card-sub">{record.program}</div>
                        <div className="odoo-lab-kanban-card-footer">{record.amount}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
