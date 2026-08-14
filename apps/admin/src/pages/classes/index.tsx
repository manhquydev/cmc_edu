import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { links } from '@cmc/links';
import {
  AsyncEntityCombobox,
  Banner,
  Button,
  DataTable,
  Dialog,
  DialogHeader,
  EmptyState,
  FilterBar,
  HStack,
  LineIcon,
  BulkActionBar,
  ListPage,
  ListPagination,
  PageHeader,
  Selector,
  Stack,
  StatusBadge,
  Text,
  TextInput,
  useToast,
} from '@cmc/ui';
import type { FilterDef, TableColumn, TableEmptySpec } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

const CLASS_FILTERS: FilterDef[] = [
  {
    key: 'q',
    label: 'Tìm kiếm',
    type: 'text',
    placeholder: 'Mã lớp, khoá học, chương trình…',
  },
];
import { useSession } from '../../lib/session-context.js';

interface ClassRow {
  id: string;
  code: string;
  program: string;
  status: string;
  startDate: Date;
  endDate: Date;
  teacherId: string | null;
  [key: string]: unknown;
}

const COLUMNS: TableColumn<ClassRow>[] = [
  { key: 'code', label: 'Mã lớp', width: 140 },
  { key: 'program', label: 'Chương trình', width: 120 },
  {
    key: 'status',
    label: 'Trạng thái',
    width: 120,
    render: (v) => <StatusBadge status={String(v)} />,
  },
  {
    key: 'startDate',
    label: 'Bắt đầu',
    width: 130,
    render: (v) => new Date(v as string | Date).toLocaleDateString('vi-VN'),
  },
  {
    key: 'endDate',
    label: 'Kết thúc',
    width: 130,
    render: (v) => new Date(v as string | Date).toLocaleDateString('vi-VN'),
  },
];

