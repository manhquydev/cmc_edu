/**
 * Design Lab 2 — Modern SaaS Design System Catalog (CMC EDU 2.0).
 * Route: /design2 (unauthenticated).
 * Bright, vibrant, structured SaaS UI system showcasing live @cmc/ui components.
 * A source-grounded Odoo UI recreation lives separately at /design3 (design-lab-3.tsx).
 */
import { useState } from 'react';
import {
  ActivityTimeline,
  Banner,
  Button,
  Callout,
  ConfirmDialog,
  CountBadge,
  DataTable,
  EntityHeader,
  LineIcon,
  MetaRow,
  MetricCard,
  PasswordInput,
  ProgressSteps,
  StatusBadge,
  TextField,
  useToast,
  type IconName,
  type TableColumn,
} from '@cmc/ui';
import './design-lab-2.css';

const COLOR_SWATCHES = [
  { name: 'Primary Indigo', token: '--saas-brand-primary', hex: '#4F46E5' },
  { name: 'Sky Accent', token: '--saas-sky', hex: '#0284C7' },
  { name: 'Emerald Success', token: '--saas-emerald', hex: '#10B981' },
  { name: 'Amber Warning', token: '--saas-amber', hex: '#F59E0B' },
  { name: 'Rose Danger', token: '--saas-rose', hex: '#F43F5E' },
  { name: 'Violet Premium', token: '--saas-violet', hex: '#8B5CF6' },
  { name: 'Canvas Light', token: '--saas-bg-canvas', hex: '#FAFAFC' },
  { name: 'Surface White', token: '--saas-bg-surface', hex: '#FFFFFF' },
  { name: 'Text Dark Slate', token: '--saas-text-primary', hex: '#0F172A' },
  { name: 'Text Muted', token: '--saas-text-muted', hex: '#94A3B8' },
];

const ICON_LIST: IconName[] = [
  'grid', 'book', 'users', 'card', 'shield', 'calendar', 'check-circle', 'edit',
  'camera', 'clipboard', 'receipt', 'dollar', 'search', 'user', 'building', 'layers',
  'target', 'alert', 'filter', 'plus', 'logout', 'globe', 'clock', 'trophy', 'gift', 'star',
];

interface DemoStudent extends Record<string, unknown> {
  id: string;
  name: string;
  code: string;
  class: string;
  status: string;
  amount: string;
}

const DEMO_STUDENTS: DemoStudent[] = [
  { id: '1', name: 'Nguyễn Hoàng Nam', code: 'STD-9081', class: 'English Kids A2', status: 'approved', amount: '4.800.000 đ' },
  { id: '2', name: 'Trần Minh Anh', code: 'STD-9082', class: 'Coding Robotics B1', status: 'pending', amount: '6.500.000 đ' },
  { id: '3', name: 'Lê Quốc Bảo', code: 'STD-9083', class: 'IELTS Master 7.5', status: 'draft', amount: '12.000.000 đ' },
  { id: '4', name: 'Phạm Thu Thảo', code: 'STD-9084', class: 'Math Logic A1', status: 'rejected', amount: '3.200.000 đ' },
];

const STUDENT_COLS: TableColumn<DemoStudent>[] = [
  { key: 'code', label: 'Mã Học viên', render: (_v, r) => <code style={{ color: 'var(--saas-brand-primary)', fontWeight: 600 }}>{r.code}</code> },
  { key: 'name', label: 'Họ và tên', render: (_v, r) => <strong>{r.name}</strong> },
  { key: 'class', label: 'Chương trình học', render: (_v, r) => r.class },
  { key: 'status', label: 'Trạng thái ghi danh', render: (_v, r) => <StatusBadge status={r.status} /> },
  { key: 'amount', label: 'Học phí', render: (_v, r) => <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.amount}</span> },
];

const NAV_ITEMS = [
  { id: 'overview', label: '🚀 General Overview', icon: 'grid' },
  { id: 'colors', label: '🎨 Color Palette Tokens', icon: 'layers' },
  { id: 'buttons', label: '🔘 Buttons & CTAs', icon: 'check-circle' },
  { id: 'status', label: '🏷️ Status Badges', icon: 'shield' },
  { id: 'forms', label: '📝 Form Controls & Inputs', icon: 'edit' },
  { id: 'tables', label: '📊 Data Tables & Lists', icon: 'clipboard' },
  { id: 'feedback', label: '💬 Feedback & Modals', icon: 'alert' },
  { id: 'identity', label: '👤 Identity & Avatars', icon: 'user' },
  { id: 'icons', label: '★ LineIcon System', icon: 'star' },
];

