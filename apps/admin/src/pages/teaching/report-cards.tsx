// Report cards / Nhận xét AI — staff workflow:
//   1. Search student by name or parent phone.
//   2. Select student + enter period (YYYY-MM).
//   3. Click "Tạo nháp AI" → assessment.draftComment creates AI draft (status: 'draft').
//   4. Teacher reviews and edits content in textarea.
//   5. Click "Xác nhận & Phát hành" → assessment.confirm(assessmentId, editedContent).
//
// Invariant: AI draft content is NEVER published without teacher confirmation.
// Label "Nháp AI — chưa phát hành" is shown clearly while content is in draft state.
// Draft content is shown read-only in a separate area; editable copy is in the textarea.

import { useState } from 'react';
import { Alert, Button, Group, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { DataTable, PageHeader } from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

interface StudentSearchRow {
  id: string;
  fullName: string;
  lifecycle: string;
  [key: string]: unknown;
}

const STUDENT_COLS: TableColumn<StudentSearchRow>[] = [
  { key: 'fullName', label: 'Họ tên' },
  { key: 'lifecycle', label: 'Trạng thái', width: 130 },
];

const PERIOD_PATTERN = /^\d{4}-\d{2}$/;

export default function ReportCardsPage() {
  // Step 1: student search
  const [searchInput, setSearchInput] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchRow | null>(null);

  // Step 2: period selection
  const [period, setPeriod] = useState('');

  // Step 3: draft state
  const [draftId, setDraftId] = useState<string | null>(null);
  const [aiRawContent, setAiRawContent] = useState('');   // read-only reference
  const [editContent, setEditContent] = useState('');      // teacher-editable copy

  // Step 4: post-confirm feedback
  const [confirmed, setConfirmed] = useState(false);

  // Detect phone (starts with digit) vs name.
  const lookupInput = /^\d/.test(submittedSearch)
    ? { phone: submittedSearch }
    : { name: submittedSearch };

  const { data: searchResults, isLoading: searching } =
    trpc.student.lookup.useQuery(lookupInput, {
      enabled: submittedSearch.length >= 2,
    });

  const draftMut = trpc.assessment.draftComment.useMutation({
    onSuccess: (data) => {
      setDraftId(data.id);
      setAiRawContent(data.content);
      setEditContent(data.content); // pre-fill editable area with AI draft
      setConfirmed(false);
    },
  });

  const confirmMut = trpc.assessment.confirm.useMutation({
    onSuccess: () => {
      setConfirmed(true);
      setDraftId(null);
      setAiRawContent('');
      setEditContent('');
      setPeriod('');
    },
  });

  function handleSearch() {
    const q = searchInput.trim();
    if (q.length < 2) return;
    setSubmittedSearch(q);
    setSelectedStudent(null);
    setDraftId(null);
    setConfirmed(false);
  }

  function handleSelectStudent(row: StudentSearchRow) {
    setSelectedStudent(row);
    setDraftId(null);
    setConfirmed(false);
  }

  function handleCreateDraft() {
    if (!selectedStudent || !PERIOD_PATTERN.test(period)) return;
    draftMut.mutate({ studentId: selectedStudent.id, period });
  }

  function handleConfirm() {
    if (!draftId || !editContent.trim()) return;
    confirmMut.mutate({ assessmentId: draftId, content: editContent.trim() });
  }

  function handleCancelDraft() {
    setDraftId(null);
    setAiRawContent('');
    setEditContent('');
  }

  function handleChangeStudent() {
    setSelectedStudent(null);
    setDraftId(null);
    setAiRawContent('');
    setEditContent('');
    setConfirmed(false);
  }

  return (
    <>
      <PageHeader
        title="Học bạ / Nhận xét"
        subtitle="Soạn và xác nhận nhận xét AI cho học viên"
        breadcrumbs={[{ label: 'Quản trị' }, { label: 'Học bạ' }]}
      />

      <Stack p="md" gap="md" maw={680}>

        {/* ── Step 1: Search ──────────────────────────────────── */}
        <Stack gap="xs">
          <Text fz="sm" fw={600}>Bước 1 — Tìm học viên</Text>
          <Group gap="sm">
            <TextInput
              placeholder="Nhập tên hoặc SĐT phụ huynh…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{ flex: 1 }}
              size="sm"
            />
            <Button
              size="sm"
              onClick={handleSearch}
              disabled={searchInput.trim().length < 2}
            >
              Tìm
            </Button>
          </Group>
        </Stack>

        {/* Search results (only when no student is selected) */}
        {submittedSearch.length >= 2 && !selectedStudent && (
          <DataTable<StudentSearchRow>
            columns={STUDENT_COLS}
            data={(searchResults as StudentSearchRow[] | undefined) ?? []}
            loading={searching}
            empty="Không tìm thấy học viên"
            onRowClick={handleSelectStudent}
          />
        )}

        {/* ── Step 2: Period + Draft ───────────────────────────── */}
        {selectedStudent && (
          <Stack gap="xs">
            <Text fz="sm" fw={600}>Bước 2 — Chọn kỳ và tạo nháp AI</Text>
            <Group gap="sm" align="center">
              <Text fz="sm">
                Học viên: <strong>{selectedStudent.fullName}</strong>
              </Text>
              <Button size="xs" variant="subtle" onClick={handleChangeStudent}>
                Đổi
              </Button>
            </Group>
            <Group gap="sm" align="flex-end">
              <TextInput
                label="Kỳ (YYYY-MM)"
                placeholder="2026-07"
                value={period}
                onChange={(e) => setPeriod(e.currentTarget.value)}
                size="sm"
                style={{ width: 160 }}
                error={period && !PERIOD_PATTERN.test(period) ? 'Định dạng YYYY-MM' : undefined}
              />
              <Button
                size="sm"
                onClick={handleCreateDraft}
                loading={draftMut.isPending}
                disabled={!PERIOD_PATTERN.test(period) || Boolean(draftId)}
              >
                Tạo nháp AI
              </Button>
            </Group>
            {draftMut.error && (
              <Text fz="sm" c="red">{draftMut.error.message}</Text>
            )}
          </Stack>
        )}

        {/* ── Step 3: Review + Edit + Confirm ─────────────────── */}
        {draftId && (
          <Stack gap="sm">
            <Alert color="yellow" title="Nháp AI — chưa phát hành" radius="xs">
              Nội dung dưới đây do AI tạo ra. Giáo viên phải xem xét, chỉnh sửa nếu cần,
              rồi bấm <strong>Xác nhận &amp; Phát hành</strong>. Nội dung sẽ chỉ hiện cho
              phụ huynh sau khi được xác nhận.
            </Alert>

            {/* AI raw — read-only reference */}
            <Stack gap={4}>
              <Text fz="xs" tt="uppercase" c="dimmed" fw={600}>
                Nháp gốc từ AI (chỉ đọc)
              </Text>
              <Textarea
                value={aiRawContent}
                readOnly
                minRows={4}
                autosize
                styles={{ input: { background: 'var(--mantine-color-gray-0)', color: 'var(--mantine-color-dimmed)' } }}
              />
            </Stack>

            {/* Editable copy */}
            <Stack gap={4}>
              <Text fz="xs" tt="uppercase" c="dimmed" fw={600}>
                Nội dung sau chỉnh sửa (sẽ được phát hành)
              </Text>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.currentTarget.value)}
                minRows={4}
                autosize
                placeholder="Chỉnh sửa nội dung nhận xét tại đây…"
              />
            </Stack>

            {confirmMut.error && (
              <Text fz="sm" c="red">{confirmMut.error.message}</Text>
            )}

            <Group gap="sm">
              <Button
                color="green"
                radius="xs"
                onClick={handleConfirm}
                loading={confirmMut.isPending}
                disabled={!editContent.trim()}
              >
                Xác nhận &amp; Phát hành
              </Button>
              <Button
                variant="default"
                radius="xs"
                onClick={handleCancelDraft}
                disabled={confirmMut.isPending}
              >
                Hủy nháp
              </Button>
            </Group>
          </Stack>
        )}

        {/* ── Step 4: Success ─────────────────────────────────── */}
        {confirmed && (
          <Alert color="green" title="Đã phát hành" radius="xs">
            Nhận xét đã được xác nhận. Phụ huynh có thể xem trong ứng dụng.
          </Alert>
        )}

      </Stack>
    </>
  );
}
