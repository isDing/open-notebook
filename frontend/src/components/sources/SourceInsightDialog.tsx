'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckboxList } from '@/components/ui/checkbox-list'
import { FileText, NotebookTabs } from 'lucide-react'
import {MarkdownRenderer} from '@/components/ui/markdown-renderer'
import { useInsight, useSaveInsightAsNote } from '@/lib/hooks/use-insights'
import { useNotebooks } from '@/lib/hooks/use-notebooks'
import { useModalManager } from '@/lib/hooks/use-modal-manager'
import { useTranslation } from '@/lib/hooks/use-translation'
import { ContentUnavailable } from '@/components/common/ContentUnavailable'
import { isNotFoundError } from '@/lib/utils/error-handler'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { toast } from 'sonner'

interface SourceInsightDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  insight?: {
    id: string
    insight_type?: string
    content?: string
    created?: string | null
    source_id?: string
  }
  onDelete?: (insightId: string) => Promise<void>
}

export function SourceInsightDialog({ open, onOpenChange, insight, onDelete }: SourceInsightDialogProps) {
  const { t } = useTranslation()
  const { openModal } = useModalManager()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showNotebookPicker, setShowNotebookPicker] = useState(false)

  // Ensure insight ID has 'source_insight:' prefix for API calls
  const insightIdWithPrefix = insight?.id
    ? (insight.id.includes(':') ? insight.id : `source_insight:${insight.id}`)
    : ''

  const { data: fetchedInsight, isLoading, isError, error } = useInsight(insightIdWithPrefix, { enabled: open && !!insight?.id })

  // Use fetched data if available, otherwise fall back to passed-in insight.
  // On fetch error there is nothing trustworthy to show (the passed-in data
  // may reference a deleted item), so every derived field goes blank here.
  const displayInsight = isError ? undefined : (fetchedInsight ?? insight)

  // Get source_id from fetched data (preferred) or passed-in insight
  const sourceId = displayInsight?.source_id

  const handleViewSource = () => {
    if (sourceId) {
      openModal('source', sourceId)
    }
  }

  useEffect(() => {
    if (!open) {
      setShowNotebookPicker(false)
    }
  }, [open])

  const handleDelete = async () => {
    if (!insight?.id || !onDelete) return
    setIsDeleting(true)
    try {
      await onDelete(insight.id)
      onOpenChange(false)
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  // Reset delete confirmation when dialog closes
  useEffect(() => {
    if (!open) {
      setShowDeleteConfirm(false)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center justify-between gap-2 pr-8">
            <span>{t('sources.sourceInsight')}</span>
            <div className="flex flex-wrap items-center gap-2">
              {displayInsight?.insight_type && (
                <Badge variant="outline" className="gap-1.5 text-xs uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden="true" />
                  {displayInsight.insight_type}
                </Badge>
              )}
              {sourceId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewSource}
                  className="gap-1"
                >
                  <FileText className="h-3 w-3" />
                  {t('sources.viewSource')}
                </Button>
              )}
              {!isLoading && displayInsight && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNotebookPicker(true)}
                  className="gap-1"
                >
                  <NotebookTabs className="h-3 w-3" />
                  {t('searchPage.saveToNotebook')}
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {showDeleteConfirm ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <p className="text-center text-muted-foreground">
              {t('sources.deleteInsightConfirm').split(/[?？]/)[0]}?<br />
              <span className="text-sm">{t('sources.deleteInsightConfirm').split(/[?？]/)[1]?.trim() || t('common.deleteForever')}</span>
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? t('common.deleting') : t('common.delete')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <span className="text-sm text-muted-foreground">{t('common.loading')}</span>
              </div>
            ) : isError ? (
              <ContentUnavailable
                variant={isNotFoundError(error) ? 'not-found' : 'error'}
                onClose={() => onOpenChange(false)}
              />
            ) : displayInsight ? (
              <MarkdownRenderer>
                {displayInsight.content}
              </MarkdownRenderer>
            ) : (
              <p className="text-sm text-muted-foreground">{t('sources.noInsightSelected')}</p>
            )}
          </div>
        )}
      </DialogContent>

      {showNotebookPicker && displayInsight && (
        <SaveInsightToNotebookDialog
          open={showNotebookPicker}
          onOpenChange={setShowNotebookPicker}
          insightId={insightIdWithPrefix}
        />
      )}
    </Dialog>
  )
}

interface SaveInsightToNotebookDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  insightId: string
}

function SaveInsightToNotebookDialog({
  open,
  onOpenChange,
  insightId,
}: SaveInsightToNotebookDialogProps) {
  const { t } = useTranslation()
  const [selectedNotebook, setSelectedNotebook] = useState<string | null>(null)
  const { data: notebooks, isLoading } = useNotebooks(false)
  const saveInsightAsNote = useSaveInsightAsNote()

  useEffect(() => {
    if (!open) {
      setSelectedNotebook(null)
    }
  }, [open])

  const handleSave = async () => {
    if (!selectedNotebook) {
      toast.error(t('searchPage.selectNotebook'))
      return
    }

    try {
      await saveInsightAsNote.mutateAsync({
        insightId,
        notebookId: selectedNotebook,
      })
      onOpenChange(false)
    } catch {
      // The mutation hook reports the translated error toast.
    }
  }

  const notebookItems = (notebooks ?? []).map((notebook) => ({
    id: notebook.id,
    title: notebook.name,
    description: notebook.description || undefined,
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('searchPage.saveToNotebook')}</DialogTitle>
          <DialogDescription>{t('searchPage.selectNotebook')}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : (
            <CheckboxList
              items={notebookItems}
              selectedIds={selectedNotebook ? [selectedNotebook] : []}
              onToggle={(id) => setSelectedNotebook((current) => (current === id ? null : id))}
              emptyMessage={t('sources.noNotebooksFound')}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!selectedNotebook || saveInsightAsNote.isPending || isLoading}
          >
            {saveInsightAsNote.isPending ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                {t('searchPage.saving')}
              </>
            ) : (
              t('searchPage.saveToNotebook')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
