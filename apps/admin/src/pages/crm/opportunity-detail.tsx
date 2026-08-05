import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import {
  Badge,
  Banner,
  Button,
  DetailPage,
  EmptyState,
  EntityHeader,
  HighlightStrip,
  HStack,
  KeyValueList,
  LineIcon,
  PageHeader,
  SectionBlock,
  Selector,
  Spinner,
  Stack,
  StatActions,
  Text,
  WorkflowStatusbar,
} from '@cmc/ui';
import type { ComponentProps } from 'react';
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

const STAGE_LABELS: Record<string, string> = {
  O1_LEAD: 'Tiếp cận',
  O2_CONTACTED: 'Đã liên hệ',
  O3_TEST_SCHEDULED: 'Đặt lịch kiểm tra',
  O4_TESTED: 'Đã kiểm tra',
  O5_ENROLLED: 'Đã ghi danh',
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

export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
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

  const utils = trpc.useUtils();
  const advanceMutation = trpc.crm.opportunityAdvance.useMutation({
    onSuccess: () => void utils.crm.opportunityList.invalidate(),
  });
  const { markLostMutation, assignMutation } = useOpportunityActions();
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
    advanceMutation.error?.message ??
    (!markLostOpen ? markLostMutation.error?.message : undefined) ??
    completeMutation.error?.message ??
    noShowMutation.error?.message;

  const entityActions = (
    <HStack gap={2} style={{ flexWrap: 'wrap' }}>
      {isLost && (
        <Button
          label="Mở lại cơ hội"
          variant="secondary"
          size="sm"
          isLoading={markLostMutation.isPending}
          onClick={() => markLostMutation.mutate({ opportunityId: opp.id, reopen: true })}
        />
      )}
      {!isLost && nextStage && (
        <Button
          label="Chuyển lên"
          variant="secondary"
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
          variant="secondary"
          size="sm"
          onClick={() => setScheduleTestOpen(true)}
        />
      )}
      {opp.stage === 'O4_TESTED' && !isLost && (
        <Button
          label="Tạo phiếu thu"
          variant="primary"
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
              <Badge
                label={isLost ? 'Lost' : stageLabel}
                variant={isLost ? 'error' : stageVariant}
                style={
                  !isLost && opp.stage !== 'O5_ENROLLED'
                    ? { background: 'var(--cmc-brand)', color: '#fff' }
                    : undefined
                }
              />
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
          <div className="o-detail-stack">
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
            <WorkflowStatusbar
              steps={(
                [
                  'O1_LEAD',
                  'O2_CONTACTED',
                  'O3_TEST_SCHEDULED',
                  'O4_TESTED',
                  'O5_ENROLLED',
                ] as const
              ).map((s) => ({ id: s, label: STAGE_LABELS[s] ?? s }))}
              activeIndex={Math.max(
                0,
                (
                  [
                    'O1_LEAD',
                    'O2_CONTACTED',
                    'O3_TEST_SCHEDULED',
                    'O4_TESTED',
                    'O5_ENROLLED',
                  ] as const
                ).indexOf(opp.stage as 'O1_LEAD'),
              )}
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
      >
        <div className="o-detail-stack">
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

          <div className="o-detail-split">
            <div className="o-detail-stack">
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
                          fontSize: 13,
                          color: 'var(--cmc-danger)',
                          display: 'block',
                          marginTop: 8,
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
                  <div className="ck-empty">Chưa có lịch test</div>
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

            <SectionBlock title="Timeline" description="Tiến độ qua các giai đoạn cơ hội.">
              <Stack gap={0}>
                {(
                  [
                    'O1_LEAD',
                    'O2_CONTACTED',
                    'O3_TEST_SCHEDULED',
                    'O4_TESTED',
                    'O5_ENROLLED',
                  ] as const
                ).map((stage, idx, arr) => {
                  const stageOrder = arr.indexOf(opp.stage as (typeof arr)[number]);
                  const done = idx <= stageOrder;
                  const isCurrent = opp.stage === stage;
                  const stepColor = isCurrent
                    ? 'var(--cmc-brand)'
                    : done
                      ? 'var(--cmc-text)'
                      : 'var(--cmc-text-muted)';
                  return (
                    <HStack
                      key={stage}
                      gap={3}
                      style={{
                        paddingBlock: 'var(--cmc-space-2)',
                        borderBottom:
                          idx < arr.length - 1 ? '1px solid var(--cmc-border)' : undefined,
                        background: isCurrent ? 'var(--cmc-brand-muted)' : undefined,
                        borderRadius: isCurrent ? 'var(--cmc-radius-control)' : undefined,
                        paddingInline: isCurrent ? 'var(--cmc-space-2)' : undefined,
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          flexShrink: 0,
                          background: done
                            ? isCurrent
                              ? 'var(--cmc-brand)'
                              : 'var(--cmc-success)'
                            : 'var(--cmc-border)',
                        }}
                      />
                      <span
                        style={{ fontSize: 14, fontWeight: isCurrent ? 600 : 400, color: stepColor }}
                      >
                        {STAGE_LABELS[stage]}
                      </span>
                    </HStack>
                  );
                })}
                {isLost && (
                  <HStack gap={3} style={{ paddingBlock: 'var(--cmc-space-2)' }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--cmc-danger)',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cmc-danger)' }}>
                      Đã đóng (Lost)
                    </span>
                  </HStack>
                )}
              </Stack>
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
