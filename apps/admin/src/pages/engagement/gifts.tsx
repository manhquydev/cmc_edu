import { useState } from 'react';
import {
  Badge,
  Banner,
  BulkActionBar,
  Button,
  DataTable,
  Dialog,
  DialogHeader,
  FilterBar,
  HStack,
  LineIcon,
  ListPage,
  ListPagination,
  NumberInput,
  PageHeader,
  Stack,
  Text,
  TextInput,
  useToast,
} from '@cmc/ui';
import type { FilterDef, TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

// G1 select grammar: options = real values only; empty + placeholder = all.
// Do not add value:'all' — that duplicates FilterBar hasClear “Tất cả”.
const GIFT_FILTERS: FilterDef[] = [
  {
    key: 'active',
    label: 'Trạng thái',
    type: 'select',
    options: [{ value: 'active', label: 'Đang hiện' }],
    placeholder: 'Tất cả',
  },
];

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
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const pageSize = 20;
  const { success: toastSuccess } = useToast();

  const utils = trpc.useUtils();
  // '' = all (include inactive); 'active' = only visible gifts.
  const [filterValues, setFilterValues] = useState({ active: '' });
  const includeInactive = filterValues.active !== 'active';
  const { data, isLoading, error } = trpc.gift.list.useQuery({ includeInactive });

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

  const allRows = (data as GiftRow[] | undefined) ?? [];
  const rows = allRows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      <ListPage
        density="ops"
        header={
          <PageHeader
            title="Phần thưởng"
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
        filters={
          <FilterBar
            filters={GIFT_FILTERS}
            value={filterValues}
            onChange={(next) => {
              setFilterValues({ active: next.active ?? '' });
              setPage(1);
              setSelectedIds([]);
            }}
          />
        }
        controlFooter={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cmc-space-2)', width: '100%' }}>
            <BulkActionBar
              selectionCount={selectedIds.length}
              onClear={() => setSelectedIds([])}
            >
              <Button
                label="Ẩn đã chọn"
                size="sm"
                variant="secondary"
                isDisabled={selectedIds.length === 0 || upsertMut.isPending}
                onClick={() => {
                  const picked = allRows.filter((r) => selectedIds.includes(r.id));
                  for (const g of picked) {
                    upsertMut.mutate({
                      id: g.id,
                      name: g.name,
                      starsRequired: g.starsRequired,
                      stock: g.stock,
                      isActive: false,
                    });
                  }
                  setSelectedIds([]);
                  toastSuccess(`Đã ẩn ${picked.length} phần thưởng`);
                }}
              />
            </BulkActionBar>
            <ListPagination
              page={page}
              pageSize={pageSize}
              total={allRows.length}
              onPageChange={(p) => {
                setPage(p);
                setSelectedIds([]);
              }}
            />
          </div>
        }
      >
        <DataTable<GiftRow>
          columns={COLUMNS}
          data={rows}
          loading={isLoading}
          error={error?.message}
          empty="Chưa có phần thưởng nào"
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
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
          <HStack justify="end" gap={1} style={{ marginTop: 'var(--cmc-space-1)' }}>
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
