import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import NotebooksPage from './page'
import { useNotebooks } from '@/lib/hooks/use-notebooks'
import type { NotebookResponse } from '@/lib/types/api'

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <NotebooksPage />
    </QueryClientProvider>
  )
}

const viewState = vi.hoisted(() => ({
  viewMode: 'list' as 'tile' | 'list',
}))

vi.mock('@/lib/stores/notebook-view-store', () => ({
  useNotebookViewStore: (selector?: (state: { viewMode: 'tile' | 'list' }) => unknown) => {
    const state = { viewMode: viewState.viewMode, setViewMode: vi.fn() }
    return selector ? selector(state) : state
  },
}))

vi.mock('@/lib/hooks/use-notebooks', () => ({
  useNotebooks: vi.fn(() => ({ data: [], isLoading: false })),
}))

vi.mock('./components/RecentlyViewed', () => ({
  RecentlyViewed: ({ limit }: { limit?: number }) => (
    <div data-testid="recently-viewed">{limit}</div>
  ),
}))

vi.mock('./components/NotebookList', () => ({
  NotebookList: ({ notebooks, isError, onRetry }: { notebooks?: NotebookResponse[]; isError?: boolean; onRetry?: () => void }) => (
    <div data-testid="notebook-list">
      {notebooks?.map(notebook => <span key={notebook.id}>{notebook.name}</span>)}
      {isError && <button onClick={onRetry}>retry</button>}
    </div>
  ),
}))

vi.mock('@/components/notebooks/CreateNotebookDialog', () => ({
  CreateNotebookDialog: () => <div data-testid="create-dialog" />,
}))

describe('NotebooksPage', () => {
  beforeEach(() => {
    vi.mocked(useNotebooks).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useNotebooks>)
  })

  it('requests four recently viewed items and hides the section while searching', () => {
    renderPage()

    // The recently viewed entry point is limited to 4 items by default.
    const recentlyViewed = screen.getByTestId('recently-viewed')
    expect(recentlyViewed).toHaveTextContent('4')

    // Searching removes the recently viewed section from the results page.
    const search = screen.getByLabelText('common.accessibility.searchNotebooks')
    fireEvent.change(search, { target: { value: 'query' } })
    expect(screen.queryByTestId('recently-viewed')).not.toBeInTheDocument()

    // Clearing the search brings it back.
    fireEvent.change(search, { target: { value: '' } })
    expect(screen.getByTestId('recently-viewed')).toBeInTheDocument()
  })

  it('matches descriptions and restores results with the clear button', () => {
    vi.mocked(useNotebooks).mockImplementation((archived) => ({
      data: archived ? [] : [
        { id: 'one', name: 'Research', description: 'Semantic retrieval' },
        { id: 'two', name: 'Design', description: 'Interface notes' },
      ], isLoading: false,
    } as ReturnType<typeof useNotebooks>))
    renderPage()
    fireEvent.change(screen.getByLabelText('common.accessibility.searchNotebooks'), { target: { value: 'SEMANTIC' } })
    expect(screen.getByText('Research')).toBeInTheDocument()
    expect(screen.queryByText('Design')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('common.clearSearch'))
    expect(screen.getByText('Design')).toBeInTheDocument()
    expect(screen.getByLabelText('common.accessibility.searchNotebooks')).toHaveFocus()
  })

  it('allows a failed collection to be retried', () => {
    const refetch = vi.fn()
    vi.mocked(useNotebooks).mockImplementation((archived) => ({
      data: archived ? [] : undefined, isLoading: false, isError: !archived, refetch,
    } as unknown as ReturnType<typeof useNotebooks>))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    expect(refetch).toHaveBeenCalledOnce()
  })
})
