'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import { useDeletePreset } from '@/lib/hooks/use-presets'
import { useTranslation } from '@/lib/hooks/use-translation'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import type { Preset } from '@/lib/types/presets'

interface PresetCardProps {
  preset: Preset
  onEdit: (preset: Preset) => void
  isEditing: boolean
}

export function PresetCard({ preset, onEdit, isEditing }: PresetCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const { t } = useTranslation()
  const deletePreset = useDeletePreset()
  const isDeleting = deletePreset.isPending

  const handleDelete = () => {
    deletePreset.mutate(preset.id)
    setShowDeleteDialog(false)
  }

  return (
    <>
      <div className="rounded-lg border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full text-left"
              aria-expanded={expanded}
            >
              <h3 className="font-medium text-base mb-1 break-words">
                {preset.title}
              </h3>
              {!expanded && (
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {preset.prompt}
                </p>
              )}
            </button>
            {expanded && (
              <div className="mt-2 max-h-48 overflow-auto rounded bg-muted/50 p-2 whitespace-pre-wrap">
                <p className="text-sm text-muted-foreground">{preset.prompt}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(preset)}
              disabled={isEditing}
            >
              <Pencil className="h-4 w-4" />
              {t('common.edit')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting || isEditing}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              {t('common.delete')}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={t('sources.delete')}
        description={t('presets.deleteConfirm')}
        confirmText={t('common.delete')}
        confirmVariant="destructive"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </>
  )
}