export default function DesignLab2Page() {
  const { success, error, info } = useToast();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [formName, setFormName] = useState<string>('Nguyễn Hoàng Nam');
  const [formEmail, setFormEmail] = useState<string>('hoangnam@cmcedu.vn');
  const [formPass, setFormPass] = useState<string>('SecuredPass2026');
  const [stepIdx, setStepIdx] = useState<number>(1);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    info(`Đã sao chép mã màu: ${text}`);
  };

  const scrollToSection = (id: string) => {
    setActiveTab(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="saas-root">
      {/* SaaS Top Header */}
      <header className="saas-header">
        <div className="saas-header-left">
          <a href="/design2" className="saas-brand-logo">
            <div className="saas-brand-logo-icon">
              <LineIcon name="layers" size={18} />
            </div>
            CMC EDU SaaS Design System
          </a>
          <span className="saas-badge-version">v2.5.0</span>
        </div>

        <div className="saas-header-right">
          <div className="saas-search-fake" onClick={() => info('⌘K Command Palette')}>
            <LineIcon name="search" size={14} />
            <span>Tìm kiếm component hoặc section...</span>
            <span className="saas-search-kbd">⌘K</span>
          </div>

          <Button
            label="Bật Thông báo Test"
            variant="secondary"
            size="sm"
            onClick={() => success('Hệ thống SaaS Design System đang hoạt động mượt mà!')}
          />
        </div>
      </header>

      {/* Main SaaS Body Layout */}
      <div className="saas-body">
        {/* Sidebar Nav */}
        <aside className="saas-sidebar">
          <p className="saas-nav-group-title">Danh mục Component</p>
          {NAV_ITEMS.map((item) => (
            <div
              key={item.id}
              className={`saas-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => scrollToSection(item.id)}
            >
              <LineIcon name={item.icon as IconName} size={16} />
              {item.label}
            </div>
          ))}
        </aside>

        {/* Main Content Workspace */}
        <main className="saas-main">
          {/* SaaS Hero Card */}
          <div className="saas-hero-card">
            <div className="saas-hero-content">
              <h1>CMC EDU SaaS Design System 2.0</h1>
              <p>
                Catalog component sống của hệ thống thiết kế SaaS: tokens, buttons, forms, tables, feedback —
                toàn bộ icon đa sắc ("màu mè") được chuẩn hóa thành **Monochrome LineIcon 1 màu**. Tăng cường
                trải nghiệm chuyên nghiệp cho quản trị trung tâm đào tạo.
              </p>
            </div>
            <div className="saas-flex-row">
              <Button
                label="Xem Component Catalog"
                variant="primary"
                size="md"
                onClick={() => success('Đã cuộn tới Component Catalog')}
              />
            </div>
          </div>

          {/* Section 1: Overview & Metrics */}
          <section className="saas-section" id="overview">
            <div className="saas-section-header">
              <div>
                <h2 className="saas-section-title">🚀 Overview & Live Metrics</h2>
                <p className="saas-section-desc">Tổng quan các chỉ số hệ thống UI và tiến độ đồng bộ component.</p>
              </div>
            </div>

            <div className="saas-stats-row">
              <div className="saas-stat-card">
                <div className="saas-stat-label">Tổng Component chuẩn</div>
                <div className="saas-stat-number">48+</div>
                <div className="saas-stat-change up">↑ 100% Sẵn sàng SaaS</div>
              </div>

              <div className="saas-stat-card">
                <div className="saas-stat-label">Độ tương phản (WCAG AA)</div>
                <div className="saas-stat-number">4.8 : 1</div>
                <div className="saas-stat-change up">✓ Đạt chuẩn Sáng</div>
              </div>

              <div className="saas-stat-card">
                <div className="saas-stat-label">Tỷ lệ bao phủ Icon</div>
                <div className="saas-stat-number">26 LineIcons</div>
                <div className="saas-stat-change neutral">● Đồng bộ /design</div>
              </div>

              <div className="saas-stat-card">
                <div className="saas-stat-label">Tải trang Tốc độ</div>
                <div className="saas-stat-number">&lt; 120ms</div>
                <div className="saas-stat-change up">⚡ Tối ưu mượt</div>
              </div>
            </div>

            <div className="saas-flex-row">
              <MetricCard
                label="Doanh thu Ghi danh tháng"
                value="1.240.000.000 đ"
                context="+14.2% so với tháng trước"
                icon="receipt"
                href="#"
              />
              <MetricCard
                label="Học viên đang học"
                value="1,420 HV"
                context="+8.5% tăng trưởng"
                icon="users"
                href="#"
              />
            </div>
          </section>

          {/* Section 2: Color Palette */}
          <section className="saas-section" id="colors">
            <div className="saas-section-header">
              <div>
                <h2 className="saas-section-title">🎨 Color Palette Tokens</h2>
                <p className="saas-section-desc">Bảng màu tươi sáng (Vibrant Light Mode) định hình phong cách SaaS hiện đại.</p>
              </div>
            </div>

            <div className="saas-grid-swatches">
              {COLOR_SWATCHES.map((swatch) => (
                <div
                  key={swatch.name}
                  className="saas-swatch-card"
                  onClick={() => copyToClipboard(swatch.hex)}
                >
                  <div className="saas-swatch-color" style={{ background: swatch.hex }} />
                  <div className="saas-swatch-meta">
                    <strong>{swatch.name}</strong>
                    <span>{swatch.hex}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3: Buttons */}
          <section className="saas-section" id="buttons">
            <div className="saas-section-header">
              <div>
                <h2 className="saas-section-title">🔘 Buttons & Action Hierarchy</h2>
                <p className="saas-section-desc">Các nút bấm tương tác đa dạng kích thước, trạng thái và cấp độ ưu tiên.</p>
              </div>
            </div>

            <div className="saas-preview-box">
              <div className="saas-flex-row" style={{ marginBottom: 16 }}>
                <Button label="Primary Button" variant="primary" size="md" onClick={() => info('Primary clicked')} />
                <Button label="Secondary Button" variant="secondary" size="md" onClick={() => info('Secondary clicked')} />
                <Button label="Destructive Button" variant="destructive" size="md" onClick={() => error('Destructive clicked')} />
                <Button label="Loading State" variant="primary" size="md" isLoading />
                <Button label="Disabled Button" variant="primary" size="md" isDisabled />
              </div>

              <div className="saas-flex-row">
                <Button label="Small Size" variant="primary" size="sm" />
                <Button label="Medium Size" variant="primary" size="md" />
                <Button label="Large Size" variant="primary" size="lg" />
              </div>
            </div>
          </section>

          {/* Section 4: Status Badges */}
          <section className="saas-section" id="status">
            <div className="saas-section-header">
              <div>
                <h2 className="saas-section-title">🏷️ Status Badges & Chips</h2>
                <p className="saas-section-desc">Hệ thống nhãn trạng thái nghiệp vụ chuẩn hóa.</p>
              </div>
            </div>

            <div className="saas-preview-box">
              <div className="saas-flex-row">
                <StatusBadge status="approved" />
                <StatusBadge status="pending" />
                <StatusBadge status="draft" />
                <StatusBadge status="rejected" />
                <CountBadge count={14} />
                <CountBadge count={99} />
              </div>
            </div>
          </section>

          {/* Section 5: Form Controls */}
          <section className="saas-section" id="forms">
            <div className="saas-section-header">
              <div>
                <h2 className="saas-section-title">📝 Form Controls & Live Inputs</h2>
                <p className="saas-section-desc">Trường nhập liệu phản hồi tương tác thời gian thực.</p>
              </div>
            </div>

            <div className="saas-preview-box">
              <div className="saas-flex-stack" style={{ maxWidth: 500 }}>
                <TextField
                  label="Họ và tên Học viên"
                  value={formName}
                  onChange={(v) => setFormName(String(v ?? ''))}
                  placeholder="Nhập họ tên..."
                />

                <TextField
                  label="Địa chỉ Email"
                  value={formEmail}
                  onChange={(v) => setFormEmail(String(v ?? ''))}
                  placeholder="name@cmcedu.vn"
                />

                <PasswordInput
                  label="Mật khẩu Tài khoản LMS"
                  value={formPass}
                  onChange={(v) => setFormPass(String(v ?? ''))}
                />

                <div style={{ marginTop: 12 }}>
                  <ProgressSteps
                    activeIndex={stepIdx}
                    onStepClick={setStepIdx}
                    steps={[
                      { id: '1', label: 'Đăng ký' },
                      { id: '2', label: 'Xác nhận' },
                      { id: '3', label: 'Thu phí' },
                      { id: '4', label: 'Hoàn tất' },
                    ]}
                  />
                  <div className="saas-flex-row" style={{ marginTop: 12 }}>
                    <Button label="Bước trước" variant="secondary" size="sm" onClick={() => setStepIdx((s) => Math.max(0, s - 1))} />
                    <Button label="Bước tiếp theo" variant="primary" size="sm" onClick={() => setStepIdx((s) => Math.min(3, s + 1))} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 6: Data Tables */}
          <section className="saas-section" id="tables">
            <div className="saas-section-header">
              <div>
                <h2 className="saas-section-title">📊 Data Tables & List Views</h2>
                <p className="saas-section-desc">Bảng dữ liệu SaaS chuẩn hóa hỗ trợ hiển thị danh sách học viên & tài chính.</p>
              </div>
            </div>

            <div className="saas-preview-box">
              <DataTable<DemoStudent>
                columns={STUDENT_COLS}
                data={DEMO_STUDENTS}
              />
            </div>
          </section>

          {/* Section 7: Feedback & Modals */}
          <section className="saas-section" id="feedback">
            <div className="saas-section-header">
              <div>
                <h2 className="saas-section-title">💬 Feedback & System Modals</h2>
                <p className="saas-section-desc">Các thông báo Banner, Callout và Dialog xác nhận hành động.</p>
              </div>
            </div>

            <div className="saas-preview-box">
              <div className="saas-flex-stack">
                <Banner
                  status="info"
                  title="Cập nhật Hệ thống SaaS v2.5.0"
                  description="Tất cả các tính năng quản lý học viên và thu phí đã được tối ưu tốc độ xử lý."
                />

                <Callout title="Mẹo giao diện Sáng (Bright Mode)">
                  Màu sắc tươi sáng giúp giảm mỏi mắt và tăng khả năng tập trung khi làm việc liên tục trên các thao tác thu ngân.
                </Callout>

                <div className="saas-flex-row">
                  <Button
                    label="Mở Dialog Xác nhận Delete"
                    variant="destructive"
                    size="md"
                    onClick={() => setConfirmOpen(true)}
                  />
                </div>

                <ConfirmDialog
                  opened={confirmOpen}
                  title="Xác nhận xóa hồ sơ Học viên?"
                  message="Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa hồ sơ này khỏi hệ thống CMC EDU không?"
                  confirmLabel="Xóa ngay"
                  onConfirm={() => {
                    setConfirmOpen(false);
                    error('Đã xóa hồ sơ thành công!');
                  }}
                  onCancel={() => setConfirmOpen(false)}
                />
              </div>
            </div>
          </section>

          {/* Section 8: Identity & Activity */}
          <section className="saas-section" id="identity">
            <div className="saas-section-header">
              <div>
                <h2 className="saas-section-title">👤 Identity & Timeline Activity</h2>
                <p className="saas-section-desc">Thành phần nhận diện người dùng và nhật ký hoạt động CRM.</p>
              </div>
            </div>

            <div className="saas-preview-box">
              <div className="saas-flex-stack">
                <EntityHeader
                  title="Nguyễn Hoàng Nam"
                  subtitle="Học viên xuất sắc — Khóa English Kids A2"
                  initials="HN"
                  badges={<StatusBadge status="approved" />}
                />

                <MetaRow>
                  <span>Mã HV: <strong>#STD-9081</strong></span>
                  <span>SĐT Phụ huynh: <strong>0930.773.703</strong></span>
                  <span>Điểm danh: <strong>94.8%</strong></span>
                </MetaRow>

                <div style={{ marginTop: 12 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Nhật ký Hoạt động (Activity Timeline)</h4>
                  <ActivityTimeline
                    items={[
                      { id: '1', title: 'Hoàn tất đóng học phí 4.800.000 đ', meta: '14:02 Hôm nay', tone: 'brand' },
                      { id: '2', title: 'Tham gia lớp học English Kids A2', meta: '13:55 Hôm nay', tone: 'neutral' },
                      { id: '3', title: 'Đăng ký nhập học thành công', meta: 'Hôm qua', tone: 'neutral' },
                    ]}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 9: Icons */}
          <section className="saas-section" id="icons">
            <div className="saas-section-header">
              <div>
                <h2 className="saas-section-title">★ LineIcon System Showroom</h2>
                <p className="saas-section-desc">Bộ icon monochrome outline chuẩn hóa từ trang /design cũ.</p>
              </div>
            </div>

            <div className="saas-grid-swatches" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
              {ICON_LIST.map((icon) => (
                <div key={icon} className="saas-swatch-card" style={{ flexDirection: 'column', textAlign: 'center', padding: 16 }}>
                  <div style={{ color: 'var(--saas-brand-primary)' }}>
                    <LineIcon name={icon} size={22} strokeWidth={2.25} />
                  </div>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--saas-text-secondary)', marginTop: 6 }}>
                    {icon}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>

      {/* Floating Quick Action Dock */}
      <div className="saas-floating-bar">
        <Button label="+ Tạo mới SaaS Record" variant="primary" size="sm" onClick={() => success('Khởi tạo Record thành công!')} />
        <Button label="Thông báo Toast" variant="secondary" size="sm" onClick={() => info('Hệ thống SaaS hoạt động bình thường.')} />
        <Button label="Lên đầu trang" variant="secondary" size="sm" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
      </div>
    </div>
  );
}
