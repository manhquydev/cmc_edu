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
  HStack,
  PageHeader,
  ResultPanel,
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

  return (
    <DetailPage
      density="ops"
      header={
        <PageHeader
          title="Phụ huynh"
          subtitle={data.phone}
          breadcrumbs={[
            { label: 'Lớp & Học sinh' },
            { label: 'Phụ huynh', href: '/admin/parents' },
            { label: shortId },
          ]}
          actions={
            <HStack gap={1} wrap="wrap">
              <CopyLinkButton mode="go" entity="parentAccount" id={parentId} />
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
              label={data.isActive ? 'LMS bật' : 'LMS khóa'}
            />
          }
        />
      }
    >
      <Stack gap={3} padding={4}>
        {updateEmailMut.error ? (
          <Banner status="error" title={updateEmailMut.error.message} />
        ) : null}
        {setActiveMut.error ? (
          <Banner status="error" title={setActiveMut.error.message} />
        ) : null}

        <Text type="body" size="sm">
          Con đã liên kết (cơ sở này): <strong>{data.linkedChildrenCount}</strong>
        </Text>

        <Stack gap={1}>
          <Text type="body" size="sm" weight="medium">
            Danh sách con
          </Text>
          {data.children.length === 0 ? (
            <Text type="supporting" size="xsm">
              Chưa có Guardian link trong cơ sở này.
            </Text>
          ) : (
            data.children.map((c) => (
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
            ))
          )}
        </Stack>
      </Stack>

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
