import { trpc } from './trpc.js';

/** Server-searched classBatch options for AsyncEntityCombobox — shared by every
 * page that picks a class batch (S6: replaces a hardcoded pageSize:100 fetch
 * with no search, which silently dropped record #101+). */
export function useClassBatchOptions(search: string) {
  const { data, isLoading } = trpc.classBatch.list.useQuery({
    page: 1,
    pageSize: 100,
    ...(search ? { search } : {}),
  });
  const options = (data?.items ?? []).map((c) => ({
    value: c.id,
    label: `${c.code} — ${c.program}`,
  }));
  return { options, isLoading };
}
