'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowDownAZ,
  ArrowUpAZ,
  BookOpen,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Clock3,
  RefreshCw,
  Search,
  Sparkles,
  StickyNote,
  UserRound,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { AppShell } from '@/components/layout/AppShell'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { MarkdownRenderer } from '@/components/ui/markdown-renderer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAllNotes, useNote } from '@/lib/hooks/use-notes'
import { useTranslation } from '@/lib/hooks/use-translation'
import { getDateLocale } from '@/lib/utils/date-locale'
import { cn } from '@/lib/utils'

type NoteSort = 'updated-desc' | 'updated-asc'

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
  const [sort, setSort] = useState<NoteSort>('updated-desc')
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const { data: notes = [], isLoading, isError, refetch } = useAllNotes()
  const normalizedQuery = query.trim().toLowerCase()

  const filteredNotes = useMemo(() => {
    const result = notes.filter((note) => {
      const haystack = `${note.title ?? ''} ${note.content ?? ''}`.toLowerCase()
      return !normalizedQuery || haystack.includes(normalizedQuery)
    })

    return result.sort((a, b) => {
      const first = new Date(a.updated).getTime()
      const second = new Date(b.updated).getTime()
      return sort === 'updated-desc' ? second - first : first - second
    })
  }, [normalizedQuery, notes, sort])

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

    return [...groups.values()].sort((a, b) => {
      if (a.id === unfiledGroup.id) return 1
      if (b.id === unfiledGroup.id) return -1
      return a.name.localeCompare(b.name)
    })
  }, [filteredNotes, t])

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  useEffect(() => {
    if (filteredNotes.length === 0) {
      setSelectedNoteId(null)
      return
    }
    if (!selectedNoteId || !filteredNotes.some((note) => note.id === selectedNoteId)) {
      setSelectedNoteId(filteredNotes[0].id)
    }
  }, [filteredNotes, selectedNoteId])

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

  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-border bg-background px-4 py-5 md:px-6">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5 text-teal" />
                {t('notes.reading')}
              </p>
              <h1 className="break-words font-display text-2xl font-bold tracking-tight">{t('notes.title')}</h1>
              <p className="mt-1 max-w-2xl break-words text-sm text-muted-foreground">{t('notes.description')}</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isLoading}
              aria-label={t('common.refresh')}
              title={t('common.refresh')}
              className="h-11 w-11 shrink-0 sm:h-9 sm:w-9"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1 lg:max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('notes.searchPlaceholder')}
                aria-label={t('notes.searchPlaceholder')}
                className="h-11 pl-9 sm:h-9"
              />
            </div>

            <Select value={sort} onValueChange={(value) => setSort(value as NoteSort)}>
              <SelectTrigger className="h-11 w-full lg:h-9 lg:w-44" aria-label={t('notes.sortLabel')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated-desc">
                  <span className="flex items-center gap-2"><ArrowDownAZ className="h-3.5 w-3.5" />{t('notes.sortRecent')}</span>
                </SelectItem>
                <SelectItem value="updated-asc">
                  <span className="flex items-center gap-2"><ArrowUpAZ className="h-3.5 w-3.5" />{t('notes.sortOldest')}</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
          <section className={cn('min-h-0 flex-col border-border lg:flex lg:border-r', listVisibleOnMobile ? 'flex' : 'hidden')}>
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t('notes.reading')}</span>
              <span className="font-mono text-xs text-muted-foreground">{filteredNotes.length}</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
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
                <div role="list" aria-label={t('notes.reading')}>
                  {noteGroups.map((group) => (
                    <section key={group.id} aria-labelledby={`notes-group-${group.id}`}>
                      <button
                        type="button"
                        className="sticky top-0 z-10 flex min-h-11 w-full items-center justify-between border-b border-border bg-background/95 px-4 text-left backdrop-blur-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:h-10 sm:min-h-0"
                        onClick={() => toggleGroup(group.id)}
                        aria-expanded={!collapsedGroups.has(group.id)}
                        aria-controls={`notes-group-items-${group.id}`}
                      >
                        <span id={`notes-group-${group.id}`} className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                          {group.id === 'unfiled' ? <StickyNote className="h-3.5 w-3.5 text-gold" /> : <BookOpen className="h-3.5 w-3.5 text-teal" />}
                          <span className="truncate">{group.name}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2 font-mono text-[11px] text-muted-foreground">
                          {group.notes.length}
                          {collapsedGroups.has(group.id) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </span>
                      </button>
                      <div id={`notes-group-items-${group.id}`} hidden={collapsedGroups.has(group.id)}>
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
                                  isSelected ? 'border-l-2 border-l-teal bg-teal-tint/40 pl-[14px]' : 'border-l-2 border-l-transparent hover:bg-accent'
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-sm', isAi ? 'bg-teal-tint text-teal' : 'bg-gold-tint text-gold-deep')}>
                                    {isAi ? <Sparkles className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-foreground">{note.title || t('notebooks.untitledNote')}</span>
                                    <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{notePreview(note.content) || t('notes.noContent')}</span>
                                    <span className="mt-2 block text-[11px] text-muted-foreground">
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
          </section>

          <article className={cn('min-h-0 flex-col', listVisibleOnMobile ? 'hidden lg:flex' : 'flex')}>
            {selectedNote ? (
              <>
                <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 md:px-8">
                  <Button variant="ghost" size="sm" className="min-h-11 touch-manipulation lg:hidden" onClick={() => setSelectedNoteId(null)}>
                    <ChevronLeft className="h-4 w-4" />
                    {t('common.back')}
                  </Button>
                  <div className="hidden h-4 w-px bg-border lg:block" />
                  <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                    {selectedNote.note_type === 'ai' ? <Sparkles className="h-3.5 w-3.5 text-teal" /> : <UserRound className="h-3.5 w-3.5 text-gold" />}
                    <Badge variant="outline">{selectedNote.note_type === 'ai' ? t('common.aiGenerated') : t('common.human')}</Badge>
                    <span className="hidden sm:inline">{t('common.updated', { time: formatDistanceToNow(new Date(selectedNote.updated), { addSuffix: true, locale: getDateLocale(language) }) })}</span>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-10 md:py-12">
                    <h2 className="break-words font-display text-3xl font-bold tracking-tight md:text-4xl">{selectedNote.title || t('notebooks.untitledNote')}</h2>
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
