'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { sourcesApi, type SourceSortField } from '@/lib/api/sources'
import { SourceListResponse } from '@/lib/types/api'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { EmptyState } from '@/components/common/EmptyState'
import { AppShell } from '@/components/layout/AppShell'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { PageHeader } from '@/components/common/PageHeader'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  FileText,
  Globe,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Type,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useTranslation } from '@/lib/hooks/use-translation'
import { getDateLocale } from '@/lib/utils/date-locale'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getApiErrorKey } from '@/lib/utils/error-handler'
import { AddSourceDialog } from '@/components/sources/AddSourceDialog'

const PAGE_SIZE = 30
const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

type SourceType = 'link' | 'file' | 'text'
type SourceFilter = 'all' | 'recent' | 'file' | 'link'
type ViewMode = 'tile' | 'list'

const SORT_FIELDS: SourceSortField[] = [
  'type',
  'title',
  'created',
  'updated',
  'insights_count',
  'embedded',
]

const SORT_FIELD_KEYS: Record<SourceSortField, string> = {
  type: 'sources.sortType',
  title: 'sources.sortTitle',
  created: 'sources.sortCreated',
  updated: 'sources.sortUpdated',
  insights_count: 'sources.sortInsights',
  embedded: 'sources.sortIndexed',
}

const FILTERS: Array<{ id: SourceFilter; labelKey: string }> = [
  { id: 'all', labelKey: 'sources.filterAll' },
  { id: 'recent', labelKey: 'sources.filterRecent' },
  { id: 'file', labelKey: 'sources.filterFile' },
  { id: 'link', labelKey: 'sources.filterLink' },
]

const TYPE_LABEL_KEYS: Record<SourceType, string> = {
  link: 'sources.type.link',
  file: 'sources.type.file',
  text: 'sources.type.text',
}

function getSourceType(source: SourceListResponse): SourceType {
  if (source.asset?.url) return 'link'
  if (source.asset?.file_path) return 'file'
  return 'text'
}

function SourceTypeIcon({ type, className }: { type: SourceType; className?: string }) {
  if (type === 'link') return <Globe className={className} aria-hidden="true" />
  if (type === 'text') return <Type className={className} aria-hidden="true" />
  return <FileText className={className} aria-hidden="true" />
}

function getSourceTypeTileClass(type: SourceType) {
  if (type === 'link') return 'bg-type-web-soft text-type-web'
  if (type === 'file') return 'bg-type-pdf-soft text-type-pdf'
  return 'bg-type-note-soft text-type-note'
}

interface SourceTileProps {
  source: SourceListResponse
  onDelete: () => void
}

