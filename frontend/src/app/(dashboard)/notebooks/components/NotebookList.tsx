'use client'

import { NotebookResponse } from '@/lib/types/api'
import { NotebookCard } from './NotebookCard'
import { NotebookRow } from './NotebookRow'
import { useNotebookViewStore } from '@/lib/stores/notebook-view-store'
import { CollectionSkeleton } from '@/components/common/CollectionSkeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { AlertCircle, Book, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { memo, useState } from 'react'
import { useTranslation } from '@/lib/hooks/use-translation'

interface NotebookListProps {
  notebooks?: NotebookResponse[]
  isLoading: boolean
  isError?: boolean
  onRetry?: () => void
  title: string
  collapsible?: boolean
  emptyTitle?: string
  emptyDescription?: string
  onAction?: () => void
  actionLabel?: string
}

export const NotebookList = memo(function NotebookList({
  notebooks, 
  isLoading, 
  isError,
  onRetry,
  title, 
  collapsible = false,
  emptyTitle,
  emptyDescription,
  onAction,
  actionLabel,
}: NotebookListProps) {
  const { t } = useTranslation()
  const viewMode = useNotebookViewStore((state) => state.viewMode)
  const [isExpanded, setIsExpanded] = useState(!collapsible)

  if (isLoading) {
    return <CollectionSkeleton view={viewMode} />
  }

  if (isError) {
    return <EmptyState icon={AlertCircle} title={t('common.contentUnavailable.errorTitle')}
      description={t('common.contentUnavailable.errorDescription')}
      action={onRetry && <Button variant="outline" onClick={onRetry}>{t('common.retry')}</Button>} />
  }

  if (!notebooks || notebooks.length === 0) {
    return (
      <EmptyState
        icon={Book}
        title={emptyTitle ?? t('common.noResults')}
        description={emptyDescription ?? t('chat.startByCreating')}
        action={onAction && actionLabel ? (
          <Button onClick={onAction} variant="outline" className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            {actionLabel}
          </Button>
        ) : undefined}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex min-w-0 items-center gap-2">
        {collapsible && (
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 sm:h-8 sm:w-8"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={title}
            aria-expanded={isExpanded}
            title={title}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        )}
        <h2 className="min-w-0 truncate font-display text-lg font-semibold tracking-tight">{title}</h2>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{notebooks.length}</span>
      </div>

      {isExpanded && (
        viewMode === 'list' ? (
          <div className="flex flex-col gap-2">
            {notebooks.map((notebook) => (
              <NotebookRow key={notebook.id} notebook={notebook} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {notebooks.map((notebook) => (
              <NotebookCard key={notebook.id} notebook={notebook} />
            ))}
          </div>
        )
      )}
    </div>
  )
})
