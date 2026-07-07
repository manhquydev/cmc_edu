// Login page — two tabs: parent email-OTP | student phone+password.
//
// Security invariants enforced here:
//   - Parent email-OTP is BLOCKED-ON-COMMS (ConsoleEmailTransport stub).
//     A visible "[DEV ONLY - blocked-on-comms]" label is always shown.
//     Do NOT claim it works end-to-end.
//   - Generic error messages only — never expose whether a phone/email/account
//     exists (mirrors the backend no-leak contract).
//   - On successful student login with mustChangePassword=true, the session is
//     stored and the user is redirected to /student/change-password.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  PasswordInput,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { trpc } from '../lib/trpc.js';
import { useSession } from '../lib/session-context.js';
import { parseLmsToken } from '../lib/lms-session.js';

// ---------------------------------------------------------------------------
// Parent email-OTP tab
// ---------------------------------------------------------------------------

function ParentEmailOtpTab() {
  const { setSession } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [error, setError] = useState('');

  const requestMut = trpc.lmsAuth.requestOtpEmail.useMutation({
    onSuccess() {
      setStep('verify');
      setError('');
    },
    onError(_err) {
      setError('Không thể gửi mã. Vui lòng thử lại.');
    },
  });

  const verifyMut = trpc.lmsAuth.verifyOtpEmail.useMutation({
    onSuccess(data) {
      const parsed = parseLmsToken(data.sessionToken);
      setSession({
        kind: 'parent',
        parentAccountId: parsed?.parentAccountId ?? '',
        sessionToken: data.sessionToken,
        children: data.children,
      });
      navigate('/parent/home', { replace: true });
    },
    onError(_err) {
      setError('Mã không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.');
    },
  });

  return (
    <Stack gap="md">
      {/* BLOCKED-ON-COMMS notice — always visible, not collapsible */}
      <Alert color="orange" title="[DEV ONLY — blocked-on-comms]" variant="light">
        Email OTP đang dùng <strong>ConsoleEmailTransport</strong> (stub). Mã OTP chỉ
        xuất hiện trong console của server — <em>không gửi email thật</em>.
        Luồng này chưa hoạt động end-to-end cho production cho đến khi tích hợp
        Brevo/Graph credentials.
      </Alert>

      {step === 'request' ? (
        <>
          <TextInput
            label="Email phụ huynh"
            type="email"
            placeholder="parent@example.com"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            autoComplete="email"
          />
          {error && <Alert color="red" variant="light">{error}</Alert>}
          <Button
            fullWidth
            loading={requestMut.isPending}
            onClick={() => {
              setError('');
              requestMut.mutate({ email });
            }}
            disabled={!email}
          >
            Gửi mã OTP
          </Button>
        </>
      ) : (
        <>
          <Text size="sm" c="dimmed">
            Mã OTP đã được gửi (xem console server trong môi trường dev). Nhập mã 6 chữ số:
          </Text>
          <TextInput
            label="Mã OTP (6 số)"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.currentTarget.value)}
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          {error && <Alert color="red" variant="light">{error}</Alert>}
          <Button
            fullWidth
            loading={verifyMut.isPending}
            onClick={() => {
              setError('');
              verifyMut.mutate({ email, code });
            }}
            disabled={code.length !== 6}
          >
            Xác nhận mã
          </Button>
          <Button variant="subtle" size="xs" onClick={() => { setStep('request'); setError(''); }}>
            ← Nhập lại email
          </Button>
        </>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Student phone+password tab
// ---------------------------------------------------------------------------

function StudentLoginTab() {
  const { setSession } = useSession();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMut = trpc.lmsAuth.loginStudent.useMutation({
    onSuccess(data) {
      const parsed = parseLmsToken(data.sessionToken);
      setSession({
        kind: 'student',
        parentAccountId: parsed?.parentAccountId ?? '',
        studentId: data.studentId,
        sessionToken: data.sessionToken,
        mustChangePassword: data.mustChangePassword,
      });
      if (data.mustChangePassword) {
        navigate('/student/change-password', { replace: true });
      } else {
        navigate('/student/home', { replace: true });
      }
    },
    onError(_err) {
      setError('Thông tin đăng nhập không đúng.');
    },
  });

  return (
    <Stack gap="md">
      <TextInput
        label="Số điện thoại phụ huynh"
        placeholder="0912345678"
        value={phone}
        onChange={(e) => setPhone(e.currentTarget.value)}
        inputMode="tel"
        autoComplete="tel"
      />
      <PasswordInput
        label="Mật khẩu"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.currentTarget.value)}
        autoComplete="current-password"
      />
      {error && <Alert color="red" variant="light">{error}</Alert>}
      <Button
        fullWidth
        loading={loginMut.isPending}
        onClick={() => {
          setError('');
          loginMut.mutate({ phone, password });
        }}
        disabled={!phone || !password}
      >
        Đăng nhập
      </Button>
      <Text size="xs" c="dimmed" ta="center">
        Mật khẩu mặc định: <strong>Cmc2026@</strong> — phải đổi lần đầu đăng nhập.
      </Text>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Dev header writer (dev/e2e only)
// ---------------------------------------------------------------------------

function DevHeaderWriter() {
  const { setSession } = useSession();
  const navigate = useNavigate();
  const [raw, setRaw] = useState('');
  const [err, setErr] = useState('');

  function apply() {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const parentAccountId = parsed['parentAccountId'];
      const kind = parsed['kind'];
      const studentId = parsed['studentId'];
      if (typeof parentAccountId !== 'string' || !parentAccountId) {
        setErr('Cần parentAccountId (string).');
        return;
      }
      if (kind !== 'parent' && kind !== 'student') {
        setErr('kind phải là "parent" hoặc "student".');
        return;
      }
      setSession({
        kind,
        parentAccountId,
        studentId: typeof studentId === 'string' ? studentId : undefined,
        sessionToken: btoa(raw),
      });
      navigate(kind === 'parent' ? '/parent/home' : '/student/home', { replace: true });
    } catch {
      setErr('JSON không hợp lệ.');
    }
  }

  return (
    <Box mt="xl">
      <Divider label="Dev: x-dev-lms-user" labelPosition="center" my="md" />
      <Stack gap="xs">
        <Text size="xs" c="dimmed">
          Dán JSON header để mô phỏng phiên (dev/e2e only — bị vô hiệu trong production):
        </Text>
        <TextInput
          placeholder='{"parentAccountId":"uuid","kind":"parent"}'
          value={raw}
          onChange={(e) => { setRaw(e.currentTarget.value); setErr(''); }}
          size="xs"
          styles={{ input: { fontFamily: 'monospace', fontSize: '0.75rem' } }}
        />
        {err && <Text size="xs" c="red">{err}</Text>}
        <Button size="xs" variant="outline" onClick={apply} disabled={!raw}>
          Áp dụng header dev
        </Button>
      </Stack>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

export default function LoginPage() {
  const { session } = useSession();
  const navigate = useNavigate();

  // Already logged in — redirect away.
  if (session) {
    const dest = session.kind === 'parent' ? '/parent/home' : '/student/home';
    navigate(dest, { replace: true });
    return null;
  }

  return (
    <Box className="lms-shell" style={{ padding: '1.5rem 1rem' }}>
      <Stack gap="lg">
        <Group justify="center">
          <Title order={2} style={{ color: 'var(--cmc-brand)' }}>CMC EDU</Title>
          <Badge variant="outline" color="gray" size="sm">LMS</Badge>
        </Group>

        <Tabs defaultValue="student">
          <Tabs.List grow>
            <Tabs.Tab value="student">Học sinh</Tabs.Tab>
            <Tabs.Tab value="parent">
              Phụ huynh{' '}
              <Badge size="xs" color="orange" variant="filled" ml={4}>DEV</Badge>
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="student" pt="md">
            <StudentLoginTab />
          </Tabs.Panel>

          <Tabs.Panel value="parent" pt="md">
            <ParentEmailOtpTab />
          </Tabs.Panel>
        </Tabs>

        {/* Dev-only shortcut for e2e tests — gated to non-production builds */}
        {import.meta.env.DEV && <DevHeaderWriter />}
      </Stack>
    </Box>
  );
}
