import { useState } from 'react';
import {
  Badge,
  Banner,
  Button,
  DataTable,
  Dialog,
  DialogHeader,
  HStack,
  LineIcon,
  ListPage,
  NumberInput,
  PageHeader,
  Stack,
  Text,
  TextInput,
} from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

interface GiftRow {
  id: string;
  name: string;
  starsRequired: number;
  stock: number;
  isActive: boolean;
  [key: string]: unknown;
}

const COLUMNS: TableColumn<GiftRow>[] = [
  { key: 'name', label: 'Tên phần thưởng' },
  {
    key: 'starsRequired',
    label: 'Sao cần',
    width: 110,
    render: (v) => (
      <HStack gap={0.5} align="center">
        <LineIcon name="star" size={14} />
        <Text type="body" size="sm" hasTabularNumbers>
          {String(v)}
        </Text>
      </HStack>
    ),
  },
  {
    key: 'stock',
    label: 'Tồn kho',
    width: 130,
    render: (v) => (
      <Text type="body" size="sm">{Number(v) === -1 ? 'Không giới hạn' : String(v)}</Text>
    ),
  },
  {
    key: 'isActive',
    label: 'Kích hoạt',
    width: 110,
    render: (v) => (
      <Badge variant={Boolean(v) ? 'success' : 'neutral'} label={Boolean(v) ? 'Hoạt động' : 'Ẩn'} />
    ),
  },
];

interface GiftFormState {
  name: string;
  starsRequired: number | null;
  stock: number | null;
}

const EMPTY_FORM: GiftFormState = { name: '', starsRequired: 1, stock: -1 };

export default function GiftsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<GiftFormState>(EMPTY_FORM);

  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.gift.list.useQuery({ includeInactive: true });

  const upsertMut = trpc.gift.upsert.useMutation({
    onSuccess: () => {
      setModalOpen(false);
      setForm(EMPTY_FORM);
      void utils.gift.list.invalidate();
    },
  });

  function closeDialog() {
    setModalOpen(false);
    setForm(EMPTY_FORM);
  }

  function handleCreate() {
    upsertMut.mutate({
      name: form.name.trim(),
      starsRequired: Number(form.starsRequired),
      stock: Number(form.stock),
      isActive: true,
    });
  }

  const isFormValid =
    form.name.trim().length > 0 && Number(form.starsRequired) >= 1;

  return (
    <>
      <ListPage
        header={
          <PageHeader
            title="Phần thưởng"
            subtitle="Quản lý danh mục phần thưởng đổi sao"
            breadcrumbs={[
              { label: 'Quản trị' },
              { label: 'Engagement' },
              { label: 'Phần thưởng' },
            ]}
            actions={
              <Button label="Thêm phần thưởng" variant="primary" size="sm" onClick={() => setModalOpen(true)} />
            }
          />
        }
      >
        <DataTable<GiftRow>
          columns={COLUMNS}
          data={(data as GiftRow[] | undefined) ?? []}
          loading={isLoading}
          error={error?.message}
          empty="Chưa có phần thưởng nào"
        />
      </ListPage>

      {/* TODO(astryx-review): Astryx `Dialog` (native <dialog>-based) manages
          its own focus-trap / auto-focus / Escape-dismiss internally —
          different implementation from the prior `Modal`. The original
          `closeOnClickOutside={!upsertMut.isPending}` toggle (block backdrop
          dismiss only while submitting) has no direct equivalent — `purpose`
          only supports a static form/info/required mode, so this uses the
          static 'form' purpose (blocks backdrop click, allows Escape) at all
          times, same class of flag as the exercises-page create dialog. */}
      <Dialog
        isOpen={modalOpen}
        onOpenChange={(next) => { if (!next) closeDialog(); }}
        width={400}
        purpose="form"
      >
        <DialogHeader
          title="Thêm phần thưởng"
          onOpenChange={(next) => { if (!next) closeDialog(); }}
        />
        <Stack gap={2}>
          <TextInput
            label="Tên phần thưởng"
            placeholder="VD: Bút bi, Sách tô màu…"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            isRequired
          />
          <NumberInput
            label="Số sao cần"
            min={1}
            hasClear
            value={form.starsRequired}
            onChange={(v) => setForm((f) => ({ ...f, starsRequired: v }))}
            isRequired
          />
          <NumberInput
            label="Tồn kho (-1 = không giới hạn)"
            min={-1}
            hasClear
            value={form.stock}
            onChange={(v) => setForm((f) => ({ ...f, stock: v }))}
          />
          {upsertMut.error && <Banner status="error" title={upsertMut.error.message} />}
          <HStack justify="end" gap={1} style={{ marginTop: 4 }}>
            <Button
              label="Hủy"
              variant="secondary"
              onClick={closeDialog}
              isDisabled={upsertMut.isPending}
            />
            <Button
              label="Tạo"
              variant="primary"
              onClick={handleCreate}
              isLoading={upsertMut.isPending}
              isDisabled={!isFormValid}
            />
          </HStack>
        </Stack>
      </Dialog>
    </>
  );
}
