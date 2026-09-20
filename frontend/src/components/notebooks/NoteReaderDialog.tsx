'use client'

import { useCallback, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MarkdownRenderer } from '@/components/ui/markdown-renderer'
import { ContentUnavailable } from '@/components/common/ContentUnavailable'
import { useNote } from '@/lib/hooks/use-notes'
import { useTranslation } from '@/lib/hooks/use-translation'
import { useModalManager } from '@/lib/hooks/use-modal-manager'
import { useNoteReferenceLink } from '@/lib/hooks/use-note-reference-link'
import { isNotFoundError } from '@/lib/utils/error-handler'
import { convertReferencesToCompactMarkdown, type ReferenceType } from '@/lib/utils/source-references'

interface NoteReaderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  noteId?: string | null
}

export function NoteReaderDialog({ open, onOpenChange, noteId }: NoteReaderDialogProps) {
  const { t } = useTranslation()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const { openModal } = useModalManager()
  const id = noteId ? (noteId.includes(':') ? noteId : `note:${noteId}`) : ''
  const { data: note, isLoading, isError, error } = useNote(id, { enabled: open && !!id })
  const onReferenceClick = useCallback((type: ReferenceType, referenceId: string) => {
    openModal(type === 'source_insight' ? 'insight' : type, referenceId)
  }, [openModal])
  const ReferenceLink = useNoteReferenceLink(onReferenceClick)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[90dvh] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl sm:p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          titleRef.current?.focus()
        }}
      >
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-14 text-left sm:px-6 sm:pr-16">
          <DialogTitle ref={titleRef} tabIndex={-1} className="break-words text-xl leading-normal outline-none">
            {note?.title || t('notebooks.untitledNote')}
          </DialogTitle>
        </DialogHeader>
        <div key={id} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : isError || !note ? (
            <ContentUnavailable
              variant={!id || isNotFoundError(error) ? 'not-found' : 'error'}
              onClose={() => onOpenChange(false)}
            />
          ) : note.content ? (
            <MarkdownRenderer components={{ a: ReferenceLink }}>
              {convertReferencesToCompactMarkdown(note.content, t('common.references'))}
            </MarkdownRenderer>
          ) : (
            <p className="text-sm text-muted-foreground">{t('notes.noContent')}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
