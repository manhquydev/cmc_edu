// ParentAccount form — /admin/parents/:id (resource-centric).
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Banner,
  Button,
  ConfirmDialog,
  DetailPage,
  Dialog,
  DialogHeader,
  EmptyState,
  EntityHeader,
  HighlightStrip,
  HStack,
  KeyValueList,
  PageHeader,
  ResultPanel,
  SectionBlock,
  Stack,
  StatusBadge,
  Text,
  TextInput,
  useToast,
} from '@cmc/ui';
import { links, UUID_RE } from '@cmc/links';
import { CopyLinkButton } from '../../lib/copy-link-button.js';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

export default function ParentDetailPage() {
  const { parentId = '' } = useParams<{ parentId: string }>();
  const navigate = useNavigate();
  const { canDo } = useSession();
  const { success: toastSuccess } = useToast();
  const idOk = UUID_RE.test(parentId);

  const { data, isLoading, error, refetch } = trpc.parentAccount.get.useQuery(
    { parentAccountId: parentId },
    { enabled: idOk },
  );
  const utils = trpc.useUtils();

  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [activeOpen, setActiveOpen] = useState(false);

  const updateEmailMut = trpc.parentAccount.updateEmail.useMutation({
    onSuccess() {
      setEmailOpen(false);
      toastSuccess('Đã cập nhật email.');
      void refetch();
      void utils.parentAccount.list.invalidate();
    },
  });

  const setActiveMut = trpc.parentAccount.setActive.useMutation({
    onSuccess() {
      setActiveOpen(false);
      toastSuccess('Đã cập nhật trạng thái LMS.');
      void refetch();
      void utils.parentAccount.list.invalidate();
    },
  });

  if (!idOk) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Lớp & Học sinh' },
              { label: 'Phụ huynh', href: '/admin/parents' },
              { label: 'Không hợp lệ' },
            ]}
          />
        }
      >
        <EmptyState title="ID không hợp lệ" description="URL cần UUID ParentAccount." />
      </DetailPage>
    );
  }

  if (isLoading) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Lớp & Học sinh' },
              { label: 'Phụ huynh', href: '/admin/parents' },
              { label: '…' },
            ]}
          />
        }
      >
        <ResultPanel status="loading" title="Đang tải phụ huynh…" />
      </DetailPage>
    );
  }

  if (error || !data) {
    return (
      <DetailPage
        header={
          <PageHeader
            breadcrumbs={[
              { label: 'Lớp & Học sinh' },
              { label: 'Phụ huynh', href: '/admin/parents' },
              { label: 'Lỗi' },
            ]}
          />
        }
      >
        <EmptyState
          title="Không mở được phụ huynh"
          description={error?.message ?? 'Không tìm thấy trong cơ sở này.'}
          action={
            <Link to="/admin/parents">
              <Button label="Về danh sách" size="sm" variant="secondary" />
            </Link>
          }
        />
      </DetailPage>
    );
  }

  const shortId = parentId.slice(0, 8);
  const canSetActive = canDo('parentAccount', 'setActive');
  const lmsLabel = data.isActive ? 'LMS bật' : 'LMS khóa';

  return (
    <DetailPage
      density="ops"
      header={
        <PageHeader
          breadcrumbs={[
            { label: 'Lớp & Học sinh' },
            { label: 'Phụ huynh', href: '/admin/parents' },
            { label: shortId },
          ]}
          actions={
            <HStack gap={1} wrap="wrap">
              <CopyLinkButton mode="go" entity="parentAccount" id={parentId} />
              <Button
                label="Về danh sách"
                size="sm"
                variant="ghost"
                onClick={() => navigate('/admin/parents')}
              />
            </HStack>
          }
        />
      }
      entity={
        <EntityHeader
          title={data.phone}
          subtitle={data.email ?? 'Chưa có email LMS'}
          initials={data.phone.slice(-2)}
          badges={
            <StatusBadge
              status={data.isActive ? 'success' : 'warning'}
              label={lmsLabel}
            />
          }
          meta={
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {data.linkedChildrenCount} con liên kết
            </span>
          }
          actions={
            <HStack gap={1} wrap="wrap">
              <Button
                label={data.email ? 'Sửa email' : 'Gán email LMS'}
                size="sm"
                variant="primary"
                onClick={() => {
                  setEmail(data.email ?? '');
                  setEmailOpen(true);
                }}
              />
              {canSetActive ? (
                <Button
                  label={data.isActive ? 'Khóa LMS' : 'Mở LMS'}
                  size="sm"
                  variant="secondary"
                  onClick={() => setActiveOpen(true)}
                />
              ) : null}
            </HStack>
          }
        />
      }
      summary={
        <HighlightStrip
          items={[
            {
              key: 'lms',
              label: 'LMS',
              value: (
                <StatusBadge
                  status={data.isActive ? 'success' : 'warning'}
                  label={lmsLabel}
                />
              ),
            },
            {
              key: 'email',
              label: 'Email',
              value: data.email ?? '—',
            },
            {
              key: 'children',
              label: 'Con liên kết',
              value: String(data.linkedChildrenCount),
              tabular: true,
            },
          ]}
        />
      }
    >
      <div className="console-detail-panel">
        <Stack gap={3} style={{ padding: 'var(--cmc-space-3)', maxWidth: 720 }}>
          {updateEmailMut.error ? (
            <Banner status="error" title={updateEmailMut.error.message} />
          ) : null}
          {setActiveMut.error ? (
            <Banner status="error" title={setActiveMut.error.message} />
          ) : null}

          <SectionBlock
            title="Thông tin phụ huynh"
            description="Cùng khung form chứng từ Console (list → form · strip · sheet)."
          >
            <KeyValueList
              items={[
                { key: 'phone', label: 'SĐT', value: data.phone },
                { key: 'email', label: 'Email LMS', value: data.email ?? 'Chưa gán' },
                { key: 'lms', label: 'Trạng thái LMS', value: lmsLabel },
                {
                  key: 'children',
                  label: 'Số con (cơ sở này)',
                  value: String(data.linkedChildrenCount),
                },
              ]}
            />
          </SectionBlock>

          <SectionBlock title="Danh sách con" description="Guardian link trong cơ sở hiện tại.">
            {data.children.length === 0 ? (
              <Text type="supporting" size="xsm">
                Chưa có Guardian link trong cơ sở này.
              </Text>
            ) : (
              <Stack gap={1}>
                {data.children.map((c) => (
                  <HStack key={c.guardianId} gap={2}>
                    <Link to={links.student(c.studentId)}>
                      <Text type="body" size="sm">
                        {c.studentName}
                      </Text>
                    </Link>
                    <Text type="supporting" size="xsm">
                      ({c.relation})
                    </Text>
                  </HStack>
                ))}
              </Stack>
            )}
          </SectionBlock>
        </Stack>
      </div>

      <Dialog
        isOpen={emailOpen}
        onOpenChange={(next) => {
          if (!next && !updateEmailMut.isPending) setEmailOpen(false);
        }}
        width={420}
        purpose="form"
      >
        <DialogHeader
          title="Email LMS phụ huynh"
          onOpenChange={(next) => {
            if (!next && !updateEmailMut.isPending) setEmailOpen(false);
          }}
        />
        <Stack gap={2}>
          <TextInput
            label="Email"
            value={email}
            onChange={setEmail}
            placeholder="parent@example.com"
          />
          <HStack justify="end" gap={1}>
            <Button
              label="Hủy"
              size="sm"
              variant="secondary"
              isDisabled={updateEmailMut.isPending}
              onClick={() => setEmailOpen(false)}
            />
            <Button
              label="Lưu"
              size="sm"
              variant="primary"
              isLoading={updateEmailMut.isPending}
              isDisabled={!email.includes('@')}
              onClick={() =>
                updateEmailMut.mutate({ parentAccountId: parentId, email: email.trim() })
              }
            />
          </HStack>
        </Stack>
      </Dialog>

      <ConfirmDialog
        opened={activeOpen}
        title={data.isActive ? 'Khóa đăng nhập LMS?' : 'Mở lại đăng nhập LMS?'}
        message={
          data.isActive
            ? 'Phụ huynh sẽ không đăng nhập LMS được; token hiện tại hết hiệu lực.'
            : 'Phụ huynh có thể đăng nhập LMS trở lại (email-OTP).'
        }
        confirmLabel={data.isActive ? 'Khóa' : 'Mở'}
        confirmColor={data.isActive ? 'red' : 'blue'}
        loading={setActiveMut.isPending}
        onConfirm={() =>
          setActiveMut.mutate({ parentAccountId: parentId, isActive: !data.isActive })
        }
        onCancel={() => setActiveOpen(false)}
      />
    </DetailPage>
  );
}
