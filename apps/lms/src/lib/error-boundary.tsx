// React ErrorBoundary — last-resort capture for render/lifecycle crashes.
//
// Reports through reportError() with kind 'react-boundary', shows the user a
// minimal fallback with the correlation code + a reload button (the stack is
// NEVER shown to the user — they only need the code to report to support).
// ErrorBoundary does not catch event-handler or async errors; those are
// covered by the window.onerror / unhandledrejection handlers in main.tsx.

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Heading, Stack, Text } from '@cmc/ui';
import { generateErrorCode, reportError } from './error-report.js';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  code: string | null;
}

const fallbackShellStyle: React.CSSProperties = {
  minHeight: '100dvh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--cmc-space-4)',
  background: 'var(--cmc-surface-2)',
  fontFamily: 'var(--cmc-font-sans)',
  color: 'var(--cmc-text)',
};

const fallbackCardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 420,
  background: 'var(--cmc-surface)',
  border: '1px solid var(--cmc-border)',
  borderRadius: 'var(--cmc-radius-md)',
  padding: 'var(--cmc-space-4)',
};

function ErrorFallback({ code, onReload }: { code: string; onReload: () => void }) {
  return (
    <div data-astryx-theme="neutral" style={fallbackShellStyle}>
      <div style={fallbackCardStyle}>
        <Stack gap={3}>
          <Heading level={4} style={{ margin: 0 }}>
            Đã có sự cố
          </Heading>
          <Text type="supporting" size="sm">
            Ứng dụng gặp lỗi không mong muốn. Vui lòng tải lại trang. Nếu lỗi tiếp
            diễn, hãy gửi mã bên dưới cho bộ phận hỗ trợ.
          </Text>
          <Text weight="bold" display="block" style={{ letterSpacing: '0.08em' }}>
            Mã lỗi: {code}
          </Text>
          <Button variant="primary" label="Tải lại trang" onClick={onReload} />
        </Stack>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, code: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const code = generateErrorCode();
    this.setState({ code });
    console.error('[error-boundary]', code, error, info.componentStack);
    reportError({
      code,
      message: error?.message ?? String(error),
      stack: error?.stack ?? null,
      kind: 'react-boundary',
      extra: { componentStack: info.componentStack ?? null },
    });
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <ErrorFallback
          code={this.state.code ?? ''}
          onReload={() => window.location.reload()}
        />
      );
    }
    return this.props.children;
  }
}
