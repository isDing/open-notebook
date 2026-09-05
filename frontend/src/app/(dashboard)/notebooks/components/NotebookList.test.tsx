import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotebookList } from './NotebookList'

// Controllable view mode
const viewState = vi.hoisted(() => ({
  viewMode: 'list' as 'tile' | 'list',
}))

vi.mock('@/lib/stores/notebook-view-store', () => ({
  useNotebookViewStore: (selector?: (state: { viewMode: 'tile' | 'list' }) => unknown) => {
    const state = { viewMode: viewState.viewMode, setViewMode: vi.fn() }
    return selector ? selector(state) : state
  },
}))

vi.mock('./NotebookRow', () => ({
  NotebookRow: ({ notebook }: { notebook: { id: string } }) => (
    <div data-testid="notebook-row">{notebook.id}</div>
  ),
}))

vi.mock('./NotebookCard', () => ({
  NotebookCard: ({ notebook }: { notebook: { id: string } }) => (
    <div data-testid="notebook-card">{notebook.id}</div>
  ),
}))

const notebooks = [
  { id: 'nb-1' },
  { id: 'nb-2' },
] as unknown as Parameters<typeof NotebookList>[0]['notebooks']

describe('NotebookList', () => {
  beforeEach(() => {
    viewState.viewMode = 'list'
  })

  it('shows a loading spinner while loading', () => {
    render(<NotebookList notebooks={notebooks} isLoading title="Active Notebooks" />)

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('shows the empty state with the provided title, description and action', () => {
    const onAction = vi.fn()

    render(
      <NotebookList
        notebooks={[]}
        isLoading={false}
        title="Active Notebooks"
        emptyTitle="No matches found"
        emptyDescription="Try using a different search term."
        onAction={onAction}
        actionLabel="New Notebook"
      />
    )

    expect(screen.getByRole('heading', { name: 'No matches found' })).toBeInTheDocument()
    expect(screen.getByText('Try using a different search term.')).toBeInTheDocument()

    const button = screen.getByRole('button', { name: 'New Notebook' })
    fireEvent.click(button)
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('renders NotebookRows in list mode', () => {
    render(<NotebookList notebooks={notebooks} isLoading={false} title="Active Notebooks" />)

    expect(screen.getAllByTestId('notebook-row')).toHaveLength(2)
    expect(screen.queryByTestId('notebook-card')).not.toBeInTheDocument()
  })

  it('renders NotebookCards in tile mode', () => {
    viewState.viewMode = 'tile'

    render(<NotebookList notebooks={notebooks} isLoading={false} title="Active Notebooks" />)

    expect(screen.getAllByTestId('notebook-card')).toHaveLength(2)
    expect(screen.queryByTestId('notebook-row')).not.toBeInTheDocument()
  })

  it('keeps collapsible lists collapsed by default and expands on click', () => {
    render(<NotebookList notebooks={notebooks} isLoading={false} title="Archived Notebooks" collapsible />)

    expect(screen.queryByTestId('notebook-row')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archived Notebooks' })).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'Archived Notebooks' }))

    expect(screen.getAllByTestId('notebook-row')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Archived Notebooks' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows the section heading with the notebook count', () => {
    render(<NotebookList notebooks={notebooks} isLoading={false} title="Active Notebooks" />)

    expect(screen.getByRole('heading', { name: /Active Notebooks/ })).toBeInTheDocument()
    expect(screen.getByText('(2)')).toBeInTheDocument()
  })
})
