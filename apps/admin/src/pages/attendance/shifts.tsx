// Đăng ký ca — Work Schedule UI khớp nghiệp vụ CMC (docs/20 §2, ADR 0040, WF-P3-03/04).
//
// Domain (server-authoritative):
// - ShiftRegistration.status: draft → submitted → approved | rejected | cancelled
//   (API shift.submit tạo thẳng `submitted`; "Soạn" chỉ là trạng thái client trước khi gửi)
// - Ticket-lock: ≤1 phiếu `submitted` / user
// - Track: resolveShiftGroup(roles) → KINH_DOANH | GIAO_VIEN (lọc nhóm ca)
// - KINH_DOANH seed: selectionMode SINGLE, 3 mẫu Ca 1/2/3 (1 ca/ngày)
// - GIAO_VIEN seed: selectionMode MULTIPLE, 3 mẫu Ca 1/2/3 buổi (nhiều ca/ngày)
// - Duyệt: GĐKD ↔ KINH_DOANH, GĐĐT ↔ GIAO_VIEN (role gate, không manager chain)
//
// UI không giả lập Odoo: không Planned, không CONFIRMED (KPI), không Manager chain ảo.

import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Banner,
  Button,
  CmcTabs,
  ConfirmDialog,
  CountBadge,
  DataTable,
  DateField,
  EmptyState,
  HStack,
  ListPage,
  PageHeader,
  Selector,
  Stack,
  StatusBadge,
  Text,
} from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { links, shiftRegistrationNewPath } from '@cmc/links';
import { useSession } from '../../lib/session-context.js';
import { trpc } from '../../lib/trpc.js';

// ---------------------------------------------------------------------------
// Styles — Odoo form density; accent via CMC Console tokens (no free TEKY teal)
// ---------------------------------------------------------------------------

