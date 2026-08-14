import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Badge,
  Banner,
  Button,
  DateField,
  DetailPage,
  EmptyState,
  EntityHeader,
  HighlightStrip,
  HStack,
  KeyValueList,
  LineIcon,
  PageHeader,
  RecordTimeline,
  SectionBlock,
  Selector,
  Spinner,
  Stack,
  StatActions,
  Text,
  TextInput,
  WorkflowStatusbar,
  dueLevelClassName,
} from '@cmc/ui';
import type { RecordTimelineItem } from '@cmc/ui';
import type { ComponentProps } from 'react';
import { classifyDueLevel } from '@cmc/domain-time';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';
import { CopyLinkButton } from '../../lib/copy-link-button.js';
import { formatContactPhone } from '../../lib/format-contact-phone.js';
import { LOST_REASON_LABELS, MarkLostDialog } from './mark-lost-dialog.js';
import { SOURCE_LABELS } from './create-lead-dialog.js';
import { useOpportunityActions } from './use-opportunity-actions.js';
import { useTestAppointmentActions } from './use-test-appointment-actions.js';
import { ScheduleTestDialog } from './schedule-test-dialog.js';

// Sentinel Selector value for "unassign" — the manager owner-select's
// non-clearable Selector (@astryxdesign/core) only carries `string`, so
// `null` (unassign) is represented as this empty string and translated back
// to `null` before calling `opportunityAssign`.
const UNASSIGNED_VALUE = '';

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

const APPT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Đã đặt lịch',
  done: 'Hoàn thành',
  no_show: 'Vắng mặt',
};

const APPT_STATUS_VARIANT: Record<string, BadgeVariant> = {
  scheduled: 'blue',
  done: 'success',
  no_show: 'error',
};

