import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi } from 'vitest'
import NotebooksPage from './page'

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
  NotebookList: () => <div data-testid="notebook-list" />,
}))

vi.mock('@/components/notebooks/CreateNotebookDialog', () => ({
  CreateNotebookDialog: () => <div data-testid="create-dialog" />,
}))

describe('NotebooksPage', () => {
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
})
