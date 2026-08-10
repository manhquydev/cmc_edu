import { useEffect, useState } from 'react';
import { HStack, Spinner, Stack, Text, TextInput } from '@cmc/ui';
import { trpc } from './trpc.js';

export interface PickedStudent {
  id: string;
  fullName: string;
}

interface StudentPickerProps {
  value: PickedStudent | null;
  onChange: (student: PickedStudent | null) => void;
  label?: string;
}

/**
 * Reusable inline student search-and-pick control (afterSale case create,
 * parentMeeting schedule). Searches `student.lookup` by name OR phone through
 * a single search box — a digit-heavy term (>=3 digits, ignoring spaces/
 * dashes) is sent as `phone`, everything else as `name` (class-placement.tsx
 * disambiguates the same query shape with an explicit phone/name toggle;
 * collapsed into one field here since these callers just need a compact
 * picker inside an existing form dialog, not its own wizard step).
 *
 * Debounced ~300ms; the query is enabled only once a non-empty term exists.
 */
export function StudentPicker({ value, onChange, label = 'Học viên' }: StudentPickerProps) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(timer);
  }, [term]);

  const digitsOnly = debounced.replace(/[\s-]/g, '');
  const lookupInput = !debounced
    ? null
    : /^\d{3,}$/.test(digitsOnly)
      ? { phone: digitsOnly }
      : { name: debounced };

  const { data, isFetching } = trpc.student.lookup.useQuery(
    // Non-null assertion is safe: query is disabled when lookupInput is null
    // (same pattern as class-placement.tsx's on-demand lookup).
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    lookupInput!,
    { enabled: lookupInput !== null },
  );

  if (value) {
    return (
      <Stack gap={0.5}>
        <Text type="supporting" size="xsm">
          {label}
        </Text>
        <HStack
          justify="between"
          align="center"
          style={{
            padding: 'var(--cmc-space-2) 12px',
            border: '1px solid var(--cmc-border)',
            borderRadius: 'var(--cmc-radius-xs)',
          }}
        >
          <Text size="sm" weight="semibold">
            {value.fullName}
          </Text>
          {/* TODO(astryx-review): Text has no clickable-link affordance —
              plain <span> with brand color per the documented raw-color
              fallback (see class-placement.tsx's "tạo phiếu thu mới" link). */}
          <span
            style={{ fontSize: 'var(--cmc-fs-meta)', color: 'var(--cmc-brand)', cursor: 'pointer' }}
            onClick={() => {
              onChange(null);
              setTerm('');
            }}
          >
            Đổi
          </span>
        </HStack>
      </Stack>
    );
  }

  return (
    <Stack gap={1}>
      <TextInput
        label={label}
        placeholder="Tìm theo tên hoặc SĐT…"
        value={term}
        onChange={setTerm}
        isRequired
      />
      {isFetching && (
        <HStack gap={1} align="center">
          <Spinner size="sm" />
          <Text type="supporting" size="xsm">
            Đang tìm...
          </Text>
        </HStack>
      )}
      {!isFetching && debounced && data && data.length === 0 && (
        <Text type="supporting" size="xsm">
          Không tìm thấy học viên.
        </Text>
      )}
      {!isFetching && data && data.length > 0 && (
        <Stack gap={0.5}>
          {data.map((s) => (
            <div
              key={s.id}
              onClick={() => onChange({ id: s.id, fullName: s.fullName })}
              style={{
                padding: 'var(--cmc-space-2) 12px',
                border: '1px solid var(--cmc-border)',
                borderRadius: 'var(--cmc-radius-xs)',
                cursor: 'pointer',
              }}
            >
              <Text size="sm">{s.fullName}</Text>
            </div>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
