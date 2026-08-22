// Login page — three tabs: student password | parent email-OTP | family password.
//
// Security invariants enforced here:
//   - Parent email-OTP uses BrevoEmailTransport in prod (console is
//     dev/test only). A "[DEV ONLY]" banner is shown only when
//     `import.meta.env.DEV` is true — not in production builds.
//   - Generic error messages only — never expose whether a phone/email/account
//     exists (mirrors the backend no-leak contract).
//   - On successful student login with mustChangePassword=true, the session is
//     stored and the user is redirected to /student/change-password.
//   - Auth-field hardening attrs preserved across the Astryx migration
//     (TL12 §9, red-team F11 / AC#5): OTP field autoComplete="one-time-code" +
//     inputMode="numeric" + maxLength={6}; password autoComplete;
//     phone inputMode="tel"; email type. Carried via @cmc/ui TextField /
//     PasswordInput (which forward these input attrs — Astryx TextInput's type
//     omits them).

import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  Badge,
  Banner,
  Button,
  Divider,
  PasswordInput,
  Stack,
  Tab,
  TabList,
  Text,
  TextField,
  Heading,
} from '@cmc/ui';
import { setActiveStudentId, trpc } from '../lib/trpc.js';
import { useSession } from '../lib/session-context.js';
import { parseLmsToken } from '../lib/lms-session.js';
import { isParentDoorKind } from '../lib/lms-kind.js';

