'use client'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { FileText, PanelLeftClose, PanelLeftOpen, StickyNote } from 'lucide-react'
import { useTranslation } from '@/lib/hooks/use-translation'
import { useNotebookColumnsStore } from '@/lib/stores/notebook-columns-store'
import type { NoteResponse, SourceListResponse } from '@/lib/types/api'
import type {
  ContextMode,
  ContextSelections,
  NoteContextMode,
} from '@/lib/types/notebook-context'
import type { NoteContextDefault, SourceBulkAction } from '@/lib/utils/source-context'
import { NotesColumn } from './NotesColumn'
import { SourcesColumn } from './SourcesColumn'

interface NotebookContextPanelProps {
  notebookId: string
  notebookName?: string
  sources: SourceListResponse[]
  notes: NoteResponse[]
  sourcesLoading: boolean
  notesLoading: boolean
  refetchSources: () => void
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  fetchNextPage?: () => void
  contextSelections: ContextSelections
  onSourceContextModeChange: (sourceId: string, mode: ContextMode) => void
  onBulkSourceContextChange: (action: SourceBulkAction) => void
  onNoteContextModeChange: (noteId: string, mode: NoteContextMode) => void
  onBulkNoteContextChange: (action: NoteContextDefault) => void
  collapsible?: boolean
}

/** Sources/Notes context panel for the notebook detail page.
 *
 * Wraps the existing SourcesColumn and NotesColumn in a Sources/Notes tab
 * pair (both contents stay mounted via forceMount) and, when collapsible,
 * offers collapsing the whole panel into a narrow rail. The per-column
 * collapse behavior is disabled because the panel owns the collapsed state. */
export function NotebookContextPanel({
  notebookId,
  notebookName,
  sources,
  notes,
  sourcesLoading,
  notesLoading,
  refetchSources,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  contextSelections,
  onSourceContextModeChange,
  onBulkSourceContextChange,
  onNoteContextModeChange,
  onBulkNoteContextChange,
  collapsible = true,
}: NotebookContextPanelProps) {
  const { t } = useTranslation()
  const { contextPanelCollapsed, toggleContextPanel, hasHydrated } = useNotebookColumnsStore()

  // Until the persisted preference is hydrated, render the expanded panel so
  // the server and the first client render agree (no layout flash).
  const isCollapsed = collapsible && hasHydrated && contextPanelCollapsed

  if (isCollapsed) {
    return (
      <div
        data-testid="context-panel-rail"
        className="flex h-full w-12 min-h-0 items-center justify-center rounded-lg border border-border bg-card"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              aria-label={t('notebooks.expandContext')}
              aria-expanded={false}
              onClick={toggleContextPanel}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{t('notebooks.expandContext')}</TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs
        defaultValue="sources"
        aria-label={t('notebooks.contextPanel')}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex shrink-0 items-center gap-1">
          <TabsList className="grid w-full flex-1 grid-cols-2">
            <TabsTrigger value="sources" className="gap-2">
              <FileText aria-hidden className="h-4 w-4" />
              {t('notebooks.sourcesTab')}
              <span aria-hidden className="text-xs text-muted-foreground">
                ({sources.length})
              </span>
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-2">
              <StickyNote aria-hidden className="h-4 w-4" />
              {t('notebooks.notesTab')}
              <span aria-hidden className="text-xs text-muted-foreground">
                ({notes.length})
              </span>
            </TabsTrigger>
          </TabsList>
          {collapsible && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 sm:h-9 sm:w-9"
                  aria-label={t('notebooks.collapseContext')}
                  aria-expanded
                  onClick={toggleContextPanel}
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('notebooks.collapseContext')}</TooltipContent>
            </Tooltip>
          )}
        </div>

        <TabsContent value="sources" forceMount className="min-h-0 flex-1 overflow-hidden">
          <SourcesColumn
            sources={sources}
            isLoading={sourcesLoading}
            notebookId={notebookId}
            notebookName={notebookName}
            onRefresh={refetchSources}
            contextSelections={contextSelections.sources}
            onContextModeChange={onSourceContextModeChange}
            onBulkContextModeChange={onBulkSourceContextChange}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
            collapsible={false}
          />
        </TabsContent>
        <TabsContent value="notes" forceMount className="min-h-0 flex-1 overflow-hidden">
          <NotesColumn
            notes={notes}
            isLoading={notesLoading}
            notebookId={notebookId}
            contextSelections={contextSelections.notes}
            onContextModeChange={onNoteContextModeChange}
            onBulkContextModeChange={onBulkNoteContextChange}
            collapsible={false}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
