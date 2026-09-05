import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotebookContextPanel } from './NotebookContextPanel'

// Controllable store mock
const storeState = vi.hoisted(() => ({
  contextPanelCollapsed: false,
  hasHydrated: true,
  toggleContextPanel: vi.fn(),
}))

vi.mock('@/lib/stores/notebook-columns-store', () => ({
  useNotebookColumnsStore: () => storeState,
}))

// Capture child props; the panel is only tested as a layout orchestrator.
const captured = vi.hoisted(() => ({
  sources: {} as Record<string, unknown>,
  notes: {} as Record<string, unknown>,
}))

vi.mock('./SourcesColumn', () => ({
  SourcesColumn: (props: Record<string, unknown>) => {
    Object.assign(captured.sources, props)
    return <div data-testid="sources-column" />
  },
}))

vi.mock('./NotesColumn', () => ({
  NotesColumn: (props: Record<string, unknown>) => {
    Object.assign(captured.notes, props)
    return <div data-testid="notes-column" />
  },
}))

// The tabpanel is the Radix wrapper that carries data-state active/inactive.
function getTabPanel(testId: string) {
  return screen.getByTestId(testId).closest('[role=tabpanel]') as HTMLElement
}

// t() is mocked globally in setup.ts and returns the key string.
const makeSource = (id: string) => ({
  id,
  title: id,
  asset: null,
  embedded: false,
  embedded_chunks: 0,
  insights_count: 0,
  created: '2024-01-01T00:00:00Z',
  updated: '2024-01-01T00:00:00Z',
})
const makeNote = (id: string) => ({
  id,
  title: id,
  content: null,
  note_type: null,
  created: '2024-01-01T00:00:00Z',
  updated: '2024-01-01T00:00:00Z',
})

const sources = [makeSource('s1'), makeSource('s2')]
const notes = [makeNote('n1')]

const baseProps = {
  notebookId: 'nb-1',
  sources,
  notes,
  sourcesLoading: false,
  notesLoading: false,
  refetchSources: vi.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  contextSelections: {
    sources: { s1: 'insights' as const },
    notes: { n1: 'full' as const },
  },
  onSourceContextModeChange: vi.fn(),
  onBulkSourceContextChange: vi.fn(),
  onNoteContextModeChange: vi.fn(),
  onBulkNoteContextChange: vi.fn(),
}

describe('NotebookContextPanel', () => {
  beforeEach(() => {
    storeState.contextPanelCollapsed = false
    storeState.hasHydrated = true
    storeState.toggleContextPanel = vi.fn()
    captured.sources = {}
    captured.notes = {}
  })

  it('shows the Sources content by default', () => {
    render(<NotebookContextPanel {...baseProps} collapsible={false} />)

    expect(getTabPanel('sources-column')).toHaveAttribute('data-state', 'active')
    expect(getTabPanel('notes-column')).toHaveAttribute('data-state', 'inactive')
  })

  it('shows the Notes content after clicking the Notes tab', () => {
    render(<NotebookContextPanel {...baseProps} collapsible={false} />)

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'notebooks.notesTab' }))

    expect(getTabPanel('notes-column')).toHaveAttribute('data-state', 'active')
    expect(getTabPanel('sources-column')).toHaveAttribute('data-state', 'inactive')
  })

  it('keeps both columns mounted when switching tabs', () => {
    render(<NotebookContextPanel {...baseProps} collapsible={false} />)

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'notebooks.notesTab' }))

    expect(screen.getByTestId('sources-column')).toBeInTheDocument()
    expect(screen.getByTestId('notes-column')).toBeInTheDocument()
  })

  it('shows counts matching the passed-in arrays', () => {
    render(<NotebookContextPanel {...baseProps} collapsible={false} />)

    expect(screen.getByRole('tab', { name: /notebooks.sourcesTab/ }).textContent).toContain('(2)')
    expect(screen.getByRole('tab', { name: /notebooks.notesTab/ }).textContent).toContain('(1)')
  })

  it('does not render a collapse button when collapsible is false', () => {
    render(<NotebookContextPanel {...baseProps} collapsible={false} />)

    expect(screen.queryByRole('button', { name: 'notebooks.collapseContext' })).not.toBeInTheDocument()
  })

  it('renders the collapse button and calls the store action when collapsible is true', () => {
    render(<NotebookContextPanel {...baseProps} collapsible={true} />)

    fireEvent.click(screen.getByRole('button', { name: 'notebooks.collapseContext' }))

    expect(storeState.toggleContextPanel).toHaveBeenCalledTimes(1)
  })

  it('renders the collapse rail instead of the panel when the store is collapsed', () => {
    storeState.contextPanelCollapsed = true

    render(<NotebookContextPanel {...baseProps} collapsible={true} />)

    expect(screen.getByTestId('context-panel-rail')).toBeInTheDocument()
    expect(screen.queryByTestId('sources-column')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'notebooks.expandContext' })).toBeInTheDocument()
  })

  it('stays expanded before the persisted state is hydrated', () => {
    storeState.hasHydrated = false
    storeState.contextPanelCollapsed = true

    render(<NotebookContextPanel {...baseProps} collapsible={true} />)

    expect(screen.getByTestId('sources-column')).toBeInTheDocument()
    expect(screen.queryByTestId('context-panel-rail')).not.toBeInTheDocument()
  })

  it('passes selections, loading, pagination and callbacks to the child columns', () => {
    const onSourceContextModeChange = vi.fn()
    const onBulkSourceContextChange = vi.fn()
    const onNoteContextModeChange = vi.fn()
    const onBulkNoteContextChange = vi.fn()
    const refetchSources = vi.fn()
    const fetchNextPage = vi.fn()

    render(
      <NotebookContextPanel
        {...baseProps}
        collapsible={false}
        onSourceContextModeChange={onSourceContextModeChange}
        onBulkSourceContextChange={onBulkSourceContextChange}
        onNoteContextModeChange={onNoteContextModeChange}
        onBulkNoteContextChange={onBulkNoteContextChange}
        refetchSources={refetchSources}
        fetchNextPage={fetchNextPage}
      />
    )

    expect(captured.sources).toMatchObject({
      notebookId: 'nb-1',
      sources,
      isLoading: false,
      onRefresh: refetchSources,
      contextSelections: { s1: 'insights' },
      onContextModeChange: onSourceContextModeChange,
      onBulkContextModeChange: onBulkSourceContextChange,
      fetchNextPage,
      collapsible: false,
    })
    expect(captured.notes).toMatchObject({
      notebookId: 'nb-1',
      notes,
      isLoading: false,
      contextSelections: { n1: 'full' },
      onContextModeChange: onNoteContextModeChange,
      onBulkContextModeChange: onBulkNoteContextChange,
      collapsible: false,
    })
  })
})
