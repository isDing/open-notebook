'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  BookOpen,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Clock3,
  Search,
  Sparkles,
  StickyNote,
  UserRound,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { AppShell } from '@/components/layout/AppShell'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { MarkdownRenderer } from '@/components/ui/markdown-renderer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAllNotes, useNote } from '@/lib/hooks/use-notes'
import { useIsDesktop } from '@/lib/hooks/use-media-query'
import { useTranslation } from '@/lib/hooks/use-translation'
import { getDateLocale } from '@/lib/utils/date-locale'
import { cn } from '@/lib/utils'
import { CollapsibleColumn, createCollapseButton } from '@/components/notebooks/CollapsibleColumn'

function normalizeNoteId(id: string) {
  return id.includes(':') ? id : `note:${id}`
}

function notePreview(content: string | null) {
  if (!content) return ''
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, ' ')
    .replace(/^\s*[-*+]\s+/gm, ' ')
    .replace(/^\s*>\s?/gm, ' ')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function noteStats(content: string | null) {
  const plainText = notePreview(content)
  const words = plainText ? plainText.split(/\s+/).length : 0
  return { words, minutes: Math.max(1, Math.ceil(words / 220)) }
}

export default function NotesPage() {
  const { t, language } = useTranslation()
  const [query, setQuery] = useState('')
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  const [listCollapsed, setListCollapsed] = useState(false)

  const { data: notes = [], isLoading, isError, refetch } = useAllNotes()
  const isDesktop = useIsDesktop()
  const normalizedQuery = query.trim().toLowerCase()

  const filteredNotes = useMemo(() => {
    const result = notes.filter((note) => {
      const haystack = `${note.title ?? ''} ${note.content ?? ''}`.toLowerCase()
      return !normalizedQuery || haystack.includes(normalizedQuery)
    })

    return result.sort((a, b) => {
      const first = new Date(a.updated).getTime()
      const second = new Date(b.updated).getTime()
      return second - first
    })
  }, [normalizedQuery, notes])

  const noteGroups = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; notes: typeof filteredNotes }>()
    const unfiledGroup = { id: 'unfiled', name: t('notes.unfiled'), notes: [] as typeof filteredNotes }

    for (const note of filteredNotes) {
      const notebooks = note.notebooks?.length ? note.notebooks : [unfiledGroup]
      for (const notebook of notebooks) {
        const groupId = notebook.id
        const existing = groups.get(groupId)
        if (existing) {
          if (!existing.notes.some((item) => item.id === note.id)) {
            existing.notes.push(note)
          }
          continue
        }
        groups.set(groupId, {
          id: groupId,
          name: notebook.name,
          notes: [note],
        })
      }
    }

    // Groups by most recent activity (newest note in the group), most
    // recent first; "unfiled" stays last; ties fall back to name.
    const latestIn = (group: { notes: typeof filteredNotes }) =>
      group.notes.reduce((latest, note) => Math.max(latest, new Date(note.updated).getTime()), 0)

    return [...groups.values()].sort((a, b) => {
      if (a.id === unfiledGroup.id) return 1
      if (b.id === unfiledGroup.id) return -1
      const latestA = latestIn(a)
      const latestB = latestIn(b)
      return latestA !== latestB ? latestB - latestA : a.name.localeCompare(b.name)
    })
  }, [filteredNotes, t])

  // At most one group open at a time; zero is a valid resting state —
  // re-clicking an open group collapses it and nothing auto-reopens.
  const toggleGroup = (groupId: string) => {
    setExpandedGroupId((current) => (current === groupId ? null : groupId))
  }

  // Initial state only: open the group holding the most recently updated
  // note (filteredNotes[0] — the list is sorted by updated, desc). Fires
  // once, so a later user collapse is never undone.
  const autoExpandedInitial = useRef(false)
  useEffect(() => {
    if (autoExpandedInitial.current || noteGroups.length === 0) return
    autoExpandedInitial.current = true
    const mostRecentNoteId = filteredNotes[0]?.id
    const group = noteGroups.find((item) => item.notes.some((note) => note.id === mostRecentNoteId))
    if (group) setExpandedGroupId(group.id)
  }, [noteGroups, filteredNotes])

  useEffect(() => {
    if (filteredNotes.length === 0) {
      setSelectedNoteId(null)
      return
    }

    const isValid = Boolean(selectedNoteId) && filteredNotes.some((note) => note.id === selectedNoteId)

    // Desktop keeps a note selected so the reading pane is never empty.
    // Mobile leads with the list: a note only opens on an explicit tap, so
    // auto-selecting here would hide the list and undo the back button.
    if (isDesktop && !isValid) {
      setSelectedNoteId(filteredNotes[0].id)
    } else if (!isDesktop && selectedNoteId !== null && !isValid) {
      setSelectedNoteId(null)
    }
  }, [filteredNotes, selectedNoteId, isDesktop])

  const selectedSummary = filteredNotes.find((note) => note.id === selectedNoteId) ?? null
  const normalizedSelectedId = selectedNoteId ? normalizeNoteId(selectedNoteId) : ''
  const {
    data: selectedDetail,
    isLoading: isDetailLoading,
    isError: isDetailError,
    refetch: refetchDetail,
  } = useNote(normalizedSelectedId, { enabled: Boolean(normalizedSelectedId) })
  const selectedNote = selectedDetail ?? selectedSummary
  const stats = noteStats(selectedNote?.content ?? null)

  const listVisibleOnMobile = !selectedNoteId
  const isListCollapsed = listCollapsed && isDesktop
  // Mobile gives the reading pane the full viewport: the page header only
  // makes sense above the list, not above an open note.
  const showPageHeader = isDesktop || !selectedNoteId

  return (
    <AppShell hideMobileTopBar={Boolean(selectedNoteId)}>
      <div className="flex min-h-0 flex-1 flex-col">
        {showPageHeader ? (
          <header className="shrink-0 border-b border-border bg-background px-4 py-3 sm:px-6 sm:py-4">
            <PageHeader
              className="mb-0 sm:mb-0"
              title={t('notes.pageTitle')}
              description={t('notes.pageDescription')}
            />
          </header>
        ) : null}

        <div
          className={cn(
            'grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]',
            isListCollapsed ? 'lg:grid-cols-[3rem_minmax(0,1fr)]' : 'lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]'
          )}
        >
          <section className={cn('min-h-0 flex-col border-border lg:flex lg:border-r', listVisibleOnMobile ? 'flex' : 'hidden')}>
            <CollapsibleColumn
              isCollapsed={isListCollapsed}
              onToggle={() => setListCollapsed((current) => !current)}
              collapsedIcon={StickyNote}
              collapsedLabel={t('notes.listTitle')}
            >
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
                  <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t('notes.listTitle')}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{filteredNotes.length}</span>
                    {createCollapseButton(() => setListCollapsed(true), t('notes.listTitle'))}
                  </span>
                </div>

                <div className="shrink-0 border-b border-border px-4 py-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={t('notes.searchPlaceholder')}
                      aria-label={t('notes.searchPlaceholder')}
                      className="h-10 pl-9"
                    />
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  {isLoading ? (
                    <div className="flex h-full items-center justify-center p-8"><LoadingSpinner /></div>
                  ) : isError ? (
                    <EmptyState
                      icon={AlertCircle}
                      title={t('notes.loadErrorTitle')}
                      description={t('notes.loadErrorDescription')}
                      action={<Button variant="outline" size="sm" onClick={() => refetch()}>{t('common.retry')}</Button>}
                    />
                  ) : notes.length === 0 ? (
                    <EmptyState icon={StickyNote} title={t('notes.emptyTitle')} description={t('notes.emptyDescription')} />
                  ) : filteredNotes.length === 0 ? (
                    <EmptyState icon={Search} title={t('notes.noMatchesTitle')} description={t('notes.noMatchesDescription')} />
                  ) : (
                    <div role="list" aria-label={t('notes.listTitle')}>
                      {noteGroups.map((group) => (
                        <section key={group.id} aria-labelledby={`notes-group-${group.id}`}>
                          <button
                            type="button"
                            className="sticky top-0 z-10 flex min-h-11 w-full items-center justify-between border-b border-border bg-background/95 px-4 text-left backdrop-blur-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:h-10 sm:min-h-0"
                            onClick={() => toggleGroup(group.id)}
                            aria-expanded={expandedGroupId === group.id}
                            aria-controls={`notes-group-items-${group.id}`}
                          >
                              <span id={`notes-group-${group.id}`} className="flex min-w-0 items-center gap-2 text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                              {group.id === 'unfiled' ? <StickyNote className="h-3.5 w-3.5 text-muted-foreground" /> : <BookOpen className="h-3.5 w-3.5 text-primary-ink" />}
                              <span className="truncate">{group.name}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2 font-mono text-2xs text-muted-foreground">
                              {group.notes.length}
                              {expandedGroupId === group.id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </span>
                          </button>
                          <div id={`notes-group-items-${group.id}`} hidden={expandedGroupId !== group.id}>
                            {group.notes.map((note) => {
                              const isSelected = note.id === selectedNoteId
                              const isAi = note.note_type === 'ai'
                              return (
                                <div role="listitem" key={`${group.id}-${note.id}`}>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedNoteId(note.id)}
                                    aria-current={isSelected ? 'true' : undefined}
                                    className={cn(
                                       'group min-h-[116px] h-auto w-full overflow-hidden border-b border-border px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                                       isSelected ? 'border-l-2 border-l-primary-ink bg-primary-tint/50 pl-[14px]' : 'border-l-2 border-l-transparent hover:bg-accent'
                                    )}
                                  >
                                    <div className="flex items-start gap-3">
                                       <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-sm', isAi ? 'bg-primary-tint text-primary-ink' : 'bg-muted text-muted-foreground')}>
                                        {isAi ? <Sparkles className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold text-foreground">{note.title || t('notebooks.untitledNote')}</span>
                                        <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{notePreview(note.content) || t('notes.noContent')}</span>
                                        <span className="mt-2 block text-2xs text-muted-foreground">
                                          {formatDistanceToNow(new Date(note.updated), { addSuffix: true, locale: getDateLocale(language) })}
                                        </span>
                                      </span>
                                    </div>
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleColumn>
          </section>

          <article className={cn('min-h-0 flex-col', listVisibleOnMobile ? 'hidden lg:flex' : 'flex')}>
            {selectedNote ? (
              <>
                <div className="flex shrink-0 items-center px-2 py-1.5 lg:hidden">
                  <Button variant="ghost" size="sm" className="min-h-11 touch-manipulation" onClick={() => setSelectedNoteId(null)}>
                    <ChevronLeft className="h-4 w-4" />
                    {t('common.back')}
                  </Button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-10 md:py-12">
                    <h2 className="break-words font-display text-3xl font-semibold tracking-tight md:text-4xl">{selectedNote.title || t('notebooks.untitledNote')}</h2>
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{t('notes.readingTime', { minutes: stats.minutes })}</span>
                      <span>{t('notes.wordCount', { count: stats.words })}</span>
                    </div>
                    <div className="mt-8 border-t border-border pt-8">
                      {isDetailLoading && !selectedDetail ? (
                        <div className="flex justify-center py-12"><LoadingSpinner /></div>
                      ) : isDetailError && !selectedDetail ? (
                        <EmptyState
                          icon={AlertCircle}
                          title={t('notes.detailErrorTitle')}
                          description={t('notes.detailErrorDescription')}
                          action={<Button variant="outline" size="sm" onClick={() => refetchDetail()}>{t('common.retry')}</Button>}
                        />
                      ) : selectedNote.content ? (
                        <MarkdownRenderer>{selectedNote.content}</MarkdownRenderer>
                      ) : (
                        <p className="text-sm text-muted-foreground">{t('notes.noContent')}</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center px-6">
                <EmptyState icon={BookOpen} title={t('notes.selectTitle')} description={t('notes.selectDescription')} />
              </div>
            )}
          </article>
        </div>
      </div>
    </AppShell>
  )
}
