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
  Banner,
  Button,
  Card,
  HStack,
  PageHeader,
  Stack,
  Text,
  TextArea,
  TextInput,
} from '@cmc/ui';
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
    <Text type="body" size="2xl" weight="bold" display="block" justify="center" hasTabularNumbers>
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
    <Card padding={3}>
      <Stack gap={2}>
        <Text type="body" size="sm" weight="semibold">
          Yêu cầu chấm công thủ công
        </Text>
        <Text type="supporting" size="2xs">
          Dùng khi thiết bị nằm ngoài mạng WiFi cơ sở. Quản lý trực tiếp sẽ xét duyệt.
        </Text>
        <TextInput
          label="Ngày cần chấm (YYYY-MM-DD)"
          placeholder="2026-07-07"
          value={ticketDate}
          onChange={(v) => setTicketDate(v)}
          status={
            ticketDate && !dateFormatOk
              ? { type: 'error', message: 'Định dạng không hợp lệ — dùng YYYY-MM-DD' }
              : undefined
          }
          size="sm"
        />
        <TextArea
          label="Lý do"
          placeholder="Nêu lý do không thể chấm công qua IP cơ sở..."
          value={note}
          onChange={(v) => setNote(v)}
          size="sm"
          rows={3}
          maxLength={2000}
        />
        {result && (
          <Banner status={result.ok ? 'success' : 'error'} title={result.text} />
        )}
        <HStack justify="end" gap={1}>
          <Button
            label="Đóng"
            variant="secondary"
            size="sm"
            onClick={() => { onClose(); setResult(null); }}
          />
          <Button
            label="Gửi yêu cầu"
            size="sm"
            isLoading={mut.isPending}
            isDisabled={!dateFormatOk}
            onClick={() => mut.mutate({ ticketDate, note })}
          />
        </HStack>
      </Stack>
    </Card>
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
      <div style={{ padding: 16, maxWidth: 520 }}>
        <Stack gap={3}>
          {/* Clock + punch action */}
          <Card padding={6}>
            <Stack hAlign="center" gap={4}>
              <IctClock />

              <Button
                label="Chấm công"
                size="lg"
                isLoading={punchMut.isPending}
                onClick={() => punchMut.mutate()}
              />

              {punchAlert.kind === 'success' && (
                <Banner
                  status="success"
                  title="Đã ghi nhận"
                  description={`Chấm công lúc ${punchAlert.timeStr}. Nếu chưa có ca đã duyệt, hệ thống ghi nhận và chờ review — không áp phạt tự động.`}
                />
              )}
              {punchAlert.kind === 'ip_fail' && (
                <Banner
                  status="warning"
                  title="Ngoài mạng cơ sở"
                  description="Thiết bị không khớp dải mạng WiFi cơ sở (máy chủ xác nhận). Dùng form chấm công thủ công bên dưới."
                />
              )}
              {punchAlert.kind === 'cooldown' && (
                <Banner
                  status="warning"
                  title="Chờ cooldown"
                  description="Đã chấm công trong vòng 5 phút. Thử lại sau."
                />
              )}
              {punchAlert.kind === 'error' && (
                <Banner status="error" title="Lỗi chấm công" description={punchAlert.msg} />
              )}
            </Stack>
          </Card>

          {/* Punch-without-shift invariant note */}
          <Banner
            status="info"
            title="Ghi nhận không cần ca"
            description={
              <>
                Nếu chưa có ca đã duyệt, hệ thống{' '}
                <Text type="body" size="sm" weight="semibold" as="span">
                  ghi nhận và chờ review
                </Text>{' '}
                — không tự áp phạt. Phạt (nếu có) chỉ được tính khi xử lý bảng lương cuối kỳ.
              </>
            }
          />

          {/* Manual punch toggle */}
          {!showManual && (
            <Button
              label="Gửi yêu cầu chấm công thủ công"
              variant="ghost"
              size="sm"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setShowManual(true)}
            />
          )}

          {showManual && <ManualPunchForm onClose={() => setShowManual(false)} />}
        </Stack>
      </div>
    </>
  );
}
