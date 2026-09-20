'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { useNote } from '@/lib/hooks/use-notes'
import { useTranslation } from '@/lib/hooks/use-translation'
import { isNotFoundError } from '@/lib/utils/error-handler'
import { createCompactReferenceLinkComponent, type ReferenceType } from '@/lib/utils/source-references'
import { useIsDesktop } from '@/lib/hooks/use-media-query'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

function NoteReferenceTitle({ id }: { id: string }) {
  const { data: note, isLoading, isError, error } = useNote(`note:${id}`)
  const { t } = useTranslation()

  if (isLoading) return t('common.loading')
  if (isError) return t(isNotFoundError(error) ? 'common.contentUnavailable.notFoundTitle' : 'common.contentUnavailable.errorTitle')
  return note?.title?.trim() || t('notebooks.untitledNote')
}

function NoteReference({ id, children, onReferenceClick }: {
  id: string
  children: ReactNode
  onReferenceClick: (type: ReferenceType, id: string) => void
}) {
  const isDesktop = useIsDesktop()
  const [open, setOpen] = useState(false)
  const isNumber = /^\d+$/.test(String(children))
  const className = 'text-primary-ink hover:underline cursor-pointer inline font-medium'
  const openNote = () => {
    setOpen(false)
    onReferenceClick('note', id)
  }

  if (!isNumber) {
    return <button type="button" className={className} onClick={(event) => {
      event.stopPropagation()
      openNote()
    }}><NoteReferenceTitle id={id} /></button>
  }

  if (isDesktop) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className={className} onClick={(event) => {
            event.stopPropagation()
            openNote()
          }}>{children}</button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[min(20rem,calc(100vw-2rem))] break-words">
          <NoteReferenceTitle id={id} />
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={className} onClick={(event) => event.stopPropagation()}>
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-2">
        <button type="button" className={`${className} min-h-11 px-2 text-left break-words`} onClick={(event) => {
          event.stopPropagation()
          openNote()
        }}><NoteReferenceTitle id={id} /></button>
      </PopoverContent>
    </Popover>
  )
}

/** Desktop citations show a tooltip; mobile citations reveal a named link first. */
export function useNoteReferenceLink(onReferenceClick: (type: ReferenceType, id: string) => void) {
  return useMemo(() => createCompactReferenceLinkComponent(
    onReferenceClick,
    (type, id, children) => type === 'note'
      ? <NoteReference id={id} onReferenceClick={onReferenceClick}>{children}</NoteReference>
      : undefined,
  ), [onReferenceClick])
}