function fmtAppointmentTime(v: string): string {
  return new Date(v).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STAGE_IDS = [
  'O1_LEAD',
  'O2_CONTACTED',
  'O3_TEST_SCHEDULED',
  'O4_TESTED',
  'O5_ENROLLED',
] as const;

const STAGE_LABELS: Record<string, string> = {
  O1_LEAD: 'Tiếp cận',
  O2_CONTACTED: 'Đã liên hệ',
  O3_TEST_SCHEDULED: 'Đặt lịch kiểm tra',
  O4_TESTED: 'Đã kiểm tra',
  O5_ENROLLED: 'Đã ghi danh',
};

const INVALID_STAGE_TRANSITION_PREFIX = 'Invalid stage transition';
const ADVANCE_STALE_MESSAGE =
  'Không thể chuyển giai đoạn — dữ liệu đã đổi, đang tải lại.';

function mapAdvanceErrorMessage(message: string): string {
  if (message.includes(INVALID_STAGE_TRANSITION_PREFIX)) return ADVANCE_STALE_MESSAGE;
  return message;
}

type TimelinePage = {
  items: RecordTimelineItem[];
  nextCursor: string | null;
  historySince: Date | string | null;
};

/** tRPC `.fetch` on this procedure trips TS2589; keep the cast at the helper. */
type TimelineQueryUtils = {
  fetch: (input: { opportunityId: string; cursor: string }) => Promise<TimelinePage>;
};

// Astryx Badge has no 'indigo' variant — approximated onto 'purple' (closest
// hue in the fixed palette), matching the same class of approximation
// already accepted for ConfirmDialog's color mapping.
const STAGE_COLOR: Record<string, BadgeVariant> = {
  O1_LEAD: 'neutral',
  O2_CONTACTED: 'blue',
  O3_TEST_SCHEDULED: 'purple',
  O4_TESTED: 'purple',
  O5_ENROLLED: 'success',
};

// One stage at a time via opportunityAdvance — O5 is reached only through
// finance.receiptApprove (same rule as pipeline.tsx's STAGES.next).
const ADVANCE_NEXT: Record<string, 'O2_CONTACTED' | 'O3_TEST_SCHEDULED' | 'O4_TESTED' | undefined> = {
  O1_LEAD: 'O2_CONTACTED',
  O2_CONTACTED: 'O3_TEST_SCHEDULED',
  O3_TEST_SCHEDULED: 'O4_TESTED',
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

function toIctEndIso(dateText: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return undefined;
  const d = new Date(`${dateText}T23:59:59.999+07:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [nextNote, setNextNote] = useState('');
  const [nextDate, setNextDate] = useState('');
  const navigate = useNavigate();
  const [markLostOpen, setMarkLostOpen] = useState(false);
  const [scheduleTestOpen, setScheduleTestOpen] = useState(false);

  // Fetch by id so valid opportunities never disappear merely because they
  // fall beyond the first page of the pipeline list.
  const { data: opp, isLoading, error } = trpc.crm.opportunityGet.useQuery(
    { opportunityId: id ?? '' },
    { enabled: Boolean(id) },
  );

  // Hooks must run unconditionally (before the isLoading/error/!opp early
  // returns below), so this is keyed off the route param `id` directly
  // rather than the `opp` object derived from `data` further down.
  const { data: appointments } = trpc.testAppointment.forOpportunity.useQuery(
    { opportunityId: id ?? '' },
    { enabled: Boolean(id) },
  );

  const {
    data: timeline,
    isFetching: timelineFetching,
    dataUpdatedAt: timelineUpdatedAt,
  } = trpc.crm.opportunityTimeline.useQuery(
    { opportunityId: id ?? '' },
    { enabled: Boolean(id) },
  );

  const utils = trpc.useUtils();
  // Intentionally not in useOpportunityActions: pipeline.tsx wires this
  // procedure with search-aware optimistic updates. The detail page only
  // needs a full list + Get refetch so the statusbar moves immediately.
  const advanceMutation = trpc.crm.opportunityAdvance.useMutation({
    onSuccess: () => {
      void utils.crm.opportunityList.invalidate();
      void utils.crm.opportunityGet.invalidate();
      void utils.crm.opportunityTimeline.invalidate();
    },
    onError: () => {
      void utils.crm.opportunityGet.invalidate();
    },
  });
  const addNoteMutation = trpc.crm.opportunityAddNote.useMutation({
    onSuccess: () => {
      void utils.crm.opportunityTimeline.invalidate();
    },
  });
  const [moreItems, setMoreItems] = useState<RecordTimelineItem[]>([]);
  const [moreNextCursor, setMoreNextCursor] = useState<string | null>(null);

  useEffect(() => {
    setMoreItems([]);
    setMoreNextCursor(null);
    // `timelineUpdatedAt` changes when the first page refetches after
    // invalidate (add-note / advance / mark-lost / assign). Do not depend on
    // the `timeline` object: jsdom mocks return a new object every render.
  }, [id, timelineUpdatedAt]);
  const {
    markLostMutation,
    assignMutation,
    setNextActionMutation,
    clearNextActionMutation,
  } = useOpportunityActions();
  const { completeMutation, noShowMutation } = useTestAppointmentActions();

  // phase-10: owner assign control. `me` gates the two mutually-exclusive
  // UIs (manager owner-select vs sale claim button) — role gate mirrors
  // `opportunityAssign`'s row-level rule server-side (source of truth).
  const { me } = useSession();
  const isManager = me?.roles.includes('giam_doc_kinh_doanh') ?? false;
  // Query is cheap and permission-gated server-side (same key as
  // opportunityAssign) — `enabled: isManager` just avoids the unnecessary
  // fetch for a sale, who only ever needs their own userId.
  const { data: assignableStaff } = trpc.crm.assignableStaff.useQuery(undefined, {
    enabled: isManager,
  });
  const ownerSelectOptions = [
    { value: UNASSIGNED_VALUE, label: '— Chưa giao —' },
    ...(assignableStaff ?? []).map((s) => ({ value: s.userId, label: s.fullName })),
  ];

  if (isLoading) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Kinh doanh', href: '/crm' },
              { label: 'Pipeline CRM', href: '/crm' },
              { label: '…' },
            ]}
          />
        }
      >
        <Stack hAlign="center" gap={2} style={{ paddingBlock: 'var(--cmc-space-4)' }}>
          <Spinner size="md" />
          <Text type="supporting" size="sm">
            Đang tải thông tin cơ hội...
          </Text>
        </Stack>
      </DetailPage>
    );
  }

  if (error) {
    const code = (error.data as { code?: unknown } | null | undefined)?.code;
    const isForbidden = code === 'FORBIDDEN';
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Kinh doanh', href: '/crm' },
              { label: 'Pipeline CRM', href: '/crm' },
              { label: isForbidden ? 'Không có quyền' : 'Lỗi' },
            ]}
          />
        }
      >
        {isForbidden ? (
          <EmptyState
            title="Không có quyền truy cập"
            description="Bạn không có quyền xem cơ hội này (crm.opportunityList)."
            icon={<LineIcon name="shield" size={28} />}
          />
        ) : (
          <Banner status="error" title="Lỗi tải dữ liệu" description={error.message} />
        )}
      </DetailPage>
    );
  }

  if (!opp) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Kinh doanh', href: '/crm' },
              { label: 'Pipeline CRM', href: '/crm' },
              { label: 'Không tìm thấy' },
            ]}
          />
        }
      >
        <Banner
          status="warning"
          title="Không tìm thấy cơ hội"
          description="Cơ hội không tồn tại hoặc bạn không có quyền truy cập."
        />
      </DetailPage>
    );
  }

  // A won (O5) opportunity also carries a `closedAt` (the enrollment instant)
  // — only a closedAt WITHOUT O5 is a genuine loss (matches the backend's
  // `isOpportunityLost`/`LOST_WHERE` fragment in apps/api/src/crm/router.ts).
  const isLost = Boolean(opp.closedAt) && opp.stage !== 'O5_ENROLLED';
  const firstPage = timeline as
    | {
        items: RecordTimelineItem[];
        nextCursor: string | null;
        historySince: Date | string | null;
      }
    | undefined;
  const timelineItems = [...(firstPage?.items ?? []), ...moreItems];
  const timelineNextCursor =
    moreItems.length > 0 ? moreNextCursor : (firstPage?.nextCursor ?? null);
  const historySince = firstPage?.historySince
    ? new Date(firstPage.historySince)
    : null;
  const stageLabel = STAGE_LABELS[opp.stage] ?? opp.stage;
  const stageVariant = STAGE_COLOR[opp.stage] ?? 'blue';
  const nextStage = ADVANCE_NEXT[opp.stage];
  const canMarkLost = !isLost && opp.stage !== 'O5_ENROLLED';
  // testAppointment.schedule (apps/api/src/appointment/router.ts) only
  // accepts an opp at O2_CONTACTED or O3_TEST_SCHEDULED, and rejects a
  // lost opp — mirrored here so the action only appears when it would succeed.
  const canScheduleTest =
    !isLost && (opp.stage === 'O2_CONTACTED' || opp.stage === 'O3_TEST_SCHEDULED');

  // advance/reopen/complete/no-show all fire straight off this page's action
  // bar (no confirm dialog of their own to surface an error), so none of
  // them had anywhere to show a failure before this — first error wins.
  // `markLostMutation` is shared with MarkLostDialog's "mark lost" flow,
  // which already renders its own error inline while open; only surface it
  // here for the "Mở lại cơ hội" (reopen) call, i.e. while that dialog is
  // closed, so a failure isn't shown twice at once.
  const actionError =
    (advanceMutation.error?.message
      ? mapAdvanceErrorMessage(advanceMutation.error.message)
      : undefined) ??
    (!markLostOpen ? markLostMutation.error?.message : undefined) ??
    completeMutation.error?.message ??
    noShowMutation.error?.message;

  const statusbarActiveIndex = Math.max(
    0,
    STAGE_IDS.indexOf(opp.stage as (typeof STAGE_IDS)[number]),
  );
  // UX-only copy of opportunityAdvance ownership (server enforces).
  // Server compares AppUser.id; the client only has assignedTo.userId and
  // me.userId (apps/admin/src/lib/session-context.tsx).
  const canAdvanceOwnedRow =
    isManager || !opp.assignedTo || opp.assignedTo.userId === me?.userId;
  const canStatusbarStepClick = (i: number): boolean => {
    const adjacentNext = ADVANCE_NEXT[opp.stage];
    return (
      !isLost &&
      !advanceMutation.isPending &&
      adjacentNext !== undefined &&
      i === statusbarActiveIndex + 1 &&
      STAGE_IDS[i] === adjacentNext &&
      canAdvanceOwnedRow
    );
  };
  const onStatusbarStepClick = (i: number) => {
    if (!canStatusbarStepClick(i)) return;
    const toStage = ADVANCE_NEXT[opp.stage];
    if (!toStage) return;
    advanceMutation.mutate({ opportunityId: opp.id, toStage });
  };

  // One prominent CTA per stage (phase 1). Visibility of each action is
  // unchanged (canMarkLost / canScheduleTest / O4 receipt / lost reopen).
  const showAdvance = !isLost && Boolean(nextStage) && canAdvanceOwnedRow;
  const primaryAction = isLost
    ? 'reopen'
    : opp.stage === 'O4_TESTED'
      ? 'receipt'
      : canScheduleTest
        ? 'schedule'
        : showAdvance
          ? 'advance'
          : null;

  const entityActions = (
    <HStack gap={2} style={{ flexWrap: 'wrap' }}>
      {isLost && (
        <Button
          label="Mở lại cơ hội"
          variant={primaryAction === 'reopen' ? 'primary' : 'secondary'}
          size="sm"
          isLoading={markLostMutation.isPending}
          onClick={() => markLostMutation.mutate({ opportunityId: opp.id, reopen: true })}
        />
      )}
      {showAdvance && nextStage && (
        <Button
          label="Chuyển lên"
          variant={primaryAction === 'advance' ? 'primary' : 'secondary'}
          size="sm"
          endContent={<LineIcon name="chevron" size={12} />}
          isLoading={advanceMutation.isPending}
          onClick={() => advanceMutation.mutate({ opportunityId: opp.id, toStage: nextStage })}
        />
      )}
      {canMarkLost && (
        <Button
          label="Đánh dấu mất"
          variant="secondary"
          size="sm"
          onClick={() => setMarkLostOpen(true)}
        />
      )}
      {canScheduleTest && (
        <Button
          label="Đặt lịch test"
          variant={primaryAction === 'schedule' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setScheduleTestOpen(true)}
        />
      )}
      {opp.stage === 'O4_TESTED' && !isLost && (
        <Button
          label="Tạo phiếu thu"
          variant={primaryAction === 'receipt' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => void navigate(`/finance/new?opportunityId=${opp.id}`)}
        />
      )}
      <Button
        label="← Pipeline"
        variant="secondary"
        size="sm"
        onClick={() => void navigate('/crm')}
      />
    </HStack>
  );

  return (
    <>
      <DetailPage
        density="ops"
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Kinh doanh', href: '/crm' },
              { label: 'Pipeline CRM', href: '/crm' },
              { label: opp.contact.name },
            ]}
            actions={id ? <CopyLinkButton mode="go" entity="opportunity" id={id} /> : undefined}
          />
        }
        entity={
          <EntityHeader
            title={opp.contact.name}
            subtitle={formatContactPhone(opp.contact.phone)}
            initials={initialsFromName(opp.contact.name)}
            badges={
              <>
                <Badge
                  label={isLost ? 'Lost' : stageLabel}
                  variant={isLost ? 'error' : stageVariant}
                  style={
                    !isLost && opp.stage !== 'O5_ENROLLED'
                      ? { background: 'var(--cmc-brand)', color: 'var(--cmc-surface)' }
                      : undefined
                  }
                />
                {!isLost && opp.isRotting ? (
                  <span data-testid="crm-rotting-badge">
                    <Badge
                      label={`Nguội ${opp.rottingDays ?? 0} ngày`}
                      variant="warning"
                    />
                  </span>
                ) : null}
              </>
            }
            meta={
              <span>
                Giai đoạn · {isLost ? 'Lost' : stageLabel}
                {opp.assignedTo?.fullName ? ` · ${opp.assignedTo.fullName}` : ''}
              </span>
            }
            actions={entityActions}
          />
        }
        summary={
          <div className="console-detail-stack">
            <HighlightStrip
              items={[
                { key: 'phone', label: 'SĐT', value: formatContactPhone(opp.contact.phone) },
                {
                  key: 'stage',
                  label: 'Giai đoạn',
                  value: isLost ? 'Lost' : stageLabel,
                },
                {
                  key: 'owner',
                  label: 'Phụ trách',
                  value: opp.assignedTo?.fullName ?? 'Chưa giao',
                },
                {
                  key: 'source',
                  label: 'Nguồn',
                  value: opp.source ? SOURCE_LABELS[opp.source] ?? opp.source : '—',
                },
              ]}
            />
            <StatActions
              items={[
                { key: 'pipeline', label: 'Pipeline', href: '/crm' },
                ...(opp.stage === 'O4_TESTED' && !isLost
                  ? [
                      {
                        key: 'receipt',
                        label: 'Tạo phiếu thu',
                        href: `/finance/new?opportunityId=${opp.id}`,
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        }
        statusbar={
          <WorkflowStatusbar
            steps={STAGE_IDS.map((s) => ({ id: s, label: STAGE_LABELS[s] ?? s }))}
            activeIndex={statusbarActiveIndex}
            onStepClick={onStatusbarStepClick}
            canStepClick={canStatusbarStepClick}
          />
        }
      >
        <div className="console-detail-stack">
          {actionError && (
            <Banner status="error" title="Thao tác thất bại" description={actionError} />
          )}

          {isLost && (
            <Banner
              status="error"
              title="Cơ hội đã đóng (Lost)"
              description={
                opp.lostReason
                  ? `Lý do: ${LOST_REASON_LABELS[opp.lostReason] ?? opp.lostReason}`
                  : 'Không có lý do cụ thể'
              }
            />
          )}

          <div className="console-detail-split console-detail-split--timeline">
            <div className="console-detail-stack">
              <SectionBlock
                title="Việc cần làm tiếp theo"
                description="Nhắc việc trong app (không gửi email). Đến hạn hiện ở màn đầu ca."
              >
                <div data-testid="crm-next-action">
                  {opp.nextActionAt ? (
                    <Stack gap={2}>
                      <Text size="sm">
                        Hẹn:{' '}
                        <strong
                          className={dueLevelClassName(
                            classifyDueLevel(new Date(opp.nextActionAt), new Date()),
                          )}
                        >
                          {new Date(opp.nextActionAt).toLocaleDateString('vi-VN', {
                            timeZone: 'Asia/Ho_Chi_Minh',
                          })}
                        </strong>
                      </Text>
                      <Text size="sm" type="supporting">
                        {opp.nextActionNote ?? '—'}
                      </Text>
                      {!isLost && opp.stage !== 'O5_ENROLLED' && (
                        <Button
                          label="Đánh dấu xong"
                          size="sm"
                          variant="secondary"
                          isLoading={clearNextActionMutation.isPending}
                          onClick={() =>
                            clearNextActionMutation.mutate({ opportunityId: opp.id })
                          }
                        />
                      )}
                    </Stack>
                  ) : !isLost && opp.stage !== 'O5_ENROLLED' ? (
                    <Stack gap={2}>
                      <DateField
                        label="Ngày hẹn"
                        value={nextDate}
                        onChange={setNextDate}
                      />
                      <TextInput
                        label="Việc cần làm"
                        value={nextNote}
                        onChange={setNextNote}
                        placeholder="VD: Gọi lại xác nhận lịch kiểm tra"
                      />
                      <Button
                        label="Lưu việc tiếp theo"
                        size="sm"
                        variant="primary"
                        isDisabled={!nextDate || !nextNote.trim()}
                        isLoading={setNextActionMutation.isPending}
                        onClick={() => {
                          const iso = toIctEndIso(nextDate);
                          if (!iso) return;
                          setNextActionMutation.mutate(
                            {
                              opportunityId: opp.id,
                              nextActionAt: iso,
                              nextActionNote: nextNote.trim(),
                            },
                            {
                              onSuccess: () => {
                                setNextNote('');
                                setNextDate('');
                              },
                            },
                          );
                        }}
                      />
                      {setNextActionMutation.error && (
                        <span style={{ fontSize: 'var(--cmc-font-size-data)', color: 'var(--cmc-danger)' }}>
                          {setNextActionMutation.error.message}
                        </span>
                      )}
                    </Stack>
                  ) : (
                    <Text type="supporting" size="sm">
                      Không đặt việc trên cơ hội đã đóng.
                    </Text>
                  )}
                </div>
              </SectionBlock>

              <SectionBlock title="Phụ trách & nguồn" description="Giao việc và kênh lead.">
                <KeyValueList
                  items={[
                    {
                      key: 'owner',
                      label: 'Chủ sở hữu',
                      value: opp.assignedTo?.fullName ?? 'Chưa giao',
                    },
                    {
                      key: 'source',
                      label: 'Nguồn',
                      value: opp.source ? SOURCE_LABELS[opp.source] ?? opp.source : '—',
                    },
                  ]}
                />
                {me && (
                  <div style={{ marginTop: 12 }}>
                    {isManager ? (
                      <div style={{ maxWidth: 260 }}>
                        <Selector
                          label="Giao cho"
                          options={ownerSelectOptions}
                          value={opp.assignedTo?.userId ?? UNASSIGNED_VALUE}
                          onChange={(v) =>
                            assignMutation.mutate({
                              opportunityId: opp.id,
                              assigneeUserId: v === UNASSIGNED_VALUE ? null : v,
                            })
                          }
                          size="sm"
                        />
                      </div>
                    ) : (
                      (!opp.assignedTo || opp.assignedTo.userId === me.userId) && (
                        <Button
                          label="Nhận cơ hội"
                          size="sm"
                          variant="secondary"
                          isLoading={assignMutation.isPending}
                          onClick={() =>
                            assignMutation.mutate({
                              opportunityId: opp.id,
                              assigneeUserId: me.userId,
                            })
                          }
                        />
                      )
                    )}
                    {assignMutation.error && (
                      // TODO(astryx-review): Text color enum has no error/danger slot —
                      // plain <span> with CSS var per migration flag rule (see users.tsx).
                      <span
                        style={{
                          fontSize: 'var(--cmc-font-size-data)',
                          color: 'var(--cmc-danger)',
                          display: 'block',
                          marginTop: 'var(--cmc-space-2)',
                        }}
                      >
                        {assignMutation.error.message}
                      </span>
                    )}
                  </div>
                )}
              </SectionBlock>

              <SectionBlock title="Thông tin liên hệ">
                <KeyValueList
                  items={[
                    {
                      key: 'name',
                      label: 'Họ tên',
                      value: opp.contact.name,
                    },
                    {
                      key: 'phone',
                      label: 'Số điện thoại',
                      value: formatContactPhone(opp.contact.phone),
                    },
                  ]}
                />
              </SectionBlock>

              <SectionBlock title="Lịch test đầu vào">
                {!appointments || appointments.length === 0 ? (
                  <div className="console-empty">Chưa có lịch test</div>
                ) : (
                  <Stack gap={0}>
                    {appointments.map((appt, idx) => (
                      <HStack
                        key={appt.id}
                        justify="between"
                        align="center"
                        style={{
                          flexWrap: 'wrap',
                          paddingBlock: 'var(--cmc-space-2)',
                          borderBottom:
                            idx < appointments.length - 1
                              ? '1px solid var(--cmc-border)'
                              : undefined,
                        }}
                      >
                        <Stack gap={0.5}>
                          <Text size="sm">{fmtAppointmentTime(appt.scheduledAt)}</Text>
                          <Badge
                            label={APPT_STATUS_LABELS[appt.status] ?? appt.status}
                            variant={APPT_STATUS_VARIANT[appt.status] ?? 'neutral'}
                          />
                        </Stack>
                        {appt.status === 'scheduled' && (
                          <HStack gap={1}>
                            <Button
                              label="Hoàn thành"
                              size="sm"
                              variant="secondary"
                              isLoading={completeMutation.isPending}
                              onClick={() => completeMutation.mutate({ appointmentId: appt.id })}
                            />
                            <Button
                              label="Vắng mặt"
                              size="sm"
                              variant="ghost"
                              isLoading={noShowMutation.isPending}
                              onClick={() => noShowMutation.mutate({ appointmentId: appt.id })}
                            />
                          </HStack>
                        )}
                      </HStack>
                    ))}
                  </Stack>
                )}
              </SectionBlock>
            </div>

            <SectionBlock title="Dòng thời gian" description="Toàn bộ đời bản ghi — ghi chú không sửa được.">
              <RecordTimeline
                items={timelineItems}
                nextCursor={timelineNextCursor}
                pending={addNoteMutation.isPending || timelineFetching}
                historySince={historySince}
                onAddNote={(body) =>
                  addNoteMutation.mutate({ opportunityId: opp.id, body })
                }
                onLoadMore={() => {
                  if (!id || !timelineNextCursor) return;
                  void (utils.crm.opportunityTimeline as unknown as TimelineQueryUtils)
                    .fetch({ opportunityId: id, cursor: timelineNextCursor })
                    .then((page) => {
                      setMoreItems((prev) => [...prev, ...page.items]);
                      setMoreNextCursor(page.nextCursor);
                    });
                }}
              />
            </SectionBlock>
          </div>
        </div>
      </DetailPage>

      <MarkLostDialog
        opportunityId={markLostOpen ? opp.id : null}
        onClose={() => setMarkLostOpen(false)}
      />

      <ScheduleTestDialog
        opportunityId={scheduleTestOpen ? opp.id : null}
        onClose={() => setScheduleTestOpen(false)}
      />
    </>
  );
}
