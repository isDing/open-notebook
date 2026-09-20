import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { sourcesApi, type SourceSortField } from '@/lib/api/sources'
import type { SourceListResponse } from '@/lib/types/api'
import { useSourceLibrary } from './use-source-library'

vi.mock('@/lib/api/sources', () => ({ sourcesApi: { list: vi.fn() } }))

const source = (id: number) => ({ id: `source:${id}`, title: `Source ${id}` } as SourceListResponse)
const firstPage = Array.from({ length: 30 }, (_, index) => source(index))

function setup(sortBy: SourceSortField = 'updated') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return renderHook(({ sort }) => useSourceLibrary(sort, 'desc'), { wrapper, initialProps: { sort: sortBy } })
}

describe('useSourceLibrary', () => {
  beforeEach(() => vi.resetAllMocks())

  it('keeps loaded sources on pagination failure and retries only on request', async () => {
    vi.mocked(sourcesApi.list).mockResolvedValueOnce(firstPage).mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([source(29), source(30)])
    const { result } = setup()
    await waitFor(() => expect(result.current.sources).toHaveLength(30))
    await act(async () => { await result.current.fetchNextPage() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.sources).toHaveLength(30)
    expect(sourcesApi.list).toHaveBeenCalledTimes(2)
    await act(async () => { await result.current.fetchNextPage() })
    await waitFor(() => expect(result.current.sources).toHaveLength(31))
    expect(result.current.hasNextPage).toBe(false)
    expect(sourcesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 30 }), expect.any(AbortSignal))
  })

  it('aborts obsolete sorts and ignores their late results', async () => {
    let resolveOld!: (value: SourceListResponse[]) => void
    let oldSignal: AbortSignal | undefined
    vi.mocked(sourcesApi.list).mockImplementationOnce((_params, signal) => {
      oldSignal = signal
      return new Promise(resolve => { resolveOld = resolve })
    }).mockResolvedValueOnce([source(100)])
    const { result, rerender } = setup()
    await waitFor(() => expect(sourcesApi.list).toHaveBeenCalledTimes(1))
    rerender({ sort: 'title' })
    await waitFor(() => expect(result.current.sources[0]?.id).toBe('source:100'))
    expect(oldSignal?.aborted).toBe(true)
    await act(async () => resolveOld(firstPage))
    expect(result.current.sources.map(item => item.id)).toEqual(['source:100'])
  })
})
