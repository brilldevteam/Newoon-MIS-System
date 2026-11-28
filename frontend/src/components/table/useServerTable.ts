import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

// Search, sort, quick tab, filters and page of a list table. The state lives in the page address, so going to a row
// and coming back keeps the same view, and a view can be shared. Every change asks the server for the matching rows.

export type TablePage<T> = { items: T[]; total: number; page: number; pageSize: number; counts: Record<string, number> };

export type TableParams = {
  q: string;
  sort: string;
  dir: 'asc' | 'desc';
  tab: string;
  page: number;
  pageSize: number;
  filters: Record<string, string>;
};

type Options = {
  defaultSort: string;
  defaultDir?: 'asc' | 'desc';
  defaultTab?: string;
  pageSize?: number;
  // Names of the filter-panel values this table supports (read from and written to the address).
  filterKeys?: string[];
  enabled?: boolean;
};

export function useServerTable<T>(fetchPage: (params: TableParams) => Promise<TablePage<T>>, options: Options) {
  const { defaultSort, defaultDir = 'desc', defaultTab = 'all', pageSize: defaultPageSize = 20, filterKeys = [], enabled = true } = options;
  const [search, setSearch] = useSearchParams();
  const keys = useMemo(() => filterKeys, [filterKeys.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const params: TableParams = useMemo(() => {
    const dir = search.get('dir');
    const page = Number(search.get('page'));
    const size = Number(search.get('size'));
    return {
      q: search.get('q') || '',
      sort: search.get('sort') || defaultSort,
      dir: dir === 'asc' || dir === 'desc' ? dir : defaultDir,
      tab: search.get('tab') || defaultTab,
      page: Number.isInteger(page) && page > 0 ? page : 1,
      pageSize: [10, 20, 50, 100].includes(size) ? size : defaultPageSize,
      filters: Object.fromEntries(keys.flatMap((key) => (search.get(key) ? [[key, search.get(key) as string]] : [])))
    };
  }, [search, defaultSort, defaultDir, defaultTab, defaultPageSize, keys]);

  const [data, setData] = useState<TablePage<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const paramsKey = JSON.stringify(params);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const load = useCallback(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    fetchRef.current(JSON.parse(paramsKey) as TableParams)
      .then((result) => {
        if (id !== requestId.current) return;
        setData(result);
        // The server moved us to the last page that has rows (for example after a delete).
        if (result.page !== JSON.parse(paramsKey).page) update({ page: String(result.page) });
      })
      .catch((requestError: any) => {
        if (id !== requestId.current) return;
        setError(requestError.response?.data?.message || 'Unable to load the list.');
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  // Writes address values; an empty value removes the key. Anything but a page change goes back to page 1.
  function update(changes: Record<string, string | null>, keepPage = false) {
    setSearch((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      if (!keepPage && !('page' in changes)) next.delete('page');
      if (next.get('page') === '1') next.delete('page');
      return next;
    }, { replace: true });
  }

  const setQuery = useCallback((q: string) => update({ q: q.trim() ? q : null }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const setTab = (tab: string) => update({ tab: tab === defaultTab ? null : tab });
  const setSort = (sort: string, dir?: 'asc' | 'desc') => update({ sort: sort === defaultSort && (dir ?? defaultDir) === defaultDir ? null : sort, dir: (dir ?? defaultDir) === defaultDir ? null : (dir ?? defaultDir) });
  const toggleSort = (sort: string) => setSort(sort, params.sort === sort ? (params.dir === 'asc' ? 'desc' : 'asc') : 'asc');
  const setFilter = (key: string, value: string) => update({ [key]: value || null });
  const clearFilters = () => update(Object.fromEntries(keys.map((key) => [key, null])));
  const setPage = (page: number) => update({ page: String(page) });
  const setPageSize = (size: number) => update({ size: size === defaultPageSize ? null : String(size) });
  const reset = () => setSearch(new URLSearchParams(), { replace: true });

  return {
    params,
    rows: data?.items || [],
    total: data?.total || 0,
    counts: data?.counts || {},
    loading,
    error,
    reload: load,
    setQuery,
    setTab,
    setSort,
    toggleSort,
    setFilter,
    clearFilters,
    setPage,
    setPageSize,
    reset,
    activeFilterCount: Object.keys(params.filters).length,
    isFiltered: Boolean(params.q) || Object.keys(params.filters).length > 0 || params.tab !== defaultTab,
    // Takes a row out of the view at once (after a delete) while the list reloads.
    removeRow: (match: (row: T) => boolean) => setData((current) => (current ? { ...current, items: current.items.filter((row) => !match(row)), total: Math.max(0, current.total - 1) } : current))
  };
}

// The query-string values the list endpoints read (see backend TableQueryDto).
export function toApiParams(params: TableParams) {
  return {
    ...(params.q.trim() ? { q: params.q.trim() } : {}),
    sort: params.sort,
    dir: params.dir,
    ...(params.tab !== 'all' ? { tab: params.tab } : {}),
    page: params.page,
    pageSize: params.pageSize,
    ...params.filters
  };
}
