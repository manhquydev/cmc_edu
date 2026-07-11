// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { Link } from 'react-router-dom';
import { renderWithProviders } from './render-with-providers.js';
import { useSession } from '../lib/session-context.js';
import { trpc } from '../lib/trpc.js';

// Proves the harness end-to-end: jsdom env + jest-dom matchers + MemoryRouter
// (<Link>) + SessionProvider fed by a mocked `session.me` + a mocked screen
// query. Async factory so the dynamic import resolves after the vi.mock hoist.
vi.mock('../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult } = await import('./mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': queryResult({
        userId: 'u1',
        roles: ['super_admin'],
        facilityId: 'fac-1',
        config: { approvalSecondEyeThreshold: 20_000_000 },
      }),
      'demo.hello.useQuery': queryResult({ msg: 'harness-ok' }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

function Demo() {
  const { me } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = (trpc as any).demo.hello.useQuery();
  return (
    <div>
      <span>{q.data?.msg}</span>
      <span>{me?.facilityId}</span>
      <Link to="/next">go</Link>
    </div>
  );
}

describe('admin component-test harness', () => {
  it('renders with mocked trpc + session + router under jsdom', () => {
    const { getByText } = renderWithProviders(<Demo />);
    expect(getByText('harness-ok')).toBeInTheDocument(); // mocked screen query
    expect(getByText('fac-1')).toBeInTheDocument(); // mocked session.me
    expect(getByText('go')).toBeInTheDocument(); // router Link renders
  });
});