function SourceTile({ source, onDelete }: SourceTileProps) {
  const { t, language } = useTranslation()
  const router = useRouter()
  const type = getSourceType(source)
  const title = source.title || t('sources.untitledSource')

  return (
    <Card
      className="group card-hover gap-0 p-5 sm:p-6"
      onClick={() => router.push(`/sources/${source.id}`)}
      style={{ cursor: 'pointer' }}
    >
      <div className="flex items-start gap-3.5">
        <div
          className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg border', getSourceTypeTileClass(type))}
          aria-hidden="true"
        >
          <SourceTypeIcon type={type} className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <h3 className="min-w-0 truncate text-[15px] font-semibold" title={title}>
              {title}
            </h3>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label={t('common.actions')}
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('common.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex h-6 items-center rounded-md bg-muted px-2 text-xs font-medium text-muted-foreground">
              {t(TYPE_LABEL_KEYS[type])}
            </span>
            <span
              className={cn(
                'inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium',
                source.embedded ? 'bg-accent text-foreground' : 'bg-muted text-muted-foreground'
              )}
            >
              {source.embedded && <Check className="h-3 w-3" aria-hidden="true" />}
              {source.embedded ? t('sources.indexed') : t('sources.notIndexed')}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 text-xs text-muted-foreground">
        <div className="min-w-0">
          {source.asset?.url && (
            <p className="truncate" title={source.asset.url}>
              {source.asset.url}
            </p>
          )}
          <p className="mt-0.5">
            {t('common.updated', {
              time: formatDistanceToNow(new Date(source.updated), {
                addSuffix: true,
                locale: getDateLocale(language)
              })
            })}
          </p>
        </div>
        {source.insights_count > 0 && (
          <span className="shrink-0">
            {t('sources.insightsCount', { count: source.insights_count })}
          </span>
        )}
      </div>
    </Card>
  )
}

export default function SourcesPage() {
  const { t, language } = useTranslation()
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false)
  const failedToLoadMessage = t('sources.failedToLoad')
  const [sources, setSources] = useState<SourceListResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [sortBy, setSortBy] = useState<SourceSortField>('updated')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('tile')
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<SourceFilter>('all')
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; source: SourceListResponse | null }>({
    open: false,
    source: null
  })
  const router = useRouter()
  const tableRef = useRef<HTMLTableElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)
  const loadingMoreRef = useRef(false)
  const hasMoreRef = useRef(true)

  const displayedSources = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const recentCutoff = filter === 'recent' ? Date.now() - RECENT_WINDOW_MS : null

    return sources.filter((source) => {
      if (
        query &&
        !(source.title ?? '').toLowerCase().includes(query) &&
        !(source.asset?.url ?? '').toLowerCase().includes(query)
      ) {
        return false
      }
      if (filter === 'file' && !source.asset?.file_path) return false
      if (filter === 'link' && !source.asset?.url) return false
      if (recentCutoff) {
        const created = new Date(source.created).getTime()
        if (Number.isNaN(created) || created < recentCutoff) return false
      }
      return true
    })
  }, [sources, searchTerm, filter])

  const fetchSources = useCallback(async (reset = false) => {
    try {
      // Check flags before proceeding
      if (!reset && (loadingMoreRef.current || !hasMoreRef.current)) {
        return
      }

      if (reset) {
        setLoading(true)
        offsetRef.current = 0
        setSources([])
        hasMoreRef.current = true
      } else {
        loadingMoreRef.current = true
        setLoadingMore(true)
      }

      const data = await sourcesApi.list({
        limit: PAGE_SIZE,
        offset: offsetRef.current,
        sort_by: sortBy,
        sort_order: sortOrder,
      })

      if (reset) {
        setSources(data)
      } else {
        setSources(prev => [...prev, ...data])
      }

      // Check if we have more data
      const hasMoreData = data.length === PAGE_SIZE
      hasMoreRef.current = hasMoreData
      offsetRef.current += data.length
    } catch (err) {
      console.error('Failed to fetch sources:', err)
      setError(failedToLoadMessage)
      toast.error(failedToLoadMessage)
    } finally {
      setLoading(false)
      setLoadingMore(false)
      loadingMoreRef.current = false
    }
  }, [sortBy, sortOrder, failedToLoadMessage])

  // Initial load and when sort changes
  useEffect(() => {
    fetchSources(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder])

  useEffect(() => {
    setSelectedIndex(0)
  }, [searchTerm, filter])

  useEffect(() => {
    if (viewMode === 'list' && tableRef.current) {
      tableRef.current.focus()
    }
  }, [viewMode])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== 'list' || displayedSources.length === 0) return
      if (document.activeElement !== tableRef.current) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => {
            const newIndex = Math.min(prev + 1, displayedSources.length - 1)
            // Scroll to keep selected row visible
            setTimeout(() => scrollToSelectedRow(newIndex), 0)
            return newIndex
          })
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => {
            const newIndex = Math.max(prev - 1, 0)
            // Scroll to keep selected row visible
            setTimeout(() => scrollToSelectedRow(newIndex), 0)
            return newIndex
          })
          break
        case 'Enter':
          e.preventDefault()
          if (displayedSources[selectedIndex]) {
            router.push(`/sources/${displayedSources[selectedIndex].id}`)
          }
          break
        case 'Home':
          e.preventDefault()
          setSelectedIndex(0)
          setTimeout(() => scrollToSelectedRow(0), 0)
          break
        case 'End':
          e.preventDefault()
          const lastIndex = displayedSources.length - 1
          setSelectedIndex(lastIndex)
          setTimeout(() => scrollToSelectedRow(lastIndex), 0)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewMode, displayedSources, selectedIndex, router])

  const scrollToSelectedRow = (index: number) => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    // Find the selected row element
    const rows = scrollContainer.querySelectorAll('tbody tr')
    const selectedRow = rows[index] as HTMLElement
    if (!selectedRow) return

    const containerRect = scrollContainer.getBoundingClientRect()
    const rowRect = selectedRow.getBoundingClientRect()

    // Check if row is above visible area
    if (rowRect.top < containerRect.top) {
      selectedRow.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    // Check if row is below visible area
    else if (rowRect.bottom > containerRect.bottom) {
      selectedRow.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }

  // Set up scroll listener after sources are loaded
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    let scrollTimeout: NodeJS.Timeout | null = null

    const handleScroll = () => {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }

      scrollTimeout = setTimeout(() => {
        if (!scrollContainerRef.current) return

        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight

        // Load more when within 200px of the bottom
        if (distanceFromBottom < 200 && !loadingMoreRef.current && hasMoreRef.current) {
          fetchSources(false)
        }
      }, 100)
    }

    scrollContainer.addEventListener('scroll', handleScroll)
    handleScroll() // Check on mount

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll)
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }
    }
  }, [fetchSources, sources.length])

  const toggleSort = (field: SourceSortField) => {
    setSelectedIndex(0)
    if (sortBy === field) {
      // Toggle order if clicking the same field
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      // Switch to new field with default desc order
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const renderSortableHeader = (
    field: SourceSortField,
    label: string,
    align: 'left' | 'center' = 'left'
  ) => {
    const active = sortBy === field
    const SortIcon = active ? (sortOrder === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown

    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggleSort(field)}
        aria-label={label}
        title={label}
        className={cn(
          "h-11 min-w-0 max-w-full px-1 hover:bg-muted sm:h-8 sm:px-2",
          align === 'center' && "mx-auto"
        )}
      >
        <span className={cn('min-w-0 truncate', field === 'type' && 'sr-only sm:not-sr-only')}>
          {label}
        </span>
        <SortIcon className={cn(
          "h-3 w-3 shrink-0 sm:ml-2",
          active ? 'opacity-100' : 'opacity-30'
        )} />
      </Button>
    )
  }

  // Content-type pebble — type hues live in dots, never washes
  const getSourceTypeDotClass = (source: SourceListResponse) => {
    if (source.asset?.url) return 'bg-type-web'
    if (source.asset?.file_path) return 'bg-type-pdf'
    return 'bg-type-note'
  }

  const getSourceTypeLabel = (source: SourceListResponse) => {
    return t(TYPE_LABEL_KEYS[getSourceType(source)])
  }

  const handleRowClick = useCallback((index: number, sourceId: string) => {
    setSelectedIndex(index)
    router.push(`/sources/${sourceId}`)
  }, [router])

  const openDeleteDialog = useCallback((source: SourceListResponse) => {
    setDeleteDialog({ open: true, source })
  }, [])

  const handleDeleteClick = useCallback((e: React.MouseEvent, source: SourceListResponse) => {
    e.stopPropagation() // Prevent row click
    openDeleteDialog(source)
  }, [openDeleteDialog])

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.source) return

    try {
      await sourcesApi.delete(deleteDialog.source.id)
      toast.success(t('sources.deleteSuccess'))
      // Remove the deleted source from the list
      setSources(prev => prev.filter(s => s.id !== deleteDialog.source?.id))
      setDeleteDialog({ open: false, source: null })
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }, message?: string };
      console.error('Failed to delete source:', error)
      toast.error(t(getApiErrorKey(error.response?.data?.detail || error.message)))
    }
  }

  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 flex-col px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="source-search"
              name="source-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t('sources.searchPlaceholder')}
              autoComplete="off"
              aria-label={t('sources.searchPlaceholder')}
              className="h-11 pl-9"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              className="h-11 px-5"
              onClick={() => setSourceDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              {t('sources.newSource')}
            </Button>
            <div className="flex w-fit items-center rounded-md border p-0.5">
              <Button
                variant={viewMode === 'tile' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-10 w-10 p-0"
                onClick={() => setViewMode('tile')}
                aria-label={t('sources.tileView')}
                aria-pressed={viewMode === 'tile'}
                title={t('sources.tileView')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-10 w-10 p-0"
                onClick={() => setViewMode('list')}
                aria-label={t('sources.listView')}
                aria-pressed={viewMode === 'list'}
                title={t('sources.listView')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <PageHeader
          title={t('sources.title')}
          description={t('sources.pageDescription')}
          className="mt-6 sm:mt-8"
        />

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={AlertCircle}
              title={t('sources.failedToLoad')}
              description={t('common.refreshPage')}
            />
          </div>
        ) : sources.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={FileText}
              title={t('sources.noSourcesYet')}
              description={t('sources.createFirstSource')}
              action={
                <Button onClick={() => setSourceDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  {t('sources.newSource')}
                </Button>
              }
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-baseline gap-2">
              <h2 className="text-base font-semibold tracking-tight">
                {t('sources.allSources')}
              </h2>
              <span className="text-sm text-muted-foreground">
                {t('sources.count', { count: displayedSources.length })}
              </span>
            </div>
            <Separator className="mt-3" />

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div
                role="tablist"
                aria-label={t('sources.filterLabel')}
                className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1"
              >
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === f.id}
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      'h-8 shrink-0 rounded-md px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      filter === f.id
                        ? 'bg-popover text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {t(f.labelKey)}
                  </button>
                ))}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 gap-1 px-3 text-muted-foreground"
                    aria-label={`${t('sources.sortLabel')}: ${t(SORT_FIELD_KEYS[sortBy])}, ${sortOrder === 'asc' ? t('sources.sortAsc') : t('sources.sortDesc')}`}
                  >
                    {t('sources.sortLabel')}
                    <span className="font-medium text-foreground">
                      {t(SORT_FIELD_KEYS[sortBy])}
                    </span>
                    {sortOrder === 'asc' ? (
                      <ArrowUp className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {SORT_FIELDS.map((field) => (
                    <DropdownMenuItem
                      key={field}
                      onClick={() => toggleSort(field)}
                      className={cn(sortBy === field && 'bg-accent')}
                    >
                      {t(SORT_FIELD_KEYS[field])}
                      {sortBy === field && <Check className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div
              ref={scrollContainerRef}
              className={cn(
                'mt-4 min-h-0 flex-1 overflow-auto overscroll-contain',
                viewMode === 'list' && 'rounded-md border'
              )}
            >
              {displayedSources.length === 0 ? (
                <div className="flex h-full min-h-[20rem] items-center justify-center">
                  <EmptyState
                    icon={Search}
                    title={t('common.noMatches')}
                    description={t('common.tryDifferentSearch')}
                  />
                </div>
              ) : viewMode === 'tile' ? (
                <>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 min-[1800px]:grid-cols-3">
                    {displayedSources.map((source) => (
                      <SourceTile
                        key={source.id}
                        source={source}
                        onDelete={() => openDeleteDialog(source)}
                      />
                    ))}
                    {loadingMore && (
                      <div className="col-span-full flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                        <LoadingSpinner className="h-4 w-4" />
                        <span>{t('sources.loadingMore')}</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-8 px-1 text-xs leading-5 text-muted-foreground">
                    {t('sources.indexedNote')}
                  </p>
                </>
              ) : (
                <table
                  ref={tableRef}
                  tabIndex={0}
                  aria-label={t('sources.allSources')}
                  className="w-full sm:min-w-[920px] outline-none table-fixed"
                >
                  <colgroup>
                    <col className="w-[80px] sm:w-[120px]" />
                    <col className="w-auto" />
                    <col className="hidden w-[140px] sm:table-column" />
                    <col className="hidden w-[140px] sm:table-column" />
                    <col className="hidden w-[110px] md:table-column" />
                    <col className="hidden w-[150px] lg:table-column" />
                    <col className="w-[52px] sm:w-[100px]" />
                  </colgroup>
                  <thead className="sticky top-0 bg-background z-10">
                    <tr className="border-b">
                      <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground sm:px-4">
                        {renderSortableHeader('type', t('common.type'))}
                      </th>
                      <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground sm:px-4">
                        {renderSortableHeader('title', t('common.title'))}
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground hidden sm:table-cell">
                        {renderSortableHeader('created', t('common.created_label'))}
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground hidden sm:table-cell">
                        {renderSortableHeader('updated', t('common.updated_label'))}
                      </th>
                      <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground hidden md:table-cell">
                        {renderSortableHeader('insights_count', t('sources.insights'), 'center')}
                      </th>
                      <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground hidden lg:table-cell">
                        {renderSortableHeader('embedded', t('sources.embedded'), 'center')}
                      </th>
                      <th className="h-12 px-1 text-right align-middle font-medium text-muted-foreground sm:px-4">
                        <span className="sr-only sm:not-sr-only">{t('common.actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedSources.map((source, index) => (
                      <tr
                        key={source.id}
                        onClick={() => handleRowClick(index, source.id)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={cn(
                          "border-b transition-colors cursor-pointer",
                          selectedIndex === index
                            ? "bg-accent"
                            : "hover:bg-[var(--surface-raised)]"
                        )}
                      >
                        <td className="h-12 px-2 sm:px-4">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              aria-hidden
                              className={cn('h-2 w-2 shrink-0 rounded-full', getSourceTypeDotClass(source))}
                            />
                            <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {getSourceTypeLabel(source)}
                            </span>
                          </div>
                        </td>
                        <td className="h-12 px-2 sm:px-4">
                          <div className="flex flex-col overflow-hidden">
                            <span className="font-medium truncate">
                              {source.title || t('sources.untitledSource')}
                            </span>
                            {source.asset?.url && (
                              <span className="text-xs text-muted-foreground truncate">
                                {source.asset.url}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="h-12 px-4 text-muted-foreground text-sm hidden sm:table-cell">
                          {formatDistanceToNow(new Date(source.created), {
                            addSuffix: true,
                            locale: getDateLocale(language)
                          })}
                        </td>
                        <td className="h-12 px-4 text-muted-foreground text-sm hidden sm:table-cell">
                          {formatDistanceToNow(new Date(source.updated), {
                            addSuffix: true,
                            locale: getDateLocale(language)
                          })}
                        </td>
                        <td className="h-12 px-4 text-center hidden md:table-cell">
                          <span className="text-sm font-medium">{source.insights_count || 0}</span>
                        </td>
                        <td className="h-12 px-4 text-center hidden lg:table-cell">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium",
                              source.embedded
                                ? "bg-fern-tint text-fern-deep dark:text-fern"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {source.embedded ? t('sources.yes') : t('sources.no')}
                          </span>
                        </td>
                        <td className="h-12 px-1 text-right sm:px-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDeleteClick(e, source)}
                            className="h-11 w-11 text-destructive hover:text-destructive sm:h-9 sm:w-9"
                            aria-label={t('sources.delete')}
                            title={t('sources.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {loadingMore && (
                      <tr>
                        <td colSpan={7} className="h-16 text-center">
                          <div className="flex items-center justify-center">
                            <LoadingSpinner />
                            <span className="ml-2 text-muted-foreground">{t('sources.loadingMore')}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, source: deleteDialog.source })}
        title={t('sources.delete')}
        description={t('sources.deleteConfirmWithTitle', { title: deleteDialog.source?.title || t('sources.untitledSource') })}
        confirmText={t('common.delete')}
        confirmVariant="destructive"
        onConfirm={handleDeleteConfirm}
      />
      <AddSourceDialog
        open={sourceDialogOpen}
        onOpenChange={(open) => {
          setSourceDialogOpen(open)
          if (!open) fetchSources(true)
        }}
      />
    </AppShell>
  )
}
