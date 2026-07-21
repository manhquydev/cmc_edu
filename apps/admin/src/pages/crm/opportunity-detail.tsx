import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { Badge, Banner, Button, Grid, HStack, LineIcon, PageHeader, Selector, Spinner, Stack, Text } from '@cmc/ui';
import type { ComponentProps } from 'react';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';
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

export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [markLostOpen, setMarkLostOpen] = useState(false);
  const [scheduleTestOpen, setScheduleTestOpen] = useState(false);

  // No opportunityGet endpoint for a single lost opp lookup from the pipeline
  // (which hides lost opps by default) — query the full list WITH lost
  // opportunities included so a lost opp's detail page still resolves.
  // pageSize: 100 covers typical facility pipeline volume.
  const { data, isLoading, error } = trpc.crm.opportunityList.useQuery(
    { pageSize: 100, lost: 'include' },
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
      <Stack hAlign="center" gap={2} style={{ paddingBlock: 64 }}>
        <Spinner size="md" />
        <Text type="supporting" size="sm">
          Đang tải thông tin cơ hội...
        </Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <Banner status="error" title="Lỗi tải dữ liệu" description={error.message} />
      </div>
    );
  }

  const opp = data?.items.find((item) => item.id === id);

  if (!opp) {
    return (
      <div style={{ padding: 16 }}>
        <Banner status="warning" title="Không tìm thấy cơ hội" description="Cơ hội không tồn tại hoặc bạn không có quyền truy cập." />
      </div>
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

  return (
    <>
      <PageHeader
        title={opp.contact.name}
        subtitle={`Cơ hội — ${stageLabel}`}
        breadcrumbs={[
          { label: 'Kinh doanh' },
          { label: 'Pipeline CRM', href: '/crm' },
          { label: opp.contact.name },
        ]}
        actions={
          <HStack gap={2}>
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
        }
      />

      <MarkLostDialog
        opportunityId={markLostOpen ? opp.id : null}
        onClose={() => setMarkLostOpen(false)}
      />

      <ScheduleTestDialog
        opportunityId={scheduleTestOpen ? opp.id : null}
        onClose={() => setScheduleTestOpen(false)}
      />

      <div style={{ padding: 16, maxWidth: 640 }}>
        <Stack gap={5}>
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

          {/* Stage indicator */}
          <HStack gap={3} align="center">
            <Text
              type="supporting"
              size="xsm"
              weight="semibold"
              style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Giai đoạn hiện tại
            </Text>
            <Badge
              label={isLost ? 'Lost' : stageLabel}
              variant={isLost ? 'error' : stageVariant}
              style={
                !isLost && opp.stage !== 'O5_ENROLLED'
                  ? { background: 'var(--cmc-brand)', color: '#fff' }
                  : undefined
              }
            />
          </HStack>

          {/* Ownership + source (phase-10) */}
          <div
            style={{
              border: '1px solid var(--cmc-border)',
              borderRadius: 'var(--cmc-radius-xs)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                paddingInline: 16,
                paddingBlock: 8,
                background: 'var(--cmc-surface-2)',
                borderBottom: '1px solid var(--cmc-border)',
              }}
            >
              <Text
                type="supporting"
                size="xsm"
                weight="semibold"
                style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
              >
                Phụ trách & nguồn
              </Text>
            </div>
            <div style={{ paddingInline: 16, paddingBlock: 8 }}>
              <Grid columns={2} gap={4}>
                <Stack gap={0.5}>
                  <Text type="supporting" size="xsm">
                    Chủ sở hữu
                  </Text>
                  <Text size="sm" weight="medium">
                    {opp.assignedTo?.fullName ?? 'Chưa giao'}
                  </Text>
                </Stack>
                <Stack gap={0.5}>
                  <Text type="supporting" size="xsm">
                    Nguồn
                  </Text>
                  <Text size="sm">{opp.source ? SOURCE_LABELS[opp.source] ?? opp.source : '—'}</Text>
                </Stack>
              </Grid>

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
                          assignMutation.mutate({ opportunityId: opp.id, assigneeUserId: me.userId })
                        }
                      />
                    )
                  )}
                  {assignMutation.error && (
                    // TODO(astryx-review): Text color enum has no error/danger slot —
                    // plain <span> with CSS var per migration flag rule (see users.tsx).
                    <span style={{ fontSize: 13, color: 'var(--cmc-danger)', display: 'block', marginTop: 8 }}>
                      {assignMutation.error.message}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Contact information */}
          <div
            style={{
              border: '1px solid var(--cmc-border)',
              borderRadius: 'var(--cmc-radius-xs)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                paddingInline: 16,
                paddingBlock: 8,
                background: 'var(--cmc-surface-2)',
                borderBottom: '1px solid var(--cmc-border)',
              }}
            >
              <Text
                type="supporting"
                size="xsm"
                weight="semibold"
                style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
              >
                Thông tin liên hệ
              </Text>
            </div>
            <div style={{ paddingInline: 16, paddingBlock: 8 }}>
              <Grid columns={2} gap={4}>
                <Stack gap={0.5}>
                  <Text type="supporting" size="xsm">
                    Họ tên
                  </Text>
                  <Text size="sm" weight="medium">
                    {opp.contact.name}
                  </Text>
                </Stack>
                <Stack gap={0.5}>
                  <Text type="supporting" size="xsm">
                    Số điện thoại
                  </Text>
                  <Text size="sm">{formatContactPhone(opp.contact.phone)}</Text>
                </Stack>
                {/* email is not included in opportunityList contact select — omitted */}
              </Grid>
            </div>
          </div>

          {/* Timeline summary */}
          <div
            style={{
              border: '1px solid var(--cmc-border)',
              borderRadius: 'var(--cmc-radius-xs)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                paddingInline: 16,
                paddingBlock: 8,
                background: 'var(--cmc-surface-2)',
                borderBottom: '1px solid var(--cmc-border)',
              }}
            >
              <Text
                type="supporting"
                size="xsm"
                weight="semibold"
                style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
              >
                Timeline
              </Text>
            </div>
            <Stack gap={0}>
              {(['O1_LEAD', 'O2_CONTACTED', 'O3_TEST_SCHEDULED', 'O4_TESTED', 'O5_ENROLLED'] as const).map(
                (stage, idx, arr) => {
                  const stageOrder = arr.indexOf(opp.stage as typeof arr[number]);
                  const done = idx <= stageOrder;
                  const isCurrent = opp.stage === stage;
                  // TODO(astryx-review): Astryx Text's `color` prop is a fixed
                  // semantic enum (primary/secondary/disabled/placeholder/accent/
                  // inherit) with no raw-CSS-var escape hatch, but this line needs
                  // the brand-blue token specifically for the "current" step — kept
                  // as a plain <span style> like StatCard's value line, per the
                  // documented fallback for arbitrary-color Text usages.
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
                        paddingInline: 16,
                        paddingBlock: 8,
                        borderBottom:
                          idx < arr.length - 1 ? '1px solid var(--cmc-border)' : undefined,
                        background: isCurrent ? 'var(--cmc-brand-muted)' : undefined,
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
                      <span style={{ fontSize: 14, fontWeight: isCurrent ? 600 : 400, color: stepColor }}>
                        {STAGE_LABELS[stage]}
                      </span>
                    </HStack>
                  );
                },
              )}
              {isLost && (
                <HStack gap={3} style={{ paddingInline: 16, paddingBlock: 8 }}>
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
          </div>

          {/* Entrance test appointments — testAppointment.forOpportunity */}
          <div
            style={{
              border: '1px solid var(--cmc-border)',
              borderRadius: 'var(--cmc-radius-xs)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                paddingInline: 16,
                paddingBlock: 8,
                background: 'var(--cmc-surface-2)',
                borderBottom: '1px solid var(--cmc-border)',
              }}
            >
              <Text
                type="supporting"
                size="xsm"
                weight="semibold"
                style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
              >
                Lịch test đầu vào
              </Text>
            </div>
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
                      paddingInline: 16,
                      paddingBlock: 8,
                      borderBottom:
                        idx < appointments.length - 1 ? '1px solid var(--cmc-border)' : undefined,
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
          </div>
        </Stack>
      </div>
    </>
  );
}
