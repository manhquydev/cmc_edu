import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Banner,
  Button,
  DataTable,
  Dialog,
  DialogHeader,
  EmptyState,
  HStack,
  LineIcon,
  PageHeader,
  Selector,
  Stack,
  StatusBadge,
  Text,
  TextInput,
} from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
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
  startDate: string;
  endDate: string;
  teacherId: string;
  slots: SlotFormEntry[];
}

interface CreateClassErrors {
  courseId?: string;
  startDate?: string;
  endDate?: string;
  slots?: string;
}

function makeSlot(counter: { current: number }): SlotFormEntry {
  return { key: ++counter.current, weekday: '', startTime: '', endTime: '' };
}

function emptyCreateForm(counter: { current: number }): CreateClassForm {
  return { courseId: '', startDate: '', endDate: '', teacherId: '', slots: [makeSlot(counter)] };
}

// Mirrors classBatchCreateInput's own checks (class-batch-router.ts) so the
// form fails fast with a readable message instead of round-tripping to the
// server for something the client can already tell is wrong.
function validateCreateForm(form: CreateClassForm): CreateClassErrors {
  const errors: CreateClassErrors = {};
  if (!form.courseId) errors.courseId = 'Vui lòng chọn khoá học';
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
      <>
        <PageHeader
          title="Lớp học"
          breadcrumbs={[{ label: 'Quản trị' }, { label: 'Lớp học' }]}
        />
        <EmptyState
          title="Không có quyền truy cập"
          description="Trang này yêu cầu quyền quản lý lớp học (class.create)."
          icon={<LineIcon name="shield" size={28} />}
        />
      </>
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

  const { data, isLoading, error } = trpc.classBatch.list.useQuery({
    page: 1,
    pageSize: 50,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateClassForm>(() => emptyCreateForm(keyCounter));
  const [errors, setErrors] = useState<CreateClassErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [createResult, setCreateResult] = useState<{
    classBatchId: string;
    code: string;
    slotsCreated: number;
    sessionsCreated: number;
  } | null>(null);

  // Dropdowns instead of pasted UUIDs (spec requirement) — `course.list` and
  // `user.pickList({role:'giao_vien'})` are both already gated to
  // giam_doc_dao_tao, the same role that owns `class.create` above.
  const { data: courseData, isLoading: courseLoading, error: courseError } =
    trpc.course.list.useQuery({ pageSize: 100 });
  const { data: teacherData, isLoading: teacherLoading, error: teacherError } =
    trpc.user.pickList.useQuery({ role: 'giao_vien' });

  const createMut = trpc.classBatch.create.useMutation({
    onSuccess: (res) => {
      setCreateResult({
        classBatchId: res.classBatch.id,
        code: res.classBatch.code,
        slotsCreated: res.slotsCreated,
        sessionsCreated: res.sessionsCreated,
      });
      void utils.classBatch.list.invalidate();
    },
  });

  const courseOptions = (courseData?.items ?? []).map((c) => ({
    value: c.id,
    label: `${c.name} (${c.program})`,
  }));
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

  function setField<K extends 'courseId' | 'startDate' | 'endDate' | 'teacherId'>(key: K) {
    return (value: string) => {
      setForm((f) => {
        const next = { ...f, [key]: value };
        if (submitted) setErrors(validateCreateForm(next));
        return next;
      });
    };
  }

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
      <PageHeader
        title="Lớp học"
        subtitle="Danh sách lớp học tại cơ sở"
        breadcrumbs={[{ label: 'Quản trị' }, { label: 'Lớp học' }]}
        actions={<Button label="+ Tạo lớp" size="sm" variant="primary" onClick={() => setCreateOpen(true)} />}
      />
      <DataTable<ClassRow>
        columns={COLUMNS}
        data={(data?.items as ClassRow[] | undefined) ?? []}
        loading={isLoading}
        error={error?.message}
        empty="Chưa có lớp học nào"
        onRowClick={(row) => void navigate(`/admin/classes/${row.id}`)}
      />

      {/* Create dialog — classBatch.create gộp sẵn tạo lớp + ScheduleSlot +
          sinh ClassSession trong 1 transaction (class-batch-router.ts); kết
          quả trả về slotsCreated/sessionsCreated hiển thị ngay sau khi tạo. */}
      <Dialog
        isOpen={createOpen}
        onOpenChange={(next) => {
          if (!next) closeCreateDialog();
        }}
        purpose="form"
        width={560}
      >
        <DialogHeader
          title="Tạo lớp học"
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
                description={`Đã sinh ${createResult.slotsCreated} khung giờ và ${createResult.sessionsCreated} buổi học.`}
              />
              <HStack justify="end" gap={1}>
                <Button label="Đóng" variant="secondary" onClick={closeCreateDialog} />
                <Button
                  label="Xem lớp"
                  variant="primary"
                  onClick={() => {
                    const id = createResult.classBatchId;
                    closeCreateDialog();
                    void navigate(`/admin/classes/${id}`);
                  }}
                />
              </HStack>
            </Stack>
          ) : (
            <>
              {courseError && (
                <Banner
                  status="error"
                  title="Không tải được danh sách khoá học"
                  description={courseError.message}
                />
              )}

              <Selector
                label="Khoá học"
                placeholder={courseLoading ? 'Đang tải…' : 'Chọn khoá học'}
                isRequired
                options={courseOptions}
                value={form.courseId || undefined}
                onChange={(v) => setField('courseId')(v ?? '')}
                hasSearch
                hasClear={false}
                isDisabled={courseLoading}
                status={errors.courseId ? { type: 'error', message: errors.courseId } : undefined}
              />

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

              <HStack justify="end" gap={1} style={{ marginTop: 8 }}>
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
