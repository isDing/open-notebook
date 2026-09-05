'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookOpenCheck, MessageSquare } from 'lucide-react'
import { useIsDesktop } from '@/lib/hooks/use-media-query'
import { useTranslation } from '@/lib/hooks/use-translation'
import { useNotebookColumnsStore } from '@/lib/stores/notebook-columns-store'
import { cn } from '@/lib/utils'
import type { NoteResponse, SourceListResponse } from '@/lib/types/api'
import type {
  ContextMode,
  ContextSelections,
  NoteContextMode,
} from '@/lib/types/notebook-context'
import type { NoteContextDefault, SourceBulkAction } from '@/lib/utils/source-context'
import { ChatColumn } from './ChatColumn'
import { NotebookContextPanel } from './NotebookContextPanel'

interface NotebookWorkspaceProps {
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
}

type MobileTab = 'chat' | 'context'

/** Chat-first workspace for the notebook detail page.
 *
 * Desktop: a fixed-width context panel on the left, chat on the right.
 * Mobile: Chat / Context primary tabs; Sources / Notes switch inside the
 * Context tab. useIsDesktop() picks exactly one branch so there is only ever
 * one ChatColumn (and therefore one useNotebookChat) mounted; inside the
 * mobile tabs, forceMount keeps every column mounted across tab switches. */
export function NotebookWorkspace({
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
}: NotebookWorkspaceProps) {
  const { t } = useTranslation()
  const isDesktop = useIsDesktop()

  // Mobile primary tab; chat is the default because chat is the primary task.
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat')

  // The desktop grid column shrinks to the ~48px rail when the context panel
  // is collapsed so chat fills the remaining space. Reading the store here
  // (not business state) keeps the layout and the panel in sync. Gated on
  // hasHydrated so the server/first render always uses the expanded column.
  const { contextPanelCollapsed, hasHydrated } = useNotebookColumnsStore()
  const panelCollapsed = hasHydrated && contextPanelCollapsed

  const chatProps = {
    notebookId,
    contextSelections,
    sources,
    sourcesLoading,
    notes,
    notesLoading,
  }

  const contextProps = {
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
  }

  return (
    <div className="min-h-0 flex-1 p-3 sm:p-4 lg:p-5">
      {isDesktop ? (
        <div
          className={cn(
            'grid h-full min-h-0 gap-4 transition-[grid-template-columns] duration-150',
            panelCollapsed
              ? 'lg:grid-cols-[3rem_minmax(0,1fr)]'
              : 'lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]'
          )}
        >
          <div className="min-h-0 min-w-0">
            <NotebookContextPanel {...contextProps} collapsible={true} />
          </div>
          <div className="min-h-0 min-w-0">
            <ChatColumn {...chatProps} />
          </div>
        </div>
      ) : (
        <Tabs
          value={mobileTab}
          onValueChange={(value) => setMobileTab(value as MobileTab)}
          className="flex h-full min-h-0 flex-col"
          aria-label={t('notebooks.workspaceViews')}
        >
          <TabsList className="grid w-full shrink-0 grid-cols-2">
            <TabsTrigger value="chat">
              <MessageSquare className="h-4 w-4" />
              {t('notebooks.chatTab')}
            </TabsTrigger>
            <TabsTrigger value="context">
              <BookOpenCheck className="h-4 w-4" />
              {t('notebooks.contextTab')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="chat" forceMount className="min-h-0 flex-1 overflow-hidden">
            <ChatColumn {...chatProps} />
          </TabsContent>
          <TabsContent value="context" forceMount className="min-h-0 flex-1 overflow-hidden">
            <NotebookContextPanel {...contextProps} collapsible={false} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
