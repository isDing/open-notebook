import { useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { sourcesApi, type SourceSortField } from '@/lib/api/sources'
import { QUERY_KEYS } from '@/lib/api/query-client'

const PAGE_SIZE = 30

/** Keep each sort in its own cache; obsolete requests are cancelled on navigation. */
export function useSourceLibrary(sortBy: SourceSortField, sortOrder: 'asc' | 'desc') {
  const query = useInfiniteQuery({
    queryKey: [...QUERY_KEYS.sources(), 'library', { sortBy, sortOrder }],
    queryFn: ({ pageParam, signal }) => sourcesApi.list({
      limit: PAGE_SIZE,
      offset: pageParam,
      sort_by: sortBy,
      sort_order: sortOrder,
    }, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastOffset) =>
      lastPage.length === PAGE_SIZE ? lastOffset + lastPage.length : undefined,
    staleTime: 30_000,
    retry: false,
  })

  const sources = useMemo(() => {
    // Background inserts can shift offset boundaries between page requests.
    const unique = new Map(query.data?.pages.flat().map(source => [source.id, source]))
    return Array.from(unique.values())
  }, [query.data])

  return { ...query, sources }
}
