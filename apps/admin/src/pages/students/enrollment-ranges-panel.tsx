import { useState } from 'react';
import {
  Banner,
  Button,
  ConfirmDialog,
  EmptyState,
  HStack,
  KeyValueList,
  LineIcon,
  NumberInput,
  SectionBlock,
  Selector,
  Stack,
} from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { RecordLink } from '../../lib/record-link.js';

export function EnrollmentRangesPanel({ studentId }: { studentId: string }) {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.lmsOps.listEnrollmentsForStudent.useQuery({ studentId });
  const [enrollmentId, setEnrollmentId] = useState<string | undefined>();
  const [fromOrder, setFromOrder] = useState<number | undefined>();
  const [toOrder, setToOrder] = useState<number | undefined>();
  const [confirm, setConfirm] = useState<'grant' | 'revoke' | null>(null);

  const addMut = trpc.lmsOps.addWithUnits.useMutation({
    onSuccess: () => {
      setConfirm(null);
      void utils.lmsOps.listEnrollmentsForStudent.invalidate({ studentId });
    },
  });
  const pastMut = trpc.lmsOps.grantPast.useMutation({
    onSuccess: () => {
      setConfirm(null);
      void utils.lmsOps.listEnrollmentsForStudent.invalidate({ studentId });
    },
  });
  const revokeMut = trpc.lmsOps.revokeFromNext.useMutation({
    onSuccess: () => {
      setConfirm(null);
      void utils.lmsOps.listEnrollmentsForStudent.invalidate({ studentId });
    },
  });

  const enrollments = data?.enrollments ?? [];
  const selected = enrollments.find((e) => e.enrollmentId === enrollmentId);
  const pending = addMut.isPending || pastMut.isPending || revokeMut.isPending;
  const mutError = addMut.error ?? pastMut.error ?? revokeMut.error;

  function runGrant() {
    if (!enrollmentId || fromOrder == null || toOrder == null || !selected) return;
    const input = { enrollmentId, fromOrderGlobal: fromOrder, toOrderGlobal: toOrder };
    if (fromOrder < selected.currentOrderGlobal) pastMut.mutate(input);
    else addMut.mutate(input);
  }

  if (isLoading) {
    return <EmptyState title="Đang tải lớp…" icon={<LineIcon name="layers" size={28} />} />;
  }
  if (error) {
    return <Banner status="error" title="Không tải được lớp" description={error.message} />;
  }
  if (enrollments.length === 0) {
    return (
      <EmptyState
        title="Chưa ghi danh lớp"
        description="Học viên chưa có enrollment tại cơ sở này."
        icon={<LineIcon name="layers" size={28} />}
      />
    );
  }

  return (
    <div className="console-detail-stack">
      <SectionBlock title="Lớp đã ghi danh" description="Range unit — GĐĐT break-glass. Happy-path vẫn là duyệt phiếu thu.">
        <Stack gap={3}>
          {enrollments.map((e) => (
            <KeyValueList
              key={e.enrollmentId}
              items={[
                {
                  key: 'code',
                  label: 'Lớp',
                  value: (
                    <RecordLink entity="classBatch" id={e.classBatchId}>
                      {e.batchCode}
                    </RecordLink>
                  ),
                },
                { key: 'status', label: 'Enrollment', value: e.status },
                { key: 'current', label: 'Unit hiện tại', value: String(e.currentOrderGlobal) },
                {
                  key: 'ranges',
                  label: 'Range',
                  value:
                    e.ranges.length === 0
                      ? '—'
                      : e.ranges.map((r) => `${r.fromOrderGlobal}–${r.toOrderGlobal}`).join(', '),
                  fullWidth: true,
                },
              ]}
            />
          ))}
        </Stack>
      </SectionBlock>
      <SectionBlock title="Cấp / cắt range" description="addWithUnits khi from ≥ current; grantPast khi from < current. Cắt = revokeFromNext.">
        <Stack gap={2}>
          <Selector
            label="Enrollment"
            placeholder="Chọn lớp…"
            value={enrollmentId}
            onChange={(v) => setEnrollmentId(v)}
            options={enrollments.map((e) => ({
              value: e.enrollmentId,
              label: `${e.batchCode} (${e.status})`,
            }))}
            size="sm"
          />
          <HStack gap={2} align="end">
            <NumberInput label="Từ unit" value={fromOrder} onChange={setFromOrder} size="sm" />
            <NumberInput label="Đến unit" value={toOrder} onChange={setToOrder} size="sm" />
            <Button
              label="Cấp range"
              size="sm"
              variant="primary"
              isDisabled={!enrollmentId || fromOrder == null || toOrder == null || pending}
              onClick={() => setConfirm('grant')}
            />
            <Button
              label="Cắt từ unit"
              size="sm"
              variant="secondary"
              isDisabled={!enrollmentId || fromOrder == null || pending}
              onClick={() => setConfirm('revoke')}
            />
          </HStack>
          {mutError ? (
            <Banner status="error" title="Không ghi được range" description={mutError.message} />
          ) : null}
        </Stack>
      </SectionBlock>
      <ConfirmDialog
        opened={confirm != null}
        title={confirm === 'revoke' ? 'Cắt range unit?' : 'Cấp range unit?'}
        message="Hành động break-glass, ghi audit. Không thay phiếu thu."
        confirmLabel={confirm === 'revoke' ? 'Cắt range' : 'Cấp range'}
        onConfirm={() => {
          if (confirm === 'revoke' && enrollmentId && fromOrder != null) {
            revokeMut.mutate({ enrollmentId, fromOrderGlobal: fromOrder });
            return;
          }
          runGrant();
        }}
        onCancel={() => setConfirm(null)}
        loading={pending}
      />
    </div>
  );
}
