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
import { Banner, Button, DataTable, HStack, PageHeader, Stack, Text, TextArea, TextInput } from '@cmc/ui';
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

      <Stack gap={4} style={{ padding: 16, maxWidth: 680 }}>

        {/* ── Step 1: Search ──────────────────────────────────── */}
        <Stack gap={1}>
          <Text size="sm" weight="semibold">Bước 1 — Tìm học viên</Text>
          <HStack gap={2}>
            <div style={{ flex: 1 }}>
              {/* TODO(astryx-review): `label` is required by TextInput's
                  props but the step heading above already names the field —
                  passed as an empty string to avoid a duplicate visible
                  label; flagged for reviewer to confirm it renders without
                  adding empty label spacing. */}
              <TextInput
                label="Tìm kiếm phụ huynh"
                isLabelHidden
                placeholder="Nhập tên hoặc SĐT phụ huynh…"
                value={searchInput}
                onChange={(value) => setSearchInput(value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                size="sm"
              />
            </div>
            <Button
              label="Tìm"
              size="sm"
              variant="primary"
              onClick={handleSearch}
              isDisabled={searchInput.trim().length < 2}
            />
          </HStack>
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
          <Stack gap={1}>
            <Text size="sm" weight="semibold">Bước 2 — Chọn kỳ và tạo nháp AI</Text>
            <HStack gap={2} align="center">
              <Text size="sm">
                Học viên: <Text weight="bold" size="sm">{selectedStudent.fullName}</Text>
              </Text>
              <Button label="Đổi" size="sm" variant="ghost" onClick={handleChangeStudent} />
            </HStack>
            <HStack gap={2} align="end">
              <div style={{ width: 160 }}>
                <TextInput
                  label="Kỳ (YYYY-MM)"
                  placeholder="2026-07"
                  value={period}
                  onChange={(value) => setPeriod(value)}
                  size="sm"
                  status={period && !PERIOD_PATTERN.test(period) ? { type: 'error', message: 'Định dạng YYYY-MM' } : undefined}
                />
              </div>
              <Button
                label="Tạo nháp AI"
                size="sm"
                variant="primary"
                onClick={handleCreateDraft}
                isLoading={draftMut.isPending}
                isDisabled={!PERIOD_PATTERN.test(period) || Boolean(draftId)}
              />
            </HStack>
            {draftMut.error && (
              <Banner status="error" title={draftMut.error.message} />
            )}
          </Stack>
        )}

        {/* ── Step 3: Review + Edit + Confirm ─────────────────── */}
        {draftId && (
          <Stack gap={2}>
            <Banner
              status="warning"
              title="Nháp AI — chưa phát hành"
              description={
                <>
                  Nội dung dưới đây do AI tạo ra. Giáo viên phải xem xét, chỉnh sửa nếu cần,
                  rồi bấm <strong>Xác nhận &amp; Phát hành</strong>. Nội dung sẽ chỉ hiện cho
                  phụ huynh sau khi được xác nhận.
                </>
              }
            />

            {/* AI raw — read-only reference */}
            <Stack gap={0.5}>
              <Text type="supporting" size="xsm" weight="semibold" style={{ textTransform: 'uppercase' }}>
                Nháp gốc từ AI (chỉ đọc)
              </Text>
              {/* TODO(astryx-review): Astryx TextArea has no confirmed
                  read-only/autosize props (unused elsewhere in the migrated
                  codebase) — `isDisabled` used to keep this field
                  non-editable, closest available prop to Mantine's readOnly.
                  `label` is required but the heading above already names
                  the field — passed as empty string on both TextAreas below
                  to avoid a duplicate visible label (flagged for reviewer). */}
              <TextArea
                label="Nội dung do AI tạo"
                isLabelHidden
                value={aiRawContent}
                onChange={() => {}}
                isDisabled
                rows={4}
              />
            </Stack>

            {/* Editable copy */}
            <Stack gap={0.5}>
              <Text type="supporting" size="xsm" weight="semibold" style={{ textTransform: 'uppercase' }}>
                Nội dung sau chỉnh sửa (sẽ được phát hành)
              </Text>
              <TextArea
                label="Nội dung sau chỉnh sửa"
                isLabelHidden
                value={editContent}
                onChange={(value) => setEditContent(value)}
                rows={4}
                placeholder="Chỉnh sửa nội dung nhận xét tại đây…"
              />
            </Stack>

            {confirmMut.error && (
              <Banner status="error" title={confirmMut.error.message} />
            )}

            <HStack gap={2}>
              <Button
                label="Xác nhận & Phát hành"
                variant="primary"
                onClick={handleConfirm}
                isLoading={confirmMut.isPending}
                isDisabled={!editContent.trim()}
              />
              <Button
                label="Hủy nháp"
                variant="secondary"
                onClick={handleCancelDraft}
                isDisabled={confirmMut.isPending}
              />
            </HStack>
          </Stack>
        )}

        {/* ── Step 4: Success ─────────────────────────────────── */}
        {confirmed && (
          <Banner status="success" title="Đã phát hành" description="Nhận xét đã được xác nhận. Phụ huynh có thể xem trong ứng dụng." />
        )}

      </Stack>
    </>
  );
}
