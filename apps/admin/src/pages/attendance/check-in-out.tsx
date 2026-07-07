// Chấm công IP — P05 (US-021).
//
// Key invariants:
// - IP-match state comes from backend (checkInOut.punch response). UI never
//   self-calculates whether the caller's IP is in any facility network.
// - On IP mismatch the backend returns an error; UI surfaces the manual-punch
//   fallback form. No penalty warning shown here — penalty is server-side.
// - Punch without an approved shift → backend records it; UI shows
//   "ghi nhận, chờ review" note only (no penalty banner).

import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { PageHeader } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

// ---------------------------------------------------------------------------
// Live clock (ICT)
// ---------------------------------------------------------------------------
function IctClock() {
  const fmtRef = useRef(
    new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
  );
  const [display, setDisplay] = useState(() => fmtRef.current.format(new Date()));

  useEffect(() => {
    const id = setInterval(() => setDisplay(fmtRef.current.format(new Date())), 1_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Text
      fz={26}
      fw={700}
      ta="center"
      style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--cmc-text)' }}
    >
      {display}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Manual punch form
// ---------------------------------------------------------------------------
function ManualPunchForm({ onClose }: { onClose: () => void }) {
  const [ticketDate, setTicketDate] = useState('');
  const [note, setNote] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const mut = trpc.manualPunch.create.useMutation({
    onSuccess() {
      setResult({ ok: true, text: 'Yêu cầu đã gửi, chờ quản lý trực tiếp duyệt.' });
      setTicketDate('');
      setNote('');
    },
    onError(err) {
      setResult({ ok: false, text: err.message ?? 'Lỗi không xác định.' });
    },
  });

  const dateFormatOk = /^\d{4}-\d{2}-\d{2}$/.test(ticketDate);

  return (
    <Paper withBorder p="md" radius="xs">
      <Stack gap="sm">
        <Text fw={600} fz="sm">
          Yêu cầu chấm công thủ công
        </Text>
        <Text fz="xs" c="dimmed">
          Dùng khi thiết bị nằm ngoài mạng WiFi cơ sở. Quản lý trực tiếp sẽ xét duyệt.
        </Text>
        <TextInput
          label="Ngày cần chấm (YYYY-MM-DD)"
          placeholder="2026-07-07"
          value={ticketDate}
          onChange={(e) => setTicketDate(e.currentTarget.value)}
          error={ticketDate && !dateFormatOk ? 'Định dạng không hợp lệ — dùng YYYY-MM-DD' : undefined}
          radius="xs"
          size="sm"
        />
        <Textarea
          label="Lý do"
          placeholder="Nêu lý do không thể chấm công qua IP cơ sở..."
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
          radius="xs"
          size="sm"
          rows={3}
          maxLength={2000}
        />
        {result && (
          <Alert color={result.ok ? 'green' : 'red'} radius="xs">
            {result.text}
          </Alert>
        )}
        <Group justify="flex-end" gap="xs">
          <Button
            variant="default"
            size="xs"
            radius="xs"
            onClick={() => { onClose(); setResult(null); }}
          >
            Đóng
          </Button>
          <Button
            size="xs"
            radius="xs"
            loading={mut.isPending}
            disabled={!dateFormatOk}
            onClick={() => mut.mutate({ ticketDate, note })}
          >
            Gửi yêu cầu
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
type PunchAlert =
  | { kind: 'none' }
  | { kind: 'success'; timeStr: string }
  | { kind: 'ip_fail' }
  | { kind: 'cooldown' }
  | { kind: 'error'; msg: string };

export default function CheckInOutPage() {
  const [punchAlert, setPunchAlert] = useState<PunchAlert>({ kind: 'none' });
  const [showManual, setShowManual] = useState(false);

  const punchMut = trpc.checkInOut.punch.useMutation({
    onSuccess(data) {
      // data.punchAt is a Date in the tRPC type, serialized as ISO string over HTTP.
      const at = new Date(data.punchAt as unknown as string).toLocaleTimeString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setPunchAlert({ kind: 'success', timeStr: at });
    },
    onError(err) {
      const msg = err.message ?? '';
      if (msg.includes('IP address not in any authorized network')) {
        setPunchAlert({ kind: 'ip_fail' });
        setShowManual(true);
      } else if (msg.toLowerCase().includes('cooldown')) {
        setPunchAlert({ kind: 'cooldown' });
      } else {
        setPunchAlert({ kind: 'error', msg });
      }
    },
  });

  return (
    <>
      <PageHeader
        title="Chấm công"
        subtitle="Điểm danh ca làm việc (IP cơ sở)"
        breadcrumbs={[{ label: 'HR' }, { label: 'Chấm công' }]}
      />
      <Box p="md" maw={520}>
        <Stack gap="md">
          {/* Clock + punch action */}
          <Paper withBorder p="xl" radius="xs">
            <Stack align="center" gap="lg">
              <IctClock />

              <Button
                size="xl"
                radius="xs"
                loading={punchMut.isPending}
                onClick={() => punchMut.mutate()}
              >
                Chấm công
              </Button>

              {punchAlert.kind === 'success' && (
                <Alert color="green" title="Đã ghi nhận" w="100%" radius="xs">
                  Chấm công lúc {punchAlert.timeStr}. Nếu chưa có ca đã duyệt, hệ thống ghi nhận
                  và chờ review — không áp phạt tự động.
                </Alert>
              )}
              {punchAlert.kind === 'ip_fail' && (
                <Alert color="orange" title="Ngoài mạng cơ sở" w="100%" radius="xs">
                  Thiết bị không khớp dải mạng WiFi cơ sở (máy chủ xác nhận). Dùng form
                  chấm công thủ công bên dưới.
                </Alert>
              )}
              {punchAlert.kind === 'cooldown' && (
                <Alert color="yellow" title="Chờ cooldown" w="100%" radius="xs">
                  Đã chấm công trong vòng 5 phút. Thử lại sau.
                </Alert>
              )}
              {punchAlert.kind === 'error' && (
                <Alert color="red" title="Lỗi chấm công" w="100%" radius="xs">
                  {punchAlert.msg}
                </Alert>
              )}
            </Stack>
          </Paper>

          {/* Punch-without-shift invariant note */}
          <Alert color="blue" variant="light" radius="xs">
            Nếu chưa có ca đã duyệt, hệ thống{' '}
            <Text span fw={600}>ghi nhận và chờ review</Text> — không tự áp phạt. Phạt (nếu
            có) chỉ được tính khi xử lý bảng lương cuối kỳ.
          </Alert>

          {/* Manual punch toggle */}
          {!showManual && (
            <Button
              variant="subtle"
              size="xs"
              radius="xs"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setShowManual(true)}
            >
              Gửi yêu cầu chấm công thủ công
            </Button>
          )}

          {showManual && <ManualPunchForm onClose={() => setShowManual(false)} />}
        </Stack>
      </Box>
    </>
  );
}