// weekday: 0 = Sunday .. 6 = Saturday (JS `Date#getDay()` convention — same as
// `ScheduleSlot.weekday` in schema.prisma and classBatch.create's input).
const WEEKDAY_OPTIONS = [
  { value: '1', label: 'Thứ 2' },
  { value: '2', label: 'Thứ 3' },
  { value: '3', label: 'Thứ 4' },
  { value: '4', label: 'Thứ 5' },
  { value: '5', label: 'Thứ 6' },
  { value: '6', label: 'Thứ 7' },
  { value: '0', label: 'Chủ nhật' },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

interface SlotFormEntry {
  key: number;
  weekday: string;
  startTime: string;
  endTime: string;
}

interface CreateClassForm {
  courseId: string;
  startUnitId: string;
  startDate: string;
  endDate: string;
  teacherId: string;
  slots: SlotFormEntry[];
}

interface CreateClassErrors {
  courseId?: string;
  startUnitId?: string;
  startDate?: string;
  endDate?: string;
  slots?: string;
}

function makeSlot(counter: { current: number }): SlotFormEntry {
  return { key: ++counter.current, weekday: '', startTime: '', endTime: '' };
}

function emptyCreateForm(counter: { current: number }): CreateClassForm {
  return {
    courseId: '',
    startUnitId: '',
    startDate: '',
    endDate: '',
    teacherId: '',
    slots: [makeSlot(counter)],
  };
}

// Mirrors classBatchCreateInput's own checks (class-batch-router.ts) so the
// form fails fast with a readable message instead of round-tripping to the
// server for something the client can already tell is wrong.
function validateCreateForm(form: CreateClassForm): CreateClassErrors {
  const errors: CreateClassErrors = {};
  if (!form.courseId) errors.courseId = 'Vui lòng chọn khoá học';
  if (!form.startUnitId) errors.startUnitId = 'Vui lòng chọn unit bắt đầu (neo lớp)';
  if (!DATE_RE.test(form.startDate)) errors.startDate = 'Định dạng YYYY-MM-DD';
  if (!DATE_RE.test(form.endDate)) errors.endDate = 'Định dạng YYYY-MM-DD';
  if (!errors.startDate && !errors.endDate && form.startDate > form.endDate) {
    errors.endDate = 'Ngày kết thúc phải sau ngày bắt đầu';
  }
  if (form.slots.length === 0) {
    errors.slots = 'Cần ít nhất 1 khung giờ học';
  } else {
    for (const slot of form.slots) {
      if (!slot.weekday) {
        errors.slots = 'Chọn thứ cho mọi khung giờ học';
        break;
      }
      if (!TIME_RE.test(slot.startTime) || !TIME_RE.test(slot.endTime)) {
        errors.slots = 'Giờ khung học phải đúng định dạng HH:mm';
        break;
      }
      if (slot.startTime >= slot.endTime) {
        errors.slots = 'Giờ bắt đầu phải trước giờ kết thúc trong mỗi khung giờ';
        break;
      }
    }
  }
  return errors;
}

export default function ClassListPage() {
  const { canDo } = useSession();

  // Hiding the menu entry does not stop someone typing the URL, and from here
  // the detail screen leads on to the class roster. `class.read` is for picking
  // a class elsewhere; administering classes needs `class.create`.
  if (!canDo('class', 'create')) {
    return (
      <ListPage
        density="ops"
        header={
          <PageHeader
            title="Lớp học"
            breadcrumbs={[{ label: 'Quản trị' }, { label: 'Lớp học' }]}
          />
        }
      >
        <EmptyState
          title="Không có quyền truy cập"
          description="Trang này yêu cầu quyền quản lý lớp học (class.create)."
          icon={<LineIcon name="shield" size={28} />}
        />
      </ListPage>
    );
  }

  return <ClassListContent />;
}

function ClassListContent() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  // Ref-like counter (not React state) so slot `key`s stay stable/unique across
  // add/remove — same pattern as attendance/shifts.tsx's `keyCounter`.
  const keyCounter = useState(() => ({ current: 0 }))[0];

  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const pageSize = 20;
  const { success: toastSuccess } = useToast();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [debouncedSearch]);

  const { data, isLoading, error } = trpc.classBatch.list.useQuery({
    page,
    pageSize,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateClassForm>(() => emptyCreateForm(keyCounter));
  const [errors, setErrors] = useState<CreateClassErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [createResult, setCreateResult] = useState<{
    classBatchId: string;
    code: string;
    sessionsCreated: number;
    sessionsStamped?: number;
    startUnitOrderGlobal?: number;
  } | null>(null);

  const rows = (data?.items as ClassRow[] | undefined) ?? [];
  const total = data?.total ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (!data) return;
    if (page > totalPages) setPage(totalPages);
  }, [data, page, totalPages]);

  // Applied search only — raw searchInput would lie during debounce.
  const filtersActive = Boolean(debouncedSearch);
  const listEmpty: string | TableEmptySpec =
    total > 0
      ? 'Không có dòng trên trang này'
      : !filtersActive
        ? {
            kind: 'first-run',
            title: 'Chưa có lớp học nào',
            description: 'Tạo lớp đầu tiên cho cơ sở trước khi xếp học viên.',
            action: (
              <Button
                label="Thêm lớp học đầu tiên"
                size="sm"
                variant="primary"
                onClick={() => setCreateOpen(true)}
              />
            ),
          }
        : 'Không có lớp học khớp bộ lọc hiện tại';

  // Dropdowns instead of pasted UUIDs (spec requirement). S6 fix: search-aware
  // now (course.list already supports it) instead of a static pageSize:100
  // fetch — course #101+ was previously unreachable in the create dialog.
  // AsyncEntityCombobox renders the error banner itself (ported from an
  // independently-built version of this same component — see its
  // UseAsyncEntityOptionsResult['error'] doc comment).
  // Filled from course.list pages that powered the combobox (including search).
  const [programByCourseId, setProgramByCourseId] = useState<Record<string, string>>({});
  const courseRowsRef = useRef<Array<{ id: string; program: string }>>([]);

  function useCourseOptions(search: string) {
    const { data, isLoading, error } = trpc.course.list.useQuery({
      page: 1,
      pageSize: 100,
      ...(search ? { search } : {}),
    });
    if (data?.items?.length) {
      courseRowsRef.current = data.items.map((c) => ({ id: c.id, program: c.program }));
    }
    const options = (data?.items ?? []).map((c) => ({
      value: c.id,
      label: `${c.name} (${c.program})`,
    }));
    return { options, isLoading, error: error?.message };
  }
  const { data: teacherData, isLoading: teacherLoading, error: teacherError } =
    trpc.user.pickList.useQuery({ role: 'giao_vien' });

  // Unit-aware create (lmsOps): stamps sessions from start unit neo in same TX.
  const createMut = trpc.lmsOps.createClassWithUnits.useMutation({
    onSuccess: (res) => {
      setCreateResult({
        classBatchId: res.classBatchId,
        code: res.code,
        sessionsCreated: res.sessionsCreated,
        sessionsStamped: res.sessionsStamped,
        startUnitOrderGlobal: res.startUnitOrderGlobal,
      });
      void utils.classBatch.list.invalidate();
    },
  });

  const {
    data: unitsData,
    isLoading: unitsLoading,
    error: unitsError,
  } = trpc.curriculumUnit.list.useQuery(undefined, {
    enabled: createOpen,
  });

  const teacherOptions = ((teacherData?.items ?? []) as Array<{ id: string; fullName: string }>).map(
    (t) => ({ value: t.id, label: t.fullName }),
  );

  const liveErrors = validateCreateForm(form);
  const isFormValid = Object.keys(liveErrors).length === 0;

  function resetCreateForm() {
    setForm(emptyCreateForm(keyCounter));
    setErrors({});
    setSubmitted(false);
    setCreateResult(null);
    createMut.reset();
  }

  function closeCreateDialog() {
    if (createMut.isPending) return;
    setCreateOpen(false);
    resetCreateForm();
  }

  function setField<K extends 'courseId' | 'startUnitId' | 'startDate' | 'endDate' | 'teacherId'>(
    key: K,
  ) {
    return (value: string) => {
      if (key === 'courseId' && value) {
        const row = courseRowsRef.current.find((c) => c.id === value);
        if (row) {
          setProgramByCourseId((prev) => ({ ...prev, [value]: row.program }));
        }
      }
      setForm((f) => {
        const next = { ...f, [key]: value };
        // Changing course clears start unit (program may differ).
        if (key === 'courseId') next.startUnitId = '';
        if (submitted) setErrors(validateCreateForm(next));
        return next;
      });
    };
  }

  const selectedCourseProgram = form.courseId ? (programByCourseId[form.courseId] ?? null) : null;

  const unitOptions = ((unitsData?.items ?? []) as Array<{
    id: string;
    program: string;
    title: string;
    orderGlobal: number;
    level: string;
    monthIndex: number;
  }>)
    .filter((u) => selectedCourseProgram != null && u.program === selectedCourseProgram)
    .map((u) => ({
      value: u.id,
      label: `#${u.orderGlobal} · ${u.title} (L${u.level}/M${u.monthIndex})`,
    }));

  function updateSlot(key: number, field: 'weekday' | 'startTime' | 'endTime', value: string) {
    setForm((f) => {
      const next = { ...f, slots: f.slots.map((s) => (s.key === key ? { ...s, [field]: value } : s)) };
      if (submitted) setErrors(validateCreateForm(next));
      return next;
    });
  }

  function addSlot() {
    setForm((f) => {
      if (f.slots.length >= 20) return f;
      const next = { ...f, slots: [...f.slots, makeSlot(keyCounter)] };
      if (submitted) setErrors(validateCreateForm(next));
      return next;
    });
  }

  function removeSlot(key: number) {
    setForm((f) => {
      if (f.slots.length <= 1) return f;
      const next = { ...f, slots: f.slots.filter((s) => s.key !== key) };
      if (submitted) setErrors(validateCreateForm(next));
      return next;
    });
  }

  function handleCreate() {
    setSubmitted(true);
    const errs = validateCreateForm(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    createMut.mutate({
      courseId: form.courseId,
      startUnitId: form.startUnitId,
      startDate: form.startDate,
      endDate: form.endDate,
      slots: form.slots.map((s) => ({
        weekday: Number(s.weekday),
        startTime: s.startTime,
        endTime: s.endTime,
      })),
      ...(form.teacherId ? { teacherId: form.teacherId } : {}),
    });
  }

  return (
    <>
      <ListPage
        density="ops"
        header={
          <PageHeader
            title="Lớp học"
            subtitle="Danh sách lớp học tại cơ sở"
            breadcrumbs={[{ label: 'Quản trị' }, { label: 'Lớp học' }]}
            actions={
              <Button
                label="+ Tạo lớp"
                size="sm"
                variant="primary"
                onClick={() => setCreateOpen(true)}
              />
            }
          />
        }
        filters={
          <FilterBar
            filters={CLASS_FILTERS}
            value={{ q: searchInput }}
            onChange={(next) => setSearchInput(next.q ?? '')}
          />
        }
        controlFooter={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cmc-space-2)', width: '100%' }}>
            <BulkActionBar
              selectionCount={selectedIds.length}
              onClear={() => setSelectedIds([])}
            >
              <Button
                label="Sao chép mã lớp"
                size="sm"
                variant="secondary"
                isDisabled={selectedIds.length === 0}
                onClick={() => {
                  const codes = rows
                    .filter((r) => selectedIds.includes(r.id))
                    .map((r) => r.code);
                  void navigator.clipboard?.writeText(codes.join(', '));
                  toastSuccess(`Đã sao chép ${codes.length} mã lớp`);
                }}
              />
            </BulkActionBar>
            <ListPagination
              page={page}
              pageSize={pageSize}
              total={data?.total ?? data?.items?.length ?? 0}
              onPageChange={(p) => {
                setPage(p);
                setSelectedIds([]);
              }}
            />
          </div>
        }
      >
        <DataTable<ClassRow>
          columns={COLUMNS}
          data={rows}
          loading={isLoading}
          error={error?.message}
          empty={listEmpty}
          onRowClick={(row) => void navigate(links.classBatch(row.id))}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      </ListPage>

      {/* Create dialog — lmsOps.createClassWithUnits: calendar + unit stamps. */}
      <Dialog
        isOpen={createOpen}
        onOpenChange={(next) => {
          if (!next) closeCreateDialog();
        }}
        purpose="form"
        width={560}
      >
        <DialogHeader
          title="Tạo lớp học (unit-aware)"
          onOpenChange={(next) => {
            if (!next) closeCreateDialog();
          }}
        />
        <Stack gap={2} padding={4}>
          {createResult ? (
            <Stack gap={2}>
              <Banner
                status="success"
                title={`Đã tạo lớp ${createResult.code}`}
                description={`Đã sinh ${createResult.sessionsCreated} buổi, stamp ${createResult.sessionsStamped ?? 0} unit (neo order ${createResult.startUnitOrderGlobal ?? '—'}).`}
              />
              <HStack justify="end" gap={1}>
                <Button label="Đóng" variant="secondary" onClick={closeCreateDialog} />
                <Button
                  label="Xem lớp"
                  variant="primary"
                  onClick={() => {
                    const id = createResult.classBatchId;
                    closeCreateDialog();
                    void navigate(links.classBatch(id));
                  }}
                />
              </HStack>
            </Stack>
          ) : (
            <>
              <AsyncEntityCombobox
                label="Khoá học"
                placeholder="Chọn khoá học"
                isRequired
                value={form.courseId || null}
                onChange={(v) => setField('courseId')(v ?? '')}
                useOptions={useCourseOptions}
                pinnedLabel={(id) => `Khoá đã chọn (${id.slice(0, 8)}…)`}
                status={errors.courseId ? { type: 'error', message: errors.courseId } : undefined}
              />

              {unitsError ? (
                <Banner
                  status="error"
                  title="Không tải được danh sách unit"
                  description={unitsError.message}
                />
              ) : null}
              <Selector
                label="Unit bắt đầu (neo lớp)"
                placeholder={
                  !form.courseId
                    ? 'Chọn khoá học trước'
                    : !selectedCourseProgram
                      ? 'Đang xác định chương trình…'
                      : unitsLoading
                        ? 'Đang tải unit…'
                        : unitOptions.length === 0
                          ? 'Không có unit cho chương trình'
                          : 'Chọn unit bắt đầu'
                }
                options={unitOptions}
                value={form.startUnitId || undefined}
                onChange={(v) => setField('startUnitId')(v ?? '')}
                hasSearch
                hasClear={false}
                isDisabled={
                  !form.courseId ||
                  !selectedCourseProgram ||
                  unitsLoading ||
                  Boolean(unitsError) ||
                  unitOptions.length === 0
                }
              />
              {errors.startUnitId ? (
                <Text type="supporting" size="2xs" style={{ color: 'var(--cmc-danger)' }}>
                  {errors.startUnitId}
                </Text>
              ) : null}

              <HStack gap={1}>
                <div style={{ flex: 1 }}>
                  <TextInput
                    label="Ngày bắt đầu (YYYY-MM-DD)"
                    placeholder="2026-08-01"
                    isRequired
                    value={form.startDate}
                    onChange={setField('startDate')}
                    status={errors.startDate ? { type: 'error', message: errors.startDate } : undefined}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <TextInput
                    label="Ngày kết thúc (YYYY-MM-DD)"
                    placeholder="2026-12-01"
                    isRequired
                    value={form.endDate}
                    onChange={setField('endDate')}
                    status={errors.endDate ? { type: 'error', message: errors.endDate } : undefined}
                  />
                </div>
              </HStack>

              <Stack gap={1}>
                <Text type="supporting" size="xsm" weight="semibold" style={{ textTransform: 'uppercase' }}>
                  Khung giờ học
                </Text>
                {form.slots.map((slot) => (
                  <HStack key={slot.key} gap={1} align="end" wrap="nowrap">
                    <div style={{ flex: '0 0 140px' }}>
                      <Selector
                        label="Thứ"
                        options={WEEKDAY_OPTIONS}
                        placeholder="Chọn thứ"
                        value={slot.weekday || undefined}
                        onChange={(v) => updateSlot(slot.key, 'weekday', v ?? '')}
                        hasClear={false}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextInput
                        label="Giờ bắt đầu (HH:mm)"
                        placeholder="18:00"
                        value={slot.startTime}
                        onChange={(v) => updateSlot(slot.key, 'startTime', v)}
                        size="sm"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextInput
                        label="Giờ kết thúc (HH:mm)"
                        placeholder="19:30"
                        value={slot.endTime}
                        onChange={(v) => updateSlot(slot.key, 'endTime', v)}
                        size="sm"
                      />
                    </div>
                    {form.slots.length > 1 && (
                      <Button label="Xoá" size="sm" variant="ghost" onClick={() => removeSlot(slot.key)} />
                    )}
                  </HStack>
                ))}
                {errors.slots && (
                  <Text type="supporting" size="2xs" style={{ color: 'var(--cmc-danger)' }}>
                    {errors.slots}
                  </Text>
                )}
                {form.slots.length < 20 && (
                  <Button
                    label="+ Thêm khung giờ"
                    size="sm"
                    variant="secondary"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={addSlot}
                  />
                )}
              </Stack>

              {teacherError && (
                <Banner
                  status="warning"
                  title="Không tải được danh sách giáo viên"
                  description={teacherError.message}
                />
              )}
              <Selector
                label="Giáo viên (tuỳ chọn)"
                placeholder={teacherLoading ? 'Đang tải…' : 'Chọn giáo viên'}
                options={teacherOptions}
                value={form.teacherId || null}
                onChange={(v) => setField('teacherId')(v ?? '')}
                hasSearch
                hasClear
                isDisabled={teacherLoading}
              />

              {createMut.error && (
                <Banner status="error" title="Lỗi tạo lớp" description={createMut.error.message} />
              )}

              <HStack justify="end" gap={1} style={{ marginTop: 'var(--cmc-space-2)' }}>
                <Button
                  label="Hủy"
                  variant="secondary"
                  onClick={closeCreateDialog}
                  isDisabled={createMut.isPending}
                />
                <Button
                  label="Tạo lớp"
                  variant="primary"
                  onClick={handleCreate}
                  isLoading={createMut.isPending}
                  isDisabled={!isFormValid}
                />
              </HStack>
            </>
          )}
        </Stack>
      </Dialog>
    </>
  );
}
