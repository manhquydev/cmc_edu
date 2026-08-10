import { useState } from 'react';
import { Banner, Button, Dialog, DialogHeader, HStack, Selector, Stack, TextInput } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useOpportunityActions } from './use-opportunity-actions.js';

// Lead source (phase-10) — mirrors the API's `SOURCE_VALUES` enum
// (apps/api/src/crm/router.ts), enforced there only (no DB enum, KISS).
// Exported so opportunity-detail.tsx can reuse the same label map, matching
// the LOST_REASON_LABELS pattern in mark-lost-dialog.tsx.
export type SourceKey = 'referral' | 'walkin' | 'fanpage' | 'hotline' | 'event' | 'other';

const SOURCE_OPTIONS: { value: SourceKey; label: string }[] = [
  { value: 'referral', label: 'Giới thiệu' },
  { value: 'walkin', label: 'Vãng lai' },
  { value: 'fanpage', label: 'Fanpage' },
  { value: 'hotline', label: 'Hotline' },
  { value: 'event', label: 'Sự kiện' },
  { value: 'other', label: 'Khác' },
];

export const SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  SOURCE_OPTIONS.map((o) => [o.value, o.label]),
);

interface CreateLeadForm {
  name: string;
  phone: string;
  email: string;
  source: SourceKey | '';
}

const EMPTY_FORM: CreateLeadForm = { name: '', phone: '', email: '', source: '' };

/**
 * Create-lead modal — pipeline header action. Creates an O1_LEAD opportunity.
 * Phone-blur dedup check (QD 0037) is non-blocking: a match only shows a
 * warning, submit stays available (the sale rep decides whether it is a
 * genuine new lead or an existing contact).
 */
export function CreateLeadDialog({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [form, setForm] = useState<CreateLeadForm>(EMPTY_FORM);
  const [lookupPhone, setLookupPhone] = useState('');
  const { createMutation } = useOpportunityActions();

  const { data: lookupData } = trpc.crm.opportunityLookup.useQuery(
    { phone: lookupPhone },
    { enabled: lookupPhone.length >= 8 },
  );

  function close() {
    setForm(EMPTY_FORM);
    setLookupPhone('');
    createMutation.reset();
    onClose();
  }

  function handleSubmit() {
    createMutation.mutate(
      {
        contactName: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        source: form.source || undefined,
      },
      { onSuccess: close },
    );
  }

  const isValid = form.name.trim().length > 0 && form.phone.trim().length > 0;

  return (
    <Dialog
      isOpen={opened}
      onOpenChange={(next) => {
        if (!next && !createMutation.isPending) close();
      }}
      purpose="form"
      width={400}
    >
      <DialogHeader
        title="Thêm cơ hội mới"
        onOpenChange={(next) => {
          if (!next && !createMutation.isPending) close();
        }}
      />
      <Stack gap={2} padding={4}>
        <TextInput
          label="Họ tên"
          value={form.name}
          onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          isRequired
        />
        <TextInput
          label="Số điện thoại"
          value={form.phone}
          onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
          onBlur={() => setLookupPhone(form.phone.trim())}
          isRequired
        />
        <TextInput
          label="Email"
          type="email"
          placeholder="tuỳ chọn"
          value={form.email}
          onChange={(v) => setForm((f) => ({ ...f, email: v }))}
        />
        <Selector
          label="Nguồn"
          placeholder="Chọn nguồn (tuỳ chọn)"
          options={SOURCE_OPTIONS}
          value={form.source}
          onChange={(v) => setForm((f) => ({ ...f, source: v as SourceKey }))}
        />
        {lookupData?.exists && (
          <Banner
            status="warning"
            title="SĐT đã có hồ sơ"
            description="Liên hệ này đã tồn tại trong hệ thống — vẫn có thể tạo cơ hội mới."
          />
        )}
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
