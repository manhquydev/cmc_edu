import { vi } from 'vitest';

// Thin mock of the tRPC-React client (`src/lib/trpc.ts`). Screens are
// tRPC-coupled, so behavior tests stub the network boundary here rather than
// running a live API. This mocks the UI↔network seam ONLY — never business
// logic or the DB (that is what the repo's "no mocks" rule targets).
//
// Usage (per test file, async factory so the dynamic import resolves after the
// vi.mock hoist):
//
//   vi.mock('../lib/trpc.js', async () => {
//     const { buildTrpcMock, queryResult } = await import('./mock-trpc.js');
//     return {
//       trpc: buildTrpcMock({ 'foo.list.useQuery': queryResult([...]) }),
//       makeQueryClient: () => ({}), makeTrpcClient: () => ({}),
//       getDevUserHeader: () => null,
//     };
//   });

type Over = Record<string, unknown>;

/** Shape of a resolved tRPC-React query result (only the fields screens read). */
export function queryResult<T>(data: T, over: Over = {}) {
  return {
    data,
    isLoading: false,
    isPending: false,
    isError: false,
    isSuccess: true,
    error: null,
    refetch: vi.fn(),
    ...over,
  };
}

/** Shape of a tRPC-React mutation result; `mutate`/`mutateAsync` are spies. */
export function mutationResult(over: Over = {}) {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    reset: vi.fn(),
    ...over,
  };
}

/**
 * Build a nested Proxy standing in for the `trpc` client so
 * `trpc.<router>.<proc>.useQuery()/.useMutation()` resolve to configured
 * results. `handlers` is keyed by dotted path, e.g. `'rewards.list.useQuery'`.
 * Unconfigured paths return an empty `queryResult(undefined)` / `mutationResult()`.
 */
// Spy-backed stand-in for `trpc.useUtils()` — nested so `utils.x.y.invalidate()`
// resolves to a `vi.fn()` instead of crashing. Terminal cache methods are spies;
// intermediate segments recurse. Each level memoizes its children (a `Map`
// cache keyed by property name) so repeated property access — e.g. the
// screen's `utils.gift.list.invalidate()` call and a test's separate
// `trpc.useUtils().gift.list.invalidate` lookup — resolve to the SAME `vi.fn()`
// instance, letting tests assert on it. `buildTrpcMock` builds one root `utils`
// object and returns it from every `useUtils()`/`useContext()` call (see below)
// so the identity is stable across the whole mocked module instance.
const UTIL_METHODS = new Set([
  'invalidate', 'refetch', 'reset', 'cancel', 'prefetch', 'fetch',
  'ensureData', 'getData', 'setData', 'getInfiniteData', 'setInfiniteData',
]);
function makeUtils(): unknown {
  function build(): unknown {
    const cache = new Map<string, unknown>();
    return new Proxy(function noop() {} as unknown as Record<string, unknown>, {
      get(_target, key) {
        if (typeof key !== 'string') return undefined;
        if (!cache.has(key)) {
          cache.set(key, UTIL_METHODS.has(key) ? vi.fn() : build());
        }
        return cache.get(key);
      },
    });
  }
  return build();
}

export function buildTrpcMock(handlers: Record<string, unknown> = {}) {
  const utils = makeUtils();
  const make = (path: string): unknown =>
    new Proxy(function noop() {} as unknown as Record<string, unknown>, {
      get(_target, key) {
        if (typeof key !== 'string') return undefined;
        // `at` forwards the hook's call-time args (query input / mutation
        // options) to a configured handler. A plain object handler (the
        // common case) ignores args and is returned as-is. A FUNCTION handler
        // receives the args, so a test can (a) spy on the query input, or
        // (b) capture a mutation's `onSuccess`/`onError` and invoke it from
        // `mutate`'s implementation to exercise invalidate/reset flows.
        const at = (hook: string, fallback: () => unknown) =>
          (...args: unknown[]) => {
            const configured = handlers[`${path}.${hook}`];
            if (typeof configured === 'function') return configured(...args);
            return configured ?? fallback();
          };
        if (key === 'useQuery' || key === 'useSuspenseQuery')
          return at('useQuery', () => queryResult(undefined));
        if (key === 'useInfiniteQuery')
          return at('useInfiniteQuery', () => queryResult(undefined));
        if (key === 'useMutation') return at('useMutation', () => mutationResult());
        // `useSuspenseQuery` shares the `.useQuery` handler key (seed it as
        // `<path>.useQuery`). `useUtils`/`useContext` return the SAME
        // memoized `utils` root every call so `trpc.useUtils().x.invalidate`
        // is a stable, assertable `vi.fn()`.
        if (key === 'useUtils' || key === 'useContext') return () => utils;
        if (key === 'Provider') return ({ children }: { children: unknown }) => children;
        return make(path ? `${path}.${key}` : key);
      },
    });
  return make('');
}
