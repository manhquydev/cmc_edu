import { useState } from 'react';
import { Button, Dialog, DialogHeader, HStack, Selector, Stack, TextArea } from '@cmc/ui';
import { StudentPicker } from '../../lib/student-picker.js';
import type { PickedStudent } from '../../lib/student-picker.js';
import { useAfterSaleActions } from './use-after-sale-actions.js';

type Priority = 'low' | 'normal' | 'high';

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Thấp' },
  { value: 'normal', label: 'Bình thường' },
  { value: 'high', label: 'Cao' },
];

/** "Tạo case" dialog — pipeline header action on aftersale.tsx. Creates an
 * `open` after-sale case for the picked student. */
export function CreateAfterSaleCaseDialog({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [student, setStudent] = useState<PickedStudent | null>(null);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const { createMutation } = useAfterSaleActions();

  function close() {
    setStudent(null);
    setDescription('');
    setPriority('normal');
    createMutation.reset();
    onClose();
  }

  function handleSubmit() {
    if (!student || !description.trim()) return;
    createMutation.mutate(
      { studentId: student.id, description: description.trim(), priority },
      { onSuccess: close },
    );
  }

  const isValid = Boolean(student) && description.trim().length > 0;

  return (
    <Dialog
      isOpen={opened}
      onOpenChange={(next) => {
        if (!next && !createMutation.isPending) close();
      }}
      purpose="form"
      width={440}
    >
      <DialogHeader
        title="Tạo case chăm sóc sau bán"
        onOpenChange={(next) => {
          if (!next && !createMutation.isPending) close();
        }}
      />
      <Stack gap={2} padding={4}>
        <StudentPicker value={student} onChange={setStudent} />
        <TextArea
          label="Mô tả"
          placeholder="Mô tả vấn đề cần chăm sóc…"
          value={description}
          onChange={setDescription}
          rows={4}
          isRequired
        />
        <Selector
          label="Mức ưu tiên"
          isRequired
          options={PRIORITY_OPTIONS}
          value={priority}
          onChange={(v) => setPriority(v as Priority)}
        />
        {createMutation.error && (
          // TODO(astryx-review): Text color enum has no error/danger slot —
          // plain <span> with CSS var per migration flag rule (see users.tsx).
          <span style={{ fontSize: 'var(--cmc-font-size-data)', color: 'var(--cmc-danger)' }}>
            {createMutation.error.message}
          </span>
        )}
        <HStack justify="end" gap={1} style={{ marginTop: 'var(--cmc-space-2)' }}>
          <Button label="Hủy" variant="secondary" onClick={close} isDisabled={createMutation.isPending} />
          <Button
            label="Tạo"
            variant="primary"
            onClick={handleSubmit}
            isLoading={createMutation.isPending}
            isDisabled={!isValid}
          />
        </HStack>
      </Stack>
    </Dialog>
  );
}
