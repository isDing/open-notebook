'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { usePresets } from '@/lib/hooks/use-presets'
import { useTranslation } from '@/lib/hooks/use-translation'
import { PresetCard } from './PresetCard'
import { PresetEditorDialog } from './PresetEditorDialog'
import type { Preset } from '@/lib/types/presets'

export function PresetList() {
  const { t } = useTranslation()
  const { data: presets, isLoading } = usePresets()

  const [showEditor, setShowEditor] = useState(false)
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null)

  const openCreateDialog = () => {
    setEditingPreset(null)
    setShowEditor(true)
  }

  const openEditDialog = (preset: Preset) => {
    setEditingPreset(preset)
    setShowEditor(true)
  }

  const closeEditor = () => {
    setShowEditor(false)
    setEditingPreset(null)
  }

  const list = presets ?? []

  return (
    <>
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-full max-w-sm p-6">
            <div className="flex flex-col items-center gap-4">
              <div className="p-3 bg-muted rounded-full">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">{t('presets.noPresets')}</h3>
              <p className="text-muted-foreground">
                {t('presets.createOne')}
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                {t('presets.createNew')}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{t('presets.listTitle')}</h2>
              <p className="text-muted-foreground">
                {t('presets.hint')}
              </p>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {t('presets.createNew')}
            </Button>
          </div>

          <div className="space-y-4">
            {list.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                onEdit={openEditDialog}
                isEditing={showEditor}
              />
            ))}
          </div>
        </div>
      )}

      <PresetEditorDialog
        isOpen={showEditor}
        preset={editingPreset}
        onClose={closeEditor}
      />
    </>
  )
}
