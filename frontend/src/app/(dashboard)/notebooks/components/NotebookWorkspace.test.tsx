import * as React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotebookWorkspace } from './NotebookWorkspace'

// Controllable desktop flag
const mediaState = vi.hoisted(() => ({ isDesktop: false }))

vi.mock('@/lib/hooks/use-media-query', () => ({
  useIsDesktop: () => mediaState.isDesktop,
  useMediaQuery: vi.fn(),
}))

// Track ChatColumn mount/unmount to prove it is never unmounted on mobile tab switches.
const chatLifecycle = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }))

vi.mock('./ChatColumn', () => ({
  ChatColumn: () => {
    const mountedRef = React.useRef(false)
    React.useEffect(() => {
      if (!mountedRef.current) {
        mountedRef.current = true
        chatLifecycle.mounts++
      }
      return () => {
        if (mountedRef.current) {
          mountedRef.current = false
          chatLifecycle.unmounts++
        }
      }
    }, [])
    return <div data-testid="chat-column" />
  },
}))

vi.mock('./SourcesColumn', () => ({
  SourcesColumn: () => <div data-testid="sources-column" />,
}))

vi.mock('./NotesColumn', () => ({
  NotesColumn: () => <div data-testid="notes-column" />,
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

const baseProps = {
  notebookId: 'nb-1',
  sources: [makeSource('s1')],
  notes: [makeNote('n1')],
  sourcesLoading: false,
  notesLoading: false,
  refetchSources: vi.fn(),
  contextSelections: {
    sources: {},
    notes: {},
  },
  onSourceContextModeChange: vi.fn(),
  onBulkSourceContextChange: vi.fn(),
  onNoteContextModeChange: vi.fn(),
  onBulkNoteContextChange: vi.fn(),
}

describe('NotebookWorkspace', () => {
  beforeEach(() => {
    mediaState.isDesktop = false
    chatLifecycle.mounts = 0
    chatLifecycle.unmounts = 0
  })

  it('renders the desktop two-pane layout when the viewport is desktop', () => {
    mediaState.isDesktop = true

    render(<NotebookWorkspace {...baseProps} />)

    expect(screen.getAllByTestId('chat-column')).toHaveLength(1)
    expect(screen.getByTestId('sources-column')).toBeInTheDocument()
    // Only the inner Sources/Notes tablist exists — no mobile primary tabs.
    expect(screen.getAllByRole('tablist')).toHaveLength(1)
  })

  it('renders the mobile Chat / Context tabs with Chat active by default', () => {
    mediaState.isDesktop = false

    render(<NotebookWorkspace {...baseProps} />)

    expect(screen.getByRole('tab', { name: 'notebooks.chatTab' })).toHaveAttribute('data-state', 'active')
    expect(getTabPanel('chat-column')).toHaveAttribute('data-state', 'active')
    // Mobile branch adds the primary tablist on top of the inner one.
    expect(screen.getAllByRole('tablist')).toHaveLength(2)
  })

  it('shows the inner Sources / Notes tabs after switching to Context', () => {
    mediaState.isDesktop = false

    render(<NotebookWorkspace {...baseProps} />)

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'notebooks.contextTab' }))

    expect(screen.getByRole('tab', { name: 'notebooks.sourcesTab' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'notebooks.notesTab' })).toBeInTheDocument()
    expect(getTabPanel('sources-column')).toHaveAttribute('data-state', 'active')
  })

  it('does not unmount the chat when switching mobile tabs', () => {
    mediaState.isDesktop = false

    render(<NotebookWorkspace {...baseProps} />)
    expect(chatLifecycle.mounts).toBe(1)

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'notebooks.contextTab' }))

    // The chat node is still in the DOM (inactive via data-state), never rebuilt.
    expect(screen.getByTestId('chat-column')).toBeInTheDocument()
    expect(getTabPanel('chat-column')).toHaveAttribute('data-state', 'inactive')
    expect(chatLifecycle.mounts).toBe(1)
    expect(chatLifecycle.unmounts).toBe(0)

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'notebooks.chatTab' }))

    expect(getTabPanel('chat-column')).toHaveAttribute('data-state', 'active')
    expect(chatLifecycle.unmounts).toBe(0)
  })
})
