import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SourceInsightDialog } from './SourceInsightDialog'
import { useInsight, useSaveInsightAsNote } from '@/lib/hooks/use-insights'
import { useNotebooks } from '@/lib/hooks/use-notebooks'

// useTranslation is mocked globally in setup.ts (t returns the key string)

vi.mock('@/lib/hooks/use-insights', () => ({
  useInsight: vi.fn(),
  useSaveInsightAsNote: vi.fn(),
}))

vi.mock('@/lib/hooks/use-notebooks', () => ({
  useNotebooks: vi.fn(),
}))

vi.mock('@/lib/hooks/use-modal-manager', () => ({
  useModalManager: () => ({ openModal: vi.fn() }),
}))

const mockUseInsight = vi.mocked(useInsight)
const mockUseSaveInsightAsNote = vi.mocked(useSaveInsightAsNote)
const mockUseNotebooks = vi.mocked(useNotebooks)

const notFoundError = Object.assign(new Error('Request failed with status code 404'), {
  isAxiosError: true,
  response: { status: 404 },
})

const networkError = Object.assign(new Error('Network Error'), {
  isAxiosError: true,
  response: undefined,
})

type UseInsightResult = ReturnType<typeof useInsight>

const asResult = (value: Partial<UseInsightResult>) => value as UseInsightResult

describe('SourceInsightDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseNotebooks.mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useNotebooks>)
    mockUseSaveInsightAsNote.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useSaveInsightAsNote>)
  })

  it('shows the shared not-found state when the insight returns 404', () => {
    mockUseInsight.mockReturnValue(
      asResult({ data: undefined, isLoading: false, isError: true, error: notFoundError })
    )

    render(
      <SourceInsightDialog
        open={true}
        onOpenChange={vi.fn()}
        insight={{ id: 'insight-1', insight_type: '', content: '' }}
      />
    )

    expect(screen.getByTestId('content-unavailable')).toBeInTheDocument()
    expect(screen.getByText('common.contentUnavailable.notFoundTitle')).toBeInTheDocument()
    expect(screen.getByText('common.contentUnavailable.notFoundDescription')).toBeInTheDocument()
    // No ghost fallback content and no "view source" affordance
    expect(screen.queryByText('sources.viewSource')).not.toBeInTheDocument()
    expect(screen.queryByText('searchPage.saveToNotebook')).not.toBeInTheDocument()
  })

  it('shows the shared load-error state for non-404 failures', () => {
    mockUseInsight.mockReturnValue(
      asResult({ data: undefined, isLoading: false, isError: true, error: networkError })
    )

    render(
      <SourceInsightDialog
        open={true}
        onOpenChange={vi.fn()}
        insight={{ id: 'insight-1', insight_type: '', content: '' }}
      />
    )

    expect(screen.getByText('common.contentUnavailable.errorTitle')).toBeInTheDocument()
    expect(
      screen.queryByText('common.contentUnavailable.notFoundTitle')
    ).not.toBeInTheDocument()
  })

  it('closes the dialog from the not-found state close button', () => {
    mockUseInsight.mockReturnValue(
      asResult({ data: undefined, isLoading: false, isError: true, error: notFoundError })
    )
    const onOpenChange = vi.fn()

    render(
      <SourceInsightDialog
        open={true}
        onOpenChange={onOpenChange}
        insight={{ id: 'insight-1', insight_type: '', content: '' }}
      />
    )

    within(screen.getByTestId('content-unavailable')).getByText('common.close').click()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('renders the insight content when the fetch succeeds', () => {
    mockUseInsight.mockReturnValue(
      asResult({
        data: {
          id: 'insight-1',
          source_id: 'source:1',
          insight_type: 'summary',
          content: 'Fetched insight content',
          created: null,
          updated: null,
        },
        isLoading: false,
        isError: false,
        error: null,
      })
    )

    render(
      <SourceInsightDialog
        open={true}
        onOpenChange={vi.fn()}
        insight={{ id: 'insight-1', insight_type: '', content: '' }}
      />
    )

    expect(screen.getByText('Fetched insight content')).toBeInTheDocument()
    expect(screen.queryByTestId('content-unavailable')).not.toBeInTheDocument()
  })

  it('saves the insight to the selected notebook', () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: 'note-1' })
    mockUseSaveInsightAsNote.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useSaveInsightAsNote>)
    mockUseNotebooks.mockReturnValue({
      data: [{ id: 'notebook-1', name: 'Research', description: '', archived: false, created: '', updated: '', source_count: 0, note_count: 0 }],
      isLoading: false,
    } as unknown as ReturnType<typeof useNotebooks>)
    mockUseInsight.mockReturnValue(
      asResult({
        data: {
          id: 'source_insight:insight-1',
          source_id: 'source:1',
          insight_type: 'summary',
          content: 'Fetched insight content',
          created: null,
          updated: null,
        },
        isLoading: false,
        isError: false,
        error: null,
      })
    )

    render(
      <SourceInsightDialog
        open={true}
        onOpenChange={vi.fn()}
        insight={{ id: 'insight-1', insight_type: '', content: '' }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'searchPage.saveToNotebook' }))
    fireEvent.click(screen.getByText('Research'))
    const saveButtons = screen.getAllByRole('button', { name: 'searchPage.saveToNotebook' })
    fireEvent.click(saveButtons[saveButtons.length - 1])

    expect(mutateAsync).toHaveBeenCalledWith({
      insightId: 'source_insight:insight-1',
      notebookId: 'notebook-1',
    })
  })
})
