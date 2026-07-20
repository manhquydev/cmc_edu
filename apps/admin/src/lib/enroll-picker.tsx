import { Dialog, DialogHeader, HStack, Spinner, Stack, Text } from '@cmc/ui';
import { useNavigate } from 'react-router-dom';
import { trpc } from './trpc.js';

// TODO(astryx-review): Astryx `Dialog` (native <dialog>-based) manages its own
// focus-trap, auto-focus-on-open, and Escape/backdrop-dismiss behavior
// internally — different implementation from the prior `Modal` (though the
// resulting UX — click backdrop or press Escape to close, same as before —
// is preserved via `purpose="info"`, the default). Flagged per migration
// instructions as "any modal that isn't a simple confirm" for reviewer
// sign-off rather than silently assuming parity with the old focus-trap.
export function EnrollPicker({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { data, isLoading } = trpc.crm.opportunityList.useQuery(
    { stage: 'O4_TESTED', pageSize: 50, lost: 'exclude' },
    { enabled: opened },
  );

  const items = (data?.items ?? []).filter((o) => !o.closedAt);

  return (
    <Dialog isOpen={opened} onOpenChange={(next) => { if (!next) onClose(); }} width={480}>
      <DialogHeader title="Chọn cơ hội để ghi danh" onOpenChange={(next) => { if (!next) onClose(); }} />
      {isLoading && (
        <Stack hAlign="center" paddingBlock={5}>
          <Spinner size="sm" />
        </Stack>
      )}
      {!isLoading && items.length === 0 && (
        <Text type="supporting" size="sm" justify="center" display="block" style={{ paddingBlock: 20 }}>
          Không có cơ hội O4 nào sẵn sàng ghi danh.
        </Text>
      )}
      <Stack gap={2}>
        {items.map((opp) => (
          <div
            key={opp.id}
            onClick={() => {
              onClose();
              void navigate(`/finance/new?opportunityId=${opp.id}`);
            }}
            style={{
              padding: '10px 12px',
              border: '1px solid var(--cmc-border)',
              borderRadius: 'var(--cmc-radius-xs)',
              cursor: 'pointer',
            }}
          >
            <HStack justify="between">
              <Stack gap={0.5}>
                <Text size="sm" weight="semibold">{opp.contact.name}</Text>
                <Text type="supporting" size="xsm">{opp.contact.phone}</Text>
              </Stack>
              <Text size="xsm" color="accent">Ghi danh →</Text>
            </HStack>
          </div>
        ))}
      </Stack>
    </Dialog>
  );
}
