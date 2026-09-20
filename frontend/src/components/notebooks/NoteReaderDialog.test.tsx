import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lazy, Suspense, type ComponentType } from 'react'
import { useNote } from '@/lib/hooks/use-notes'
import { NoteReaderDialog } from './NoteReaderDialog'
import { ModalProvider } from '@/components/providers/ModalProvider'

const { openModal, closeModal } = vi.hoisted(() => ({ openModal: vi.fn(), closeModal: vi.fn() }))
vi.mock('@/lib/hooks/use-notes', () => ({ useNote: vi.fn() }))
vi.mock('@/lib/hooks/use-media-query', () => ({ useIsDesktop: () => true }))
vi.mock('@/lib/hooks/use-modal-manager', () => ({
  useModalManager: () => ({ modalType: 'note', modalId: 'abc', openModal, closeModal }),
}))
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: ComponentType } | ComponentType>) => {
    const Component = lazy(async () => {
      const loaded = await loader()
      return { default: 'default' in loaded ? loaded.default : loaded }
    })
    return function DynamicComponent(props: Record<string, unknown>) {
      return <Suspense fallback={null}><Component {...props} /></Suspense>
    }
  },
}))

type NoteResult = ReturnType<typeof useNote>
const result = (value: Partial<NoteResult>) => value as NoteResult
const note = {
  id: 'note:abc', title: '引用笔记', content: '**只读正文**\n\n相关 [note:other]',
  note_type: 'ai', created: '', updated: '',
} as NonNullable<NoteResult['data']>

describe('NoteReaderDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNote).mockImplementation((id) => result({
      data: id === 'note:other' ? { ...note, id, title: '关联笔记' } : note,
      isLoading: false, isError: false,
    }))
  })

  it('routes the global note modal to a read-only window with working references and close control', async () => {
    render(<ModalProvider />)
    const dialog = within(await screen.findByRole('dialog'))
    expect(dialog.getByRole('heading', { name: '引用笔记' })).toBeInTheDocument()
    expect(dialog.getByText('只读正文').tagName).toBe('STRONG')
    expect(dialog.queryByRole('textbox')).not.toBeInTheDocument()
    expect(dialog.queryByRole('button', { name: 'sources.saveNote' })).not.toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: '关联笔记' }))
    expect(openModal).toHaveBeenCalledWith('note', 'other')
    fireEvent.click(dialog.getByRole('button', { name: 'common.close' }))
    expect(closeModal).toHaveBeenCalled()
    expect(useNote).toHaveBeenCalledWith('note:abc', { enabled: true })
  })

  it('shows loading and replaces content when another referenced note opens', () => {
    const { rerender } = render(<NoteReaderDialog open onOpenChange={vi.fn()} noteId="abc" />)
    vi.mocked(useNote).mockReturnValue(result({ isLoading: true }))
    rerender(<NoteReaderDialog open onOpenChange={vi.fn()} noteId="next" />)
    expect(screen.getByText('common.loading')).toBeInTheDocument()
    expect(screen.queryByText('只读正文')).not.toBeInTheDocument()

    vi.mocked(useNote).mockReturnValue(result({ data: { ...note, title: '下一篇', content: '新的正文' } }))
    rerender(<NoteReaderDialog open onOpenChange={vi.fn()} noteId="next" />)
    expect(screen.getByRole('heading', { name: '下一篇' })).toBeInTheDocument()
    expect(screen.getByText('新的正文')).toBeInTheDocument()
  })

  it.each([
    [404, 'common.contentUnavailable.notFoundTitle'],
    [500, 'common.contentUnavailable.errorTitle'],
  ])('handles failed fetches (%s) without offering an editor', (status, label) => {
    vi.mocked(useNote).mockReturnValue(result({
      isError: true, error: Object.assign(new Error('failed'), { isAxiosError: true, response: { status } }),
    }))
    render(<NoteReaderDialog open onOpenChange={vi.fn()} noteId="abc" />)
    expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('shows the empty-content label for an empty note', () => {
    vi.mocked(useNote).mockReturnValue(result({ data: { ...note, content: null } }))
    render(<NoteReaderDialog open onOpenChange={vi.fn()} noteId="note:abc" />)
    expect(screen.getByText('notes.noContent')).toBeInTheDocument()
    expect(useNote).toHaveBeenCalledWith('note:abc', { enabled: true })
  })
})
