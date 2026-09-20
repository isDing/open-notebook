import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import NotesPage from './page'

const { openModal, referenceResult } = vi.hoisted(() => ({
  openModal: vi.fn(),
  referenceResult: { title: '研究记录', isError: false },
}))

vi.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('@/lib/hooks/use-translation', () => ({
  useTranslation: () => ({
    language: 'zh-CN',
    t: (key: string, values?: { count?: number }) => values?.count === undefined ? key : `${key}:${values.count}`,
  }),
}))
vi.mock('@/lib/hooks/use-media-query', () => ({ useIsDesktop: () => true }))
vi.mock('@/lib/hooks/use-modal-manager', () => ({ useModalManager: () => ({ openModal }) }))
vi.mock('@/lib/hooks/use-notes', () => {
  const savedNote = {
    id: 'note:saved', title: '保存的回复',
    content: '结论 [note:referenced]，补充 [note:referenced]。来源 [source:src]，洞察 [insight:detail]。',
    note_type: 'ai', updated: '2026-09-20T00:00:00Z', notebooks: [],
  }
  return {
    useAllNotes: () => ({ data: [savedNote], isLoading: false, isError: false }),
    useNote: (id: string) => id === 'note:referenced'
      ? {
          data: referenceResult.isError ? undefined : { title: referenceResult.title },
          isLoading: false, isError: referenceResult.isError,
          error: referenceResult.isError ? { isAxiosError: true, response: { status: 404 } } : null,
        }
      : { data: savedNote, isLoading: false, isError: false },
  }
})

describe('Reading page citations', () => {
  beforeEach(() => {
    openModal.mockClear()
    referenceResult.title = '研究记录'
    referenceResult.isError = false
  })

  it('shows note titles and opens citations without replacing the current reading selection', () => {
    render(<NotesPage />)
    const reading = within(screen.getByRole('article'))
    fireEvent.click(reading.getByRole('button', { name: '研究记录' }))
    expect(openModal).toHaveBeenLastCalledWith('note', 'referenced')
    for (const citation of reading.getAllByRole('button', { name: '1' })) {
      fireEvent.click(citation)
      expect(openModal).toHaveBeenLastCalledWith('note', 'referenced')
    }
    fireEvent.click(reading.getByRole('button', { name: '2' }))
    expect(openModal).toHaveBeenLastCalledWith('source', 'src')
    fireEvent.click(reading.getByRole('button', { name: '3' }))
    expect(openModal).toHaveBeenLastCalledWith('insight', 'detail')
    expect(reading.getByRole('heading', { name: '保存的回复' })).toBeInTheDocument()
    expect(reading.queryByText('note:referenced')).not.toBeInTheDocument()
    // Four two-character phrases; citation IDs and punctuation do not count.
    expect(reading.getByText('notes.wordCount:8')).toBeInTheDocument()
  })

  it('uses the translated untitled label when a referenced note has no title', () => {
    referenceResult.title = ''
    render(<NotesPage />)
    expect(within(screen.getByRole('article')).getByRole('button', { name: 'notebooks.untitledNote' })).toBeInTheDocument()
  })

  it('keeps deleted references clickable with an unavailable label', () => {
    referenceResult.isError = true
    render(<NotesPage />)
    fireEvent.click(within(screen.getByRole('article')).getByRole('button', { name: 'common.contentUnavailable.notFoundTitle' }))
    expect(openModal).toHaveBeenCalledWith('note', 'referenced')
  })
})