const fullWidth = { width: '100%' } as const;

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
    <Stack gap={2}>
      {/* Dev-only notice — gated to non-production builds, mirrors DevHeaderWriter below */}
      {import.meta.env.DEV && (
        <Banner
          status="warning"
          title="[DEV ONLY]"
          description="Luồng xác thực qua email chưa hoạt động end-to-end. Mã xác thực chỉ hiển thị trong log máy chủ khi chạy dev."
        />
      )}

      {step === 'request' ? (
        <>
          <TextField
            label="Email phụ huynh"
            type="email"
            placeholder="parent@example.com"
            value={email}
            onChange={(value) => setEmail(value)}
            autoComplete="email"
          />
          {error && <Banner status="error" title={error} />}
          <Button
            style={fullWidth}
            label="Gửi mã OTP"
            isLoading={requestMut.isPending}
            isDisabled={!email}
            onClick={() => {
              setError('');
              requestMut.mutate({ email });
            }}
          />
        </>
      ) : (
        <>
          <Text type="supporting" size="sm">
            Mã OTP đã được gửi (xem console server trong môi trường dev). Nhập mã 6 chữ số:
          </Text>
          <TextField
            label="Mã OTP (6 số)"
            placeholder="123456"
            value={code}
            onChange={(value) => setCode(value)}
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          {error && <Banner status="error" title={error} />}
          <Button
            style={fullWidth}
            label="Xác nhận mã"
            isLoading={verifyMut.isPending}
            isDisabled={code.length !== 6}
            onClick={() => {
              setError('');
              verifyMut.mutate({ email, code });
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            label="← Nhập lại email"
            onClick={() => {
              setStep('request');
              setError('');
            }}
          />
        </>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Family phone+password tab (additive — OTP / student tabs stay)
// ---------------------------------------------------------------------------

function FamilyLoginTab() {
  const { setSession } = useSession();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMut = trpc.lmsAuth.familyLogin.useMutation({
    onSuccess(data) {
      const parsed = parseLmsToken(data.sessionToken);
      setSession({
        kind: 'family',
        parentAccountId: parsed?.parentAccountId ?? '',
        sessionToken: data.sessionToken,
        children: data.children,
        mustChangePassword: data.mustChangePassword,
      });
      if (data.mustChangePassword) {
        navigate('/doi-mat-khau-gia-dinh', { replace: true });
      } else if (data.needsPicker) {
        navigate('/select-profile', { replace: true });
      } else {
        if (data.children[0]) setActiveStudentId(data.children[0].studentId);
        navigate('/parent/home', { replace: true });
      }
    },
    onError() {
      setError('Thông tin đăng nhập không đúng.');
    },
  });

  return (
    <Stack gap={2}>
      <TextField
        label="Số điện thoại gia đình"
        placeholder="0912345678"
        value={phone}
        onChange={setPhone}
        inputMode="tel"
        autoComplete="tel"
      />
      <PasswordInput
        label="Mật khẩu gia đình"
        placeholder="••••••••"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />
      {error && <Banner status="error" title={error} />}
      <Button
        style={fullWidth}
        label="Đăng nhập gia đình"
        isLoading={loginMut.isPending}
        isDisabled={!phone || !password}
        onClick={() => {
          setError('');
          loginMut.mutate({ phone, password });
        }}
      />
      <Text type="supporting" size="2xs" justify="center" display="block">
        <Link to="/dat-lai-mat-khau-gia-dinh">Quên mật khẩu?</Link>
      </Text>
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
    <Stack gap={2}>
      <TextField
        label="Số điện thoại phụ huynh"
        placeholder="0912345678"
        value={phone}
        onChange={(value) => setPhone(value)}
        inputMode="tel"
        autoComplete="tel"
      />
      <PasswordInput
        label="Mật khẩu"
        placeholder="••••••••"
        value={password}
        onChange={(value) => setPassword(value)}
        autoComplete="current-password"
      />
      {error && <Banner status="error" title={error} />}
      <Button
        style={fullWidth}
        label="Đăng nhập"
        isLoading={loginMut.isPending}
        isDisabled={!phone || !password}
        onClick={() => {
          setError('');
          loginMut.mutate({ phone, password });
        }}
      />
      <Text type="supporting" size="2xs" justify="center" display="block">
        Học sinh mới cần mật khẩu mặc định — vui lòng liên hệ nhân viên tuyển sinh/CSKH để được cấp lại. Bắt buộc đổi mật khẩu ngay lần đăng nhập đầu tiên.
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
      if (kind !== 'parent' && kind !== 'student' && kind !== 'family') {
        setErr('kind phải là "parent", "student" hoặc "family".');
        return;
      }
      setSession({
        kind,
        parentAccountId,
        studentId: typeof studentId === 'string' ? studentId : undefined,
        sessionToken: btoa(raw),
      });
      navigate(kind === 'student' ? '/student/home' : '/parent/home', { replace: true });
    } catch {
      setErr('JSON không hợp lệ.');
    }
  }

  return (
    <div style={{ marginTop: 32 }}>
      <Divider label="Dev: x-dev-lms-user" />
      <Stack gap={1}>
        <Text type="supporting" size="2xs">
          Dán JSON header để mô phỏng phiên (dev/e2e only — bị vô hiệu trong production):
        </Text>
        <TextField
          label="Dev header JSON"
          isLabelHidden
          placeholder='{"parentAccountId":"uuid","kind":"parent"}'
          value={raw}
          onChange={(value) => {
            setRaw(value);
            setErr('');
          }}
          size="sm"
        />
        {err && (
          <Text type="supporting" size="2xs" style={{ color: 'var(--cmc-danger)' }}>
            {err}
          </Text>
        )}
        <Button variant="secondary" size="sm" label="Áp dụng header dev" isDisabled={!raw} onClick={apply} />
      </Stack>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

export default function LoginPage() {
  const { session } = useSession();
  const [tab, setTab] = useState<'student' | 'parent' | 'family'>('student');

  // Already logged in — redirect away. A `<Navigate>` element (NOT a
  // navigate() call in the render body) is the correct React Router pattern:
  // the old render-body navigate() was a side-effect-in-render that, on the
  // re-render triggered by setSession right after a student login, raced with
  // and CLOBBERED the login handler's own navigate() — sending a
  // mustChangePassword student to /student/home instead of the forced
  // change-password screen (P1-07). The dest must therefore also honor
  // mustChangePassword so this guard agrees with the login handler.
  if (session) {
    const dest = isParentDoorKind(session.kind)
      ? session.kind === 'family' && session.mustChangePassword === true
        ? '/doi-mat-khau-gia-dinh'
        : session.kind === 'family' && (session.children?.length ?? 0) >= 2
          ? '/select-profile'
          : '/parent/home'
      : session.mustChangePassword
        ? '/student/change-password'
        : '/student/home';
    return <Navigate to={dest} replace />;
  }

  return (
    <div className="lms-shell" style={{ padding: '1.5rem 1rem' }}>
      <Stack gap={3}>
        <Stack gap={1} hAlign="center">
          <Heading level={2} style={{ color: 'var(--cmc-brand)' }}>
            CMC EDU
          </Heading>
          <Badge label="LMS" variant="neutral" />
        </Stack>

        <TabList
          value={tab}
          onChange={(v) => setTab(v as 'student' | 'parent' | 'family')}
          layout="fill"
          hasDivider
        >
          <Tab value="student" label="Học sinh" />
          <Tab value="parent" label="Phụ huynh" endContent={<Badge label="DEV" variant="warning" />} />
          <Tab value="family" label="Gia đình" />
        </TabList>

        <div style={{ paddingTop: 16 }}>
          {tab === 'student' ? (
            <StudentLoginTab />
          ) : tab === 'parent' ? (
            <ParentEmailOtpTab />
          ) : (
            <FamilyLoginTab />
          )}
        </div>

        {/* Dev-only shortcut for e2e tests — gated to non-production builds */}
        {import.meta.env.DEV && <DevHeaderWriter />}
      </Stack>
    </div>
  );
}
