import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from '@cmc/ui';
import { generateErrorCode, reportError } from './error-report.js';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  /** 10-char [A-Z0-9] code surfaced to the user / matched against server logs. */
  code: string | null;
}

/**
 * Root error boundary — catches render/lifecycle errors, reports them through
 * reportError (kind 'react-boundary') and renders a minimal fallback with the
 * correlation code + reload button. The stack is never shown to the user;
 * console.error keeps the code grep-able for local debugging.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, code: null };

  static getDerivedStateFromError(): ErrorBoundaryState {
    // Generate the code during the render phase so the fallback paints with it
    // on the first frame; componentDidCatch reports the same code.
    return { hasError: true, code: generateErrorCode() };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const code = this.state.code ?? generateErrorCode();
    reportError({
      code,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      kind: 'react-boundary',
      extra: { componentStack: errorInfo.componentStack },
    });
    // Keep the console noisy for local debugging (code lets devs grep logs).
    console.error('[error-boundary]', { code, error, componentStack: errorInfo.componentStack });
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="error-boundary-fallback" data-astryx-theme="neutral" role="alert">
        <div className="error-boundary-fallback__card">
          <h1 className="error-boundary-fallback__title">Đã có sự cố</h1>
          <p className="error-boundary-fallback__text">
            Đã xảy ra lỗi không mong muốn. Vui lòng ghi lại mã lỗi bên dưới rồi tải lại trang.
          </p>
          <p className="error-boundary-fallback__code">
            Mã lỗi:{' '}
            <span className="error-boundary-fallback__code-value">{this.state.code ?? '…'}</span>
          </p>
          <Button label="Tải lại trang" variant="primary" onClick={() => window.location.reload()} />
        </div>
      </div>
    );
  }
}