const WS_CSS = `
.ws-root {
  --ws-teal: var(--cmc-brand);
  --ws-teal-dark: var(--cmc-brand-hover);
  --ws-border: #dee2e6;
  --ws-muted: #6c757d;
  --ws-sheet: #fff;
  --ws-bg: #f8f9fa;
  display:flex; flex-direction:column; gap:0; min-height:0;
  background: var(--ws-sheet);
  border: 1px solid var(--ws-border);
  border-radius: 2px;
  overflow: hidden;
}
.ws-cp {
  display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between;
  gap:10px; padding:10px 16px 8px; border-bottom:1px solid var(--ws-border);
}
.ws-cp-title {
  margin:0; font-size:1.35rem; font-weight:400; color: var(--ws-teal-dark); line-height:1.25;
}
.ws-cp-title span { color: var(--ws-muted); font-size:1.05rem; }
.ws-cp-actions { display:flex; flex-wrap:wrap; gap:6px; }
.ws-btn {
  appearance:none; border-radius:3px; font-size:13px; font-weight:500;
  padding:5px 14px; line-height:1.45; cursor:pointer; font-family:inherit;
  border:1px solid transparent;
}
.ws-btn:disabled { opacity:.45; cursor:not-allowed; }
.ws-btn--primary { background: var(--ws-teal); color:#fff; border-color: var(--ws-teal); }
.ws-btn--primary:hover:not(:disabled) { background: var(--ws-teal-dark); }
.ws-btn--outline { background:#fff; color: var(--ws-teal-dark); border-color: var(--ws-teal); }
.ws-btn--outline:hover:not(:disabled) { background: color-mix(in srgb, var(--ws-teal) 8%, #fff); }
.ws-btn--ghost { background:#fff; color:#495057; border-color: var(--ws-border); }
.ws-btn--ghost:hover:not(:disabled) { background: var(--ws-bg); }
.ws-btn--danger { background:#fff; color:#c92a2a; border-color:#ffa8a8; }
.ws-statusbar-row {
  display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between;
  gap:10px; padding:6px 12px; border-bottom:1px solid var(--ws-border); background: var(--ws-bg);
  min-height: 40px;
}
.ws-statusbar-row__left { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
/* Chevron status — clickable when actionable */
.ws-arrow-bar {
  display:flex; align-items:stretch; height:30px; list-style:none; margin:0; padding:0; --arrow:11px;
}
.ws-arrow-bar__item { position:relative; display:flex; margin-left: calc(var(--arrow) * -1); }
.ws-arrow-bar__item:first-child { margin-left:0; }
.ws-arrow-bar__seg {
  display:flex; align-items:center; justify-content:center;
  padding: 0 calc(var(--arrow) + 12px) 0 calc(var(--arrow) + 10px);
  height:100%; font-size:11px; font-weight:600; letter-spacing:.03em;
  text-transform:uppercase; white-space:nowrap; border:0;
  background:#e9ecef; color:#868e96; font-family:inherit;
  clip-path: polygon(0 0, calc(100% - var(--arrow)) 0, 100% 50%, calc(100% - var(--arrow)) 100%, 0 100%, var(--arrow) 50%);
}
.ws-arrow-bar__item:first-child .ws-arrow-bar__seg {
  padding-left:14px;
  clip-path: polygon(0 0, calc(100% - var(--arrow)) 0, 100% 50%, calc(100% - var(--arrow)) 100%, 0 100%);
}
.ws-arrow-bar__item:last-child .ws-arrow-bar__seg {
  padding-right:14px;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, var(--arrow) 50%);
}
.ws-arrow-bar__item.is-done .ws-arrow-bar__seg {
  background: color-mix(in srgb, var(--ws-teal) 22%, #fff); color: var(--ws-teal-dark);
}
.ws-arrow-bar__item.is-current .ws-arrow-bar__seg {
  background: var(--ws-teal); color:#fff; z-index:1;
}
.ws-arrow-bar__item.is-todo .ws-arrow-bar__seg { background:#e9ecef; color:#adb5bd; }
.ws-arrow-bar__item.is-clickable .ws-arrow-bar__seg { cursor:pointer; }
.ws-arrow-bar__item.is-clickable .ws-arrow-bar__seg:hover { filter: brightness(0.95); }
.ws-arrow-bar__item.is-clickable.is-current .ws-arrow-bar__seg:hover { filter: brightness(1.05); }
.ws-arrow-bar__item.is-terminal-bad .ws-arrow-bar__seg {
  background:#fff5f5; color:#c92a2a;
}
.ws-arrow-bar__item.is-terminal-bad.is-current .ws-arrow-bar__seg {
  background:#fa5252; color:#fff;
}
.ws-layout {
  display:grid; grid-template-columns: minmax(0,1fr) 300px; gap:0; min-height:400px;
}
@media (max-width: 1100px) {
  .ws-layout { grid-template-columns:1fr; }
  .ws-chatter { border-left:none !important; border-top:1px solid var(--ws-border); }
}
.ws-main { min-width:0; padding:14px 18px 24px; }
.ws-chatter {
  border-left:1px solid var(--ws-border); background:#fafbfc; padding:14px 12px; font-size:13px;
}
.ws-chatter-head {
  margin:0 0 12px; font-size:11px; font-weight:600; text-transform:uppercase;
  letter-spacing:.06em; color: var(--ws-muted);
}
.ws-chatter-item {
  background:#fff; border:1px solid #e9ecef; border-radius:4px; padding:10px 12px; margin-bottom:10px;
}
.ws-chatter-item .meta { color: var(--ws-muted); font-size:11px; margin-bottom:4px; }
.ws-chatter-item .who { font-weight:600; color:#343a40; margin-bottom:2px; }
.ws-groups {
  display:grid; grid-template-columns:1fr 1fr; gap:2px 36px; margin-bottom:12px;
}
@media (max-width:800px) { .ws-groups { grid-template-columns:1fr; } }
.ws-field {
  display:grid; grid-template-columns:150px minmax(0,1fr); gap:10px; align-items:center;
  min-height:34px; margin-bottom:4px;
}
.ws-field-label { font-size:13px; color:#212529; font-weight:500; }
.ws-field-value { min-width:0; font-size:13px; }
.ws-field-value .console-date-field { width:100%; max-width:200px; }
.ws-field-value input[type="date"] {
  border:0 !important; border-bottom:1px solid #ced4da !important; border-radius:0 !important;
  background:transparent !important; padding-left:0 !important; min-height:28px; box-shadow:none !important;
}
.ws-legend { font-size:13px; color:#495057; margin:6px 0 8px; line-height:1.55; }
.ws-hint {
  font-size:12.5px; color:#495057; line-height:1.55; margin:8px 0 12px; max-width:960px;
  padding:8px 10px; background:#f8f9fa; border-left:3px solid var(--ws-teal); border-radius:0 3px 3px 0;
}
.ws-hint strong { color:#212529; }
.ws-notebook { border:1px solid var(--ws-border); border-radius:2px; overflow:hidden; }
.ws-notebook-tabs { display:flex; background: var(--ws-bg); border-bottom:1px solid var(--ws-border); padding:0 4px; }
.ws-notebook-tab {
  padding:9px 16px; font-size:13px; background:#fff; margin:4px 0 -1px;
  border:1px solid var(--ws-border); border-bottom-color:#fff; color: var(--ws-teal-dark);
  font-weight:500; border-radius:2px 2px 0 0;
}
.ws-notebook-body { overflow-x:auto; background:#fff; }
.ws-matrix { width:100%; border-collapse:collapse; font-size:13px; }
.ws-matrix th, .ws-matrix td {
  border:1px solid var(--ws-border); padding:7px 10px; vertical-align:middle;
}
.ws-matrix thead th { background:#f1f3f5; font-weight:600; font-size:12px; white-space:nowrap; }
.ws-matrix tbody tr:nth-child(even) { background:#fafbfc; }
.ws-matrix tbody tr:hover { background: color-mix(in srgb, var(--ws-teal) 5%, #fff); }
.ws-matrix .ws-hours { text-align:right; font-variant-numeric:tabular-nums; color:#495057; width:72px; }
.ws-matrix .ws-check label {
  display:inline-flex; align-items:center; gap:7px; cursor:pointer; user-select:none; white-space:nowrap;
}
.ws-matrix .ws-check input { width:15px; height:15px; accent-color: var(--ws-teal); margin:0; }
.ws-footer {
  display:flex; justify-content:flex-end; gap:28px; padding:8px 14px;
  border-top:1px solid var(--ws-border); font-size:13px; font-weight:600; background: var(--ws-bg);
}
.ws-error { color:#dc3545; font-size:12px; margin-top:2px; }
.ws-linkish { color: var(--ws-teal-dark); }
.ws-muted { color: var(--ws-muted); }
.ws-banner-slot { margin-bottom:10px; }
.ws-mode-pill {
  display:inline-block; font-size:11px; font-weight:600; padding:2px 8px; border-radius:999px;
  background: color-mix(in srgb, var(--ws-teal) 12%, #fff); color: var(--ws-teal-dark);
}
`;

// ---------------------------------------------------------------------------
// Domain helpers (mirror packages/domain-time resolveShiftGroup + server rules)
// ---------------------------------------------------------------------------

/** Same rule as domain-time resolveShiftGroup — avoid new admin dep. */
function resolveShiftTrack(roles: readonly string[]): 'KINH_DOANH' | 'GIAO_VIEN' {
  return roles.includes('giao_vien') ? 'GIAO_VIEN' : 'KINH_DOANH';
}

function todayICT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function isFutureICT(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  return dateStr > todayICT();
}

function fmtDate(v: unknown): string {
  return new Date(v as string).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const weekday = d.toLocaleDateString('vi-VN', { weekday: 'long' });
  const [y, m, day] = dateStr.split('-');
  return `${day}-${m}-${y} - ${weekday}`;
}

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function eachDateInclusive(from: string, to: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return [];
  const out: string[] = [];
  const cur = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  for (let i = 0; i < 62 && cur <= end; i++) {
    out.push(localYmd(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function hoursBetween(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  const mins = eh * 60 + em - (sh * 60 + sm);
  return mins > 0 ? mins / 60 : 0;
}

function entryKey(date: string, templateId: string): string {
  return `${date}|${templateId}`;
}

function parseEntryKey(key: string): { date: string; shiftTemplateId: string } {
  const i = key.indexOf('|');
  return { date: key.slice(0, i), shiftTemplateId: key.slice(i + 1) };
}

const REG_STATUS_LABELS: Record<string, string> = {
  draft: 'Soạn',
  submitted: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  cancelled: 'Đã hủy',
};

/** CMC lifecycle steps for chevron (NOT Odoo CONFIRMED — that is KPI). */
type StatusStep = { id: string; label: string; terminalBad?: boolean };

function stepsForStatus(status: string): { steps: StatusStep[]; activeIndex: number } {
  if (status === 'rejected') {
    return {
      steps: [
        { id: 'draft', label: 'Soạn' },
        { id: 'submitted', label: 'Chờ duyệt' },
        { id: 'rejected', label: 'Từ chối', terminalBad: true },
      ],
      activeIndex: 2,
    };
  }
  if (status === 'cancelled') {
    return {
      steps: [
        { id: 'draft', label: 'Soạn' },
        { id: 'submitted', label: 'Chờ duyệt' },
        { id: 'cancelled', label: 'Đã hủy', terminalBad: true },
      ],
      activeIndex: 2,
    };
  }
  const happy: StatusStep[] = [
    { id: 'draft', label: 'Soạn' },
    { id: 'submitted', label: 'Chờ duyệt' },
    { id: 'approved', label: 'Đã duyệt' },
  ];
  const idx = status === 'approved' ? 2 : status === 'submitted' ? 1 : 0;
  return { steps: happy, activeIndex: idx };
}

interface ShiftTemplateOption {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}
interface ShiftGroupOption {
  id: string;
  name: string;
  type: string;
  selectionMode?: string;
  templates: ShiftTemplateOption[];
}
interface RegEntry {
  id?: string;
  date: string | Date;
  shiftTemplateId: string;
}

function templateHours(t: ShiftTemplateOption): number {
  return hoursBetween(t.startTime, t.endTime);
}
function entryDateStr(date: string | Date): string {
  if (typeof date === 'string') return date.slice(0, 10);
  return new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}
function groupTypeLabel(type: string): string {
  return type === 'GIAO_VIEN' ? 'Giáo viên' : type === 'KINH_DOANH' ? 'Kinh doanh' : type;
}

function FieldRow({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="ws-field">
      <div className="ws-field-label">{label}</div>
      <div className="ws-field-value">
        {children}
        {error ? <div className="ws-error">{error}</div> : null}
      </div>
    </div>
  );
}

/** Clickable CMC status chevron — only stages with onStepClick(id) fire. */
function CmcStatusChevron({
  steps,
  activeIndex,
  onStepClick,
}: {
  steps: StatusStep[];
  activeIndex: number;
  onStepClick?: (stepId: string, index: number) => void;
}) {
  return (
    <ol className="ws-arrow-bar" aria-label="Trạng thái phiếu đăng ký ca">
      {steps.map((step, i) => {
        const state = i < activeIndex ? 'done' : i === activeIndex ? 'current' : 'todo';
        const clickable = Boolean(onStepClick);
        const classes = [
          'ws-arrow-bar__item',
          `is-${state}`,
          clickable ? 'is-clickable' : '',
          step.terminalBad ? 'is-terminal-bad' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <li key={step.id} className={classes}>
            <button
              type="button"
              className="ws-arrow-bar__seg"
              disabled={!onStepClick}
              aria-current={state === 'current' ? 'step' : undefined}
              title={
                step.id === 'draft'
                  ? 'Soạn lịch (chưa gửi)'
                  : step.id === 'submitted'
                    ? 'Gửi / chờ GĐ duyệt'
                    : step.id === 'approved'
                      ? 'Đã duyệt'
                      : step.label
              }
              onClick={() => onStepClick?.(step.id, i)}
            >
              {step.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Read-only matrix (no Planned)

export function SubmitTab({ onSubmittedId }: { onSubmittedId?: (id: string) => void }) {
  const { me } = useSession();
  const utils = trpc.useUtils();
  const roles = me?.roles ?? [];
  const track = resolveShiftTrack(roles);

  const { data: groupsData, isLoading: groupsLoading, error: groupsError } =
    trpc.shift.listGroups.useQuery();
  const allGroups: ShiftGroupOption[] = (groupsData as ShiftGroupOption[] | undefined) ?? [];
  // Only groups matching caller's track — server rejects mismatches
  const groups = useMemo(
    () => allGroups.filter((g) => g.type === track),
    [allGroups, track],
  );

  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Auto-pick sole matching group
  useEffect(() => {
    if (!groupId && groups.length === 1) setGroupId(groups[0]!.id);
  }, [groups, groupId]);

  const selectedGroup = groups.find((g) => g.id === groupId);
  const templates = selectedGroup?.templates ?? [];
  const isMultiple = selectedGroup?.selectionMode === 'MULTIPLE';

  const groupOptions = groups.map((g) => ({
    value: g.id,
    label: `${g.name} · ${g.selectionMode === 'MULTIPLE' ? 'nhiều ca/ngày' : '1 ca/ngày'}`,
  }));

  const dates = useMemo(() => eachDateInclusive(fromDate, toDate), [fromDate, toDate]);

  const entries = useMemo(() => {
    return [...selected]
      .map(parseEntryKey)
      .filter(
        (e) =>
          dates.includes(e.date) &&
          e.date >= fromDate &&
          e.date <= toDate &&
          templates.some((t) => t.id === e.shiftTemplateId),
      )
      .sort((a, b) => a.date.localeCompare(b.date) || a.shiftTemplateId.localeCompare(b.shiftTemplateId));
  }, [selected, dates, templates, fromDate, toDate]);

  const totalHours = useMemo(() => {
    let h = 0;
    for (const e of entries) {
      const t = templates.find((x) => x.id === e.shiftTemplateId);
      if (t) h += templateHours(t);
    }
    return h;
  }, [entries, templates]);

  const mut = trpc.shift.submit.useMutation({
    onSuccess(data) {
      setResult({ ok: true, text: 'Đăng ký ca đã gửi — trạng thái Chờ duyệt (submitted).' });
      setSelected(new Set());
      setFromDate('');
      setToDate('');
      // keep groupId for next registration convenience
      void utils.shift.myRegistrations.invalidate();
      void utils.shift.pendingForApproval.invalidate();
      if (data?.id) onSubmittedId?.(data.id);
    },
    onError(err) {
      setResult({ ok: false, text: err.message ?? 'Lỗi không xác định.' });
    },
  });

  const fromDateError =
    fromDate && !isFutureICT(fromDate)
      ? 'fromDate phải sau hôm nay (ICT) — server từ chối ngày ≤ hôm nay'
      : undefined;
  const toDateError =
    toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)
      ? 'Ngày không hợp lệ'
      : fromDate && toDate && toDate < fromDate
        ? 'Tới ngày phải ≥ Từ ngày'
        : undefined;

  const canSubmit =
    Boolean(groupId) &&
    isFutureICT(fromDate) &&
    Boolean(toDate) &&
    !toDateError &&
    entries.length > 0;

  function toggleCell(date: string, templateId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = entryKey(date, templateId);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }
      // SINGLE: one template per calendar day (server rule)
      if (!isMultiple) {
        for (const k of [...next]) {
          if (k.startsWith(`${date}|`)) next.delete(k);
        }
      }
      next.add(key);
      return next;
    });
  }

  function clearCompose() {
    setSelected(new Set());
    setFromDate('');
    setToDate('');
    setResult(null);
  }

  function doSubmit() {
    if (!canSubmit || !groupId) return;
    mut.mutate({
      shiftGroupId: groupId,
      fromDate,
      toDate,
      entries: entries.map((e) => ({ date: e.date, shiftTemplateId: e.shiftTemplateId })),
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSubmit();
  }

  /** Statusbar clicks: Soạn → reset; Chờ duyệt → gửi nếu đủ điều kiện */
  function onStatusClick(stepId: string) {
    if (stepId === 'draft') {
      clearCompose();
      return;
    }
    if (stepId === 'submitted') {
      if (canSubmit) doSubmit();
      else if (!result?.ok) {
        setResult({
          ok: false,
          text: 'Chưa thể gửi: chọn nhóm ca, khoảng ngày tương lai, và ít nhất 1 ô ca trên lưới.',
        });
      }
    }
    // approved: not actionable on compose form
  }

  const statusIndex = result?.ok ? 1 : 0;
  const { steps } = stepsForStatus(result?.ok ? 'submitted' : 'draft');
  const roleLabel = roles[0] ? String(roles[0]).replace(/_/g, ' ') : '—';
  const trackLabel = track === 'GIAO_VIEN' ? 'Giáo viên' : 'Kinh doanh';

  return (
    <form onSubmit={handleSubmit} className="ws-root">
      <style>{WS_CSS}</style>

      <div className="ws-cp">
        <h1 className="ws-cp-title">
          Work Schedule <span>/ {roleLabel}</span>
        </h1>
        <div className="ws-cp-actions">
          <button type="button" className="ws-btn ws-btn--outline" onClick={clearCompose}>
            Đặt lại
          </button>
          <button
            type="submit"
            className="ws-btn ws-btn--primary"
            disabled={!canSubmit || mut.isPending}
          >
            {mut.isPending ? 'Đang gửi…' : 'Gửi đăng ký'}
          </button>
        </div>
      </div>

      <div className="ws-statusbar-row">
        <div className="ws-statusbar-row__left">
          <span className="ws-mode-pill">
            Track {trackLabel}
            {selectedGroup
              ? ` · ${isMultiple ? 'MULTIPLE (nhiều ca/ngày)' : 'SINGLE (1 ca/ngày)'}`
              : ''}
          </span>
          <button
            type="button"
            className="ws-btn ws-btn--ghost"
            onClick={() => setSelected(new Set())}
            disabled={selected.size === 0}
          >
            Xóa chọn ca
          </button>
        </div>
        <CmcStatusChevron
          steps={steps}
          activeIndex={statusIndex}
          onStepClick={onStatusClick}
        />
      </div>

      <div className="ws-layout">
        <div className="ws-main">
          {result ? (
            <div className="ws-banner-slot">
              <Banner status={result.ok ? 'success' : 'error'} title={result.text} />
            </div>
          ) : null}
          {groupsError ? (
            <div className="ws-banner-slot">
              <Banner status="error" title={groupsError.message} />
            </div>
          ) : null}

          <div className="ws-groups">
            <div>
              <FieldRow label="Từ ngày" error={fromDateError}>
                <DateField
                  label="Từ ngày"
                  isLabelHidden
                  value={fromDate}
                  onChange={(v) => {
                    setFromDate(v);
                    setSelected(new Set());
                  }}
                  size="md"
                />
              </FieldRow>
              <FieldRow label="Tới ngày" error={toDateError}>
                <DateField
                  label="Đến ngày"
                  isLabelHidden
                  value={toDate}
                  onChange={(v) => {
                    setToDate(v);
                    setSelected(new Set());
                  }}
                  size="md"
                />
              </FieldRow>
              <FieldRow label="Lịch làm việc (nhóm ca)">
                {groupsLoading ? (
                  <span className="ws-muted">Đang tải…</span>
                ) : groups.length === 0 ? (
                  <span className="ws-muted">
                    Không có nhóm ca track {trackLabel}. Liên hệ GĐ cấu hình.
                  </span>
                ) : (
                  <Selector
                    label="Nhóm ca"
                    placeholder="Chọn nhóm ca của track bạn"
                    options={groupOptions}
                    value={groupId}
                    onChange={(v) => {
                      setGroupId(v);
                      setSelected(new Set());
                    }}
                    hasClear={false}
                  />
                )}
              </FieldRow>
              <FieldRow label="Số ca đã chọn">
                <span>{entries.length}</span>
              </FieldRow>
            </div>
            <div>
              <FieldRow label="Nhân sự">
                <span className="ws-linkish">{roleLabel}</span>
              </FieldRow>
              <FieldRow label="Track ca">
                <span>
                  {trackLabel}{' '}
                  <span className="ws-muted">(tự gán theo role — server kiểm tra)</span>
                </span>
              </FieldRow>
              <FieldRow label="Người duyệt">
                <span className="ws-muted">
                  {track === 'GIAO_VIEN' ? 'GĐĐT (giam_doc_dao_tao)' : 'GĐKD (giam_doc_kinh_doanh)'}
                </span>
              </FieldRow>
              <FieldRow label="Tổng giờ dự kiến">
                <span>{totalHours.toFixed(2)}</span>
              </FieldRow>
            </div>
          </div>

          {templates.length > 0 ? (
            <div className="ws-legend">
              {templates.map((t) => (
                <div key={t.id}>
                  <strong>{t.name}</strong>: {t.startTime} – {t.endTime} (
                  {templateHours(t).toFixed(1)}h)
                </div>
              ))}
            </div>
          ) : null}

          <div className="ws-hint">
            <strong>Nghiệp vụ CMC:</strong>{' '}
            {track === 'GIAO_VIEN' ? (
              <>
                Giáo viên — nhóm <strong>MULTIPLE</strong>: mỗi ngày có thể đăng ký nhiều buổi (Ca
                1/2/3). Ticket-lock: chỉ 1 phiếu <em>Chờ duyệt</em> tại một thời điểm. Gửi xong GĐĐT
                duyệt/từ chối.
              </>
            ) : (
              <>
                Kinh doanh (sale/cskh/…) — nhóm <strong>SINGLE</strong>: mỗi ngày chỉ 1 ca trong 3
                mẫu. Ticket-lock: 1 phiếu chờ duyệt. Gửi xong GĐKD duyệt/từ chối.
              </>
            )}{' '}
            Bấm <strong>Chờ duyệt</strong> trên thanh trạng thái (hoặc Gửi đăng ký) khi lưới đã đủ.
            fromDate phải <strong>sau hôm nay (ICT)</strong>.
          </div>

          <div className="ws-notebook">
            <div className="ws-notebook-tabs">
              <div className="ws-notebook-tab">Đăng ký lịch làm việc</div>
            </div>
            <div className="ws-notebook-body">
              {!selectedGroup ? (
                <div style={{ padding: 'var(--cmc-space-3)' }}>
                  <EmptyState
                    title="Chọn nhóm ca"
                    description={`Chỉ hiện nhóm track ${trackLabel} khớp role của bạn.`}
                  />
                </div>
              ) : dates.length === 0 ? (
                <div style={{ padding: 'var(--cmc-space-3)' }}>
                  <EmptyState
                    title="Chọn Từ ngày / Tới ngày"
                    description="Khoảng ngày tương lai (ICT) tạo các hàng trên lưới 3 ca."
                  />
                </div>
              ) : templates.length === 0 ? (
                <div style={{ padding: 'var(--cmc-space-3)' }}>
                  <EmptyState title="Nhóm chưa có mẫu ca" description="GĐ cấu hình tại Ca làm việc." />
                </div>
              ) : (
                <>
                  <table className="ws-matrix">
                    <thead>
                      <tr>
                        <th>Ngày</th>
                        {templates.map((t) => (
                          <Fragment key={t.id}>
                            <th>
                              {t.name}
                              <div style={{ fontWeight: 400, fontSize: 'var(--cmc-font-size-column)', opacity: 0.75 }}>
                                {t.startTime}–{t.endTime}
                              </div>
                            </th>
                            <th className="ws-hours">Giờ</th>
                          </Fragment>
                        ))}
                        <th className="ws-hours">Tổng giờ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dates.map((d) => {
                        let rowH = 0;
                        for (const t of templates) {
                          if (selected.has(entryKey(d, t.id))) rowH += templateHours(t);
                        }
                        return (
                          <tr key={d}>
                            <td>{formatDayLabel(d)}</td>
                            {templates.map((t) => {
                              const on = selected.has(entryKey(d, t.id));
                              return (
                                <Fragment key={t.id}>
                                  <td className="ws-check">
                                    <label>
                                      <input
                                        type="checkbox"
                                        checked={on}
                                        onChange={() => toggleCell(d, t.id)}
                                        aria-label={`${d} ${t.name}`}
                                      />
                                      Đi làm
                                    </label>
                                  </td>
                                  <td className="ws-hours">
                                    {on ? templateHours(t).toFixed(2) : '0.00'}
                                  </td>
                                </Fragment>
                              );
                            })}
                            <td className="ws-hours">{rowH.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="ws-footer">
                    <span>Tổng ca làm việc: {entries.length}</span>
                    <span>Tổng giờ: {totalHours.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <aside className="ws-chatter" aria-label="Ghi chú phiếu">
          <div className="ws-chatter-head">Nhật ký · quy trình</div>
          <div className="ws-chatter-item">
            <div className="meta">CMC · WF-P3-03</div>
            <div className="who">Vòng đời phiếu ca</div>
            <div>
              <strong>Soạn</strong> (client) → <strong>Chờ duyệt</strong> (submitted) →{' '}
              <strong>Đã duyệt</strong> | <strong>Từ chối</strong> | <strong>Đã hủy</strong>. Không
              có bước CONFIRMED (đó là KPI).
            </div>
          </div>
          <div className="ws-chatter-item">
            <div className="meta">Thao tác thanh trạng thái</div>
            <div className="who">Bấm được</div>
            <div>
              · <strong>Soạn</strong>: xóa lựa chọn, soạn lại
              <br />· <strong>Chờ duyệt</strong>: gửi phiếu nếu hợp lệ (cùng Gửi đăng ký)
              <br />· <strong>Đã duyệt</strong>: chỉ GĐ trên form (mở từ Hàng chờ)
            </div>
          </div>
          {result?.ok ? (
            <div className="ws-chatter-item">
              <div className="meta">vừa xong</div>
              <div className="who">Stage: Soạn → Chờ duyệt</div>
              <div>Đã gọi shift.submit. Xem tab «Đăng ký của tôi».</div>
            </div>
          ) : null}
        </aside>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// My registrations
// ---------------------------------------------------------------------------

interface MyRegRow {
  id: string;
  fromDate: string | Date;
  toDate: string | Date;
  status: string;
  rejectReason: string | null;
  entries: RegEntry[];
  shiftGroupId?: string;
  [key: string]: unknown;
}

function MyRegistrationsTab({ onCompose }: { onCompose?: () => void }) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.shift.myRegistrations.useQuery();
  const { data: groupsData } = trpc.shift.listGroups.useQuery();
  const groups: ShiftGroupOption[] = (groupsData as ShiftGroupOption[] | undefined) ?? [];
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const cancelMut = trpc.shift.cancel.useMutation({
    onSuccess() {
      setResult({ ok: true, text: 'Đã hủy đăng ký ca.' });
      setCancelTarget(null);
      void utils.shift.myRegistrations.invalidate();
    },
    onError(err) {
      setResult({ ok: false, text: err.message ?? 'Lỗi không xác định.' });
      setCancelTarget(null);
    },
  });

  const rows: MyRegRow[] = (data as MyRegRow[] | undefined) ?? [];
  void groups; // groups reserved if we show group name column later

  if (!isLoading && !error && rows.length === 0) {
    return (
      <EmptyState
        title="Chưa có đăng ký ca"
        description="Soạn phiếu mới rồi gửi (Chờ duyệt)."
        action={
          onCompose ? (
            <Button label="Soạn phiếu mới" size="sm" variant="primary" onClick={onCompose} />
          ) : undefined
        }
      />
    );
  }

  const columns: TableColumn<MyRegRow>[] = [
    { key: 'fromDate', label: 'Từ ngày', render: fmtDate },
    { key: 'toDate', label: 'Đến ngày', render: fmtDate },
    {
      key: 'status',
      label: 'Trạng thái',
      width: 140,
      render: (v) => (
        <StatusBadge status={String(v)} label={REG_STATUS_LABELS[String(v)] ?? String(v)} />
      ),
    },
    {
      key: 'entries',
      label: 'Số ca',
      width: 90,
      render: (v) => (Array.isArray(v) ? v.length : 0),
    },
    {
      key: 'rejectReason',
      label: 'Lý do từ chối',
      render: (v) => (v ? String(v) : '—'),
    },
    {
      key: '_actions',
      label: '',
      width: 160,
      render: (_v, row) => (
        <HStack gap={1}>
          <Button
            label="Mở phiếu"
            size="sm"
            variant="ghost"
            onClick={() =>
              navigate(links.shiftRegistration(row.id), { state: { listScope: 'mine' as const } })
            }
          />
          {row.status === 'submitted' || row.status === 'approved' ? (
            <Button label="Hủy" size="sm" variant="ghost" onClick={() => setCancelTarget(row.id)} />
          ) : null}
        </HStack>
      ),
    },
  ];

  return (
    <Stack gap={2}>
      {result && <Banner status={result.ok ? 'success' : 'error'} title={result.text} />}
      <DataTable<MyRegRow>
        columns={columns}
        data={rows}
        loading={isLoading}
        error={error?.message}
        empty="Chưa có đăng ký ca."
        onRowClick={(row) =>
          navigate(links.shiftRegistration(row.id), { state: { listScope: 'mine' as const } })
        }
      />
      <ConfirmDialog
        opened={cancelTarget !== null}
        title="Hủy đăng ký ca"
        message="Hủy phiếu này? submitted|approved → cancelled (terminal)."
        confirmLabel="Hủy ca"
        confirmColor="red"
        loading={cancelMut.isPending}
        onConfirm={() => cancelTarget && cancelMut.mutate({ registrationId: cancelTarget })}
        onCancel={() => setCancelTarget(null)}
      />
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// GĐ approve inbox
// ---------------------------------------------------------------------------

interface PendingRow {
  id: string;
  fromDate: string | Date;
  toDate: string | Date;
  entries: RegEntry[];
  appUser: { fullName: string };
  shiftGroup: { name: string; type: string; id?: string };
  [key: string]: unknown;
}

function ApproveTab() {
  const navigate = useNavigate();
  const { data, isLoading, error } = trpc.shift.pendingForApproval.useQuery();
  const { data: groupsData } = trpc.shift.listGroups.useQuery();
  const groups: ShiftGroupOption[] = (groupsData as ShiftGroupOption[] | undefined) ?? [];
  const rows: PendingRow[] = (data as PendingRow[] | undefined) ?? [];
  const allTemplates = useMemo(() => groups.flatMap((g) => g.templates), [groups]);

  const columns: TableColumn<PendingRow>[] = [
    { key: 'appUser', label: 'Nhân viên', render: (_v, row) => row.appUser.fullName },
    {
      key: 'shiftGroup',
      label: 'Nhóm ca',
      render: (_v, row) => `${row.shiftGroup.name} (${groupTypeLabel(row.shiftGroup.type)})`,
    },
    { key: 'fromDate', label: 'Từ ngày', render: fmtDate },
    { key: 'toDate', label: 'Đến ngày', render: fmtDate },
    {
      key: 'entries',
      label: 'Ca',
      width: 200,
      render: (v) => {
        if (!Array.isArray(v) || v.length === 0) return '0';
        const chips = (v as RegEntry[]).slice(0, 3).map((e) => {
          const t = allTemplates.find((x) => x.id === e.shiftTemplateId);
          const d = entryDateStr(e.date);
          return t ? `${d.slice(5)} ${t.name}` : d.slice(5);
        });
        const more = v.length > 3 ? ` +${v.length - 3}` : '';
        return `${chips.join(' · ')}${more}`;
      },
    },
    {
      key: '_actions',
      label: '',
      width: 120,
      render: (_v, row) => (
        <Button
          label="Mở phiếu"
          size="sm"
          variant="primary"
          onClick={() =>
            navigate(links.shiftRegistration(row.id), { state: { listScope: 'inbox' as const } })
          }
        />
      ),
    },
  ];

  return (
    <DataTable<PendingRow>
      columns={columns}
      data={rows}
      loading={isLoading}
      error={error?.message}
      empty="Không có đăng ký chờ duyệt (chỉ phiếu submitted đúng track GĐ)."
      onRowClick={(row) =>
        navigate(links.shiftRegistration(row.id), { state: { listScope: 'inbox' as const } })
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ShiftsPage() {
  const { canDo, me } = useSession();
  const navigate = useNavigate();
  const canApprove = canDo('shift', 'approve');
  const [searchParams, setSearchParams] = useSearchParams();
  const scope = searchParams.get('scope');
  const defaultTab = canApprove
    ? scope === 'mine'
      ? 'my'
      : 'approve'
    : 'my';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const pendingQ = trpc.shift.pendingForApproval.useQuery(undefined, { enabled: canApprove });
  const pendingCount = (pendingQ.data as unknown[] | undefined)?.length ?? 0;
  const track = resolveShiftTrack(me?.roles ?? []);

  function onTabChange(id: string) {
    setActiveTab(id);
    if (id === 'approve') setSearchParams({ scope: 'inbox' }, { replace: true });
    else if (id === 'my') setSearchParams({ scope: 'mine' }, { replace: true });
    else setSearchParams({}, { replace: true });
  }

  const tabs = [
    {
      id: 'my',
      label: 'Đăng ký của tôi',
      content: (
        <MyRegistrationsTab
          onCompose={() => {
            navigate(shiftRegistrationNewPath());
          }}
        />
      ),
    },
    ...(canApprove
      ? [{ id: 'approve', label: 'Hàng chờ', content: <ApproveTab /> }]
      : []),
  ];

  return (
    <ListPage
      density="ops"
      header={
        <PageHeader
          title="Work Schedule"
          subtitle={
            canApprove
              ? 'Danh sách phiếu · mở form để duyệt/từ chối (không duyệt trên list)'
              : `Track ${track === 'GIAO_VIEN' ? 'Giáo viên (MULTIPLE · 3 ca)' : 'Kinh doanh (SINGLE · 3 ca)'}`
          }
          breadcrumbs={[{ label: 'Nhân sự' }, { label: 'Work Schedule' }]}
          actions={
            <HStack gap={1} align="center">
              {canApprove && pendingCount > 0 ? (
                <>
                  <Text type="body" size="sm">
                    Chờ duyệt
                  </Text>
                  <CountBadge count={pendingCount} emphasize />
                </>
              ) : null}
              <Link to={shiftRegistrationNewPath()}>
                <Button label="Soạn phiếu mới" size="sm" variant="primary" />
              </Link>
            </HStack>
          }
        />
      }
    >
      <CmcTabs activeTab={activeTab} onTabChange={onTabChange} tabs={tabs} />
    </ListPage>
  );
}
