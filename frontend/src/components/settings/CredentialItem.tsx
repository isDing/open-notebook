'use client'

import { useState } from 'react'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Key,
  AlertTriangle,
  Edit,
  Trash2,
  Plug,
  Loader2,
  Check,
  X,
  Bot,
  Brain,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTranslation } from '@/lib/hooks/use-translation'
import { useDeleteModel, useTestModel, useUpdateModelThinking } from '@/lib/hooks/use-models'
import { useCredential, useTestCredential } from '@/lib/hooks/use-credentials'
import { Credential } from '@/lib/api/credentials'
import { Model, ModelDefaults, ThinkingLevel } from '@/lib/types/models'

const THINKING_LEVELS: ThinkingLevel[] = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra']

const THINKING_LEVEL_I18N_KEYS: Record<ThinkingLevel, string> = {
  low: 'models.thinkingLow',
  medium: 'models.thinkingMedium',
  high: 'models.thinkingHigh',
  xhigh: 'models.thinkingXhigh',
  max: 'models.thinkingMax',
  ultra: 'models.thinkingUltra',
}
import {
  MODEL_TYPES,
  getTypeIcon,
  getTypeColor,
  getTypeLabel,
  TYPE_COLOR_INACTIVE,
} from '@/lib/providers'
import { ModelTestResultDialog } from './ModelTestResultDialog'
import { CredentialFormDialog } from './CredentialFormDialog'
import { DeleteCredentialDialog } from './DeleteCredentialDialog'
import { DiscoverModelsDialog } from './DiscoverModelsDialog'

interface CredentialItemProps {
  credential: Credential
  models: Model[]
  defaults: ModelDefaults | null
  allCredentials: Credential[]
}

export function CredentialItem({
  credential,
  models,
  defaults,
  allCredentials,
}: CredentialItemProps) {
  const { t } = useTranslation()
  const { testCredential, isPending: isTestPending, testResults } = useTestCredential()
  const { testModel, isPending: isModelTestPending, testingModelId, testResult: modelTestResult, testedModelName, clearResult: clearModelTestResult } = useTestModel()
  const deleteModel = useDeleteModel()
  const updateThinking = useUpdateModelThinking()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [discoverOpen, setDiscoverOpen] = useState(false)
  // Full credential data needed for edit form
  const { data: fullCredential } = useCredential(editOpen ? credential.id : '')

  const linkedModels = models.filter(m => m.credential === credential.id)
  const activeTypes = new Set<string>(linkedModels.map(m => m.type))
  const testResult = testResults[credential.id]

  // Check which models are defaults
  const defaultSlots: Record<string, string> = {}
  if (defaults) {
    const slotMap: Record<string, string | null | undefined> = {
      'Chat': defaults.default_chat_model,
      'Transform': defaults.default_transformation_model,
      'Tools': defaults.default_tools_model,
      'Large Ctx': defaults.large_context_model,
      'Embedding': defaults.default_embedding_model,
      'TTS': defaults.default_text_to_speech_model,
      'STT': defaults.default_speech_to_text_model,
    }
    for (const [slot, modelId] of Object.entries(slotMap)) {
      if (modelId) defaultSlots[modelId] = slot
    }
  }

  return (
    <>
      <div className="border rounded-lg p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="font-medium truncate">{credential.name}</span>
            <div className="flex gap-1">
              {credential.modalities.map(mod => (
                <Badge
                  key={mod}
                  variant="secondary"
                  className={`text-[10px] gap-0.5 px-1 py-0 ${activeTypes.has(mod) ? getTypeColor(mod) : TYPE_COLOR_INACTIVE}`}
                >
                  {getTypeIcon(mod)}
                  <span className="hidden sm:inline">{getTypeLabel(mod)}</span>
                </Badge>
              ))}
            </div>
            {credential.has_api_key && (
              <Badge variant="outline" className="text-[10px]">
                <Key className="h-2.5 w-2.5 mr-0.5" />
                {t('models.apiKey')}
              </Badge>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            {testResult && (
              testResult.success
                ? <Check className="h-4 w-4 text-fern" />
                : <X className="h-4 w-4 text-destructive" />
            )}
            <Button
              variant="ghost" size="sm"
              onClick={() => testCredential(credential.id)}
              disabled={isTestPending || !!credential.decryption_error}
              title={t('apiKeys.testConnection')}
              className="min-h-11 min-w-11 sm:min-h-8 sm:min-w-8"
            >
              {isTestPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              <span className="hidden text-xs sm:inline">{t('apiKeys.testConnection')}</span>
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={() => setDiscoverOpen(true)}
              disabled={!!credential.decryption_error}
              title={t('apiKeys.syncModels')}
              className="min-h-11 min-w-11 sm:min-h-8 sm:min-w-8"
            >
              <Bot className="h-4 w-4" />
              <span className="hidden text-xs sm:inline">{t('apiKeys.syncModels')}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)} disabled={!!credential.decryption_error} title={t('common.edit')} className="min-h-11 min-w-11 sm:min-h-8 sm:min-w-8">
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={() => setDeleteOpen(true)}
              className="min-h-11 min-w-11 text-destructive hover:bg-destructive/10 hover:text-destructive sm:min-h-8 sm:min-w-8"
              title={t('common.delete')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Decryption error warning */}
        {credential.decryption_error && (
          <Alert className="border-warn/30 bg-warn-tint">
            <AlertTriangle className="h-4 w-4 text-warn" />
            <AlertTitle className="text-warn">{t('apiKeys.decryptionError')}</AlertTitle>
            <AlertDescription className="text-warn text-sm">
              {t('apiKeys.decryptionErrorDescription')}
            </AlertDescription>
          </Alert>
        )}

        {/* Linked models grouped by type */}
        {linkedModels.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {MODEL_TYPES
              .filter(type => linkedModels.some(m => m.type === type))
              .map(type => (
                <div key={type} className="flex items-start gap-1.5">
                  <Badge
                    variant="outline"
                    className={`text-[10px] gap-0.5 px-1 py-0 shrink-0 mt-0.5 ${getTypeColor(type)}`}
                  >
                    {getTypeIcon(type)}
                    {getTypeLabel(type)}
                  </Badge>
                  <div className="flex flex-wrap gap-1">
                    {linkedModels.filter(m => m.type === type).map(model => {
                      const defaultSlot = defaultSlots[model.id]
                      const badgeVariant = defaultSlot ? 'default' : 'secondary'
                      return (
                        <Badge
                          key={model.id}
                          variant={badgeVariant}
                          className="relative font-mono text-[11px] gap-1 pr-0.5 group/model"
                        >
                          {model.name}
                          {defaultSlot && <span className="ml-0.5 opacity-75">({defaultSlot})</span>}
                          {model.type === 'language' && model.thinking_level && (
                            <span className="ml-0.5 text-fern">
                              · {t(THINKING_LEVEL_I18N_KEYS[model.thinking_level])}
                            </span>
                          )}
                          {/* Actions overlay the badge's right edge on hover instead
                              of reserving space, keeping idle badges compact
                              (.action-overlay in globals.css; in-flow on touch) */}
                          <div
                            className={`action-overlay z-10 flex items-center gap-0.5 pl-2 pr-1 ${badgeVariant === 'default' ? 'bg-primary-tint' : 'bg-popover'} touch-reveal group-hover/model:opacity-60 hover:!opacity-100 transition-opacity`}
                          >
                            {model.type === 'language' && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    className="min-h-7 min-w-7"
                                    title={
                                      model.thinking_level
                                        ? `${t('models.thinkingTitle')}: ${t(THINKING_LEVEL_I18N_KEYS[model.thinking_level])}`
                                        : t('models.thinkingTitle')
                                    }
                                    aria-label={t('models.thinkingTitle')}
                                  >
                                    <Brain className={`h-3 w-3 ${model.thinking_level ? 'text-fern' : ''}`} />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="min-w-40">
                                  <DropdownMenuRadioGroup
                                    value={model.thinking_level ?? 'default'}
                                    onValueChange={(value) =>
                                      updateThinking.mutate({
                                        modelId: model.id,
                                        thinkingLevel: value === 'default' ? null : (value as ThinkingLevel),
                                      })
                                    }
                                  >
                                    <DropdownMenuRadioItem value="default">
                                      {t('models.thinkingDefault')}
                                    </DropdownMenuRadioItem>
                                    {THINKING_LEVELS.map((level) => (
                                      <DropdownMenuRadioItem key={level} value={level}>
                                        {t(THINKING_LEVEL_I18N_KEYS[level])}
                                      </DropdownMenuRadioItem>
                                    ))}
                                  </DropdownMenuRadioGroup>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            <button
                              className="min-h-7 min-w-7"
                              onClick={() => testModel(model.id, model.name)}
                              disabled={isModelTestPending && testingModelId === model.id}
                              title={t('models.testModel')}
                              aria-label={t('models.testModel')}
                            >
                              {isModelTestPending && testingModelId === model.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Plug className="h-3 w-3" />}
                            </button>
                            <button
                              className="min-h-7 min-w-7 hover:text-destructive"
                              onClick={() => deleteModel.mutate(model.id)}
                              title={t('models.deleteModel')}
                              aria-label={t('models.deleteModel')}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}


      </div>

      {/* Edit dialog */}
      {editOpen && (
        <CredentialFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          provider={credential.provider}
          credential={fullCredential || credential}
        />
      )}

      {/* Delete dialog */}
      {deleteOpen && (
        <DeleteCredentialDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          credential={credential}
          allCredentials={allCredentials}
        />
      )}

      {/* Discover models dialog */}
      {discoverOpen && (
        <DiscoverModelsDialog
          open={discoverOpen}
          onOpenChange={setDiscoverOpen}
          credential={credential}
        />
      )}

      {/* Model test result dialog */}
      <ModelTestResultDialog
        open={modelTestResult !== null}
        onOpenChange={(open) => { if (!open) clearModelTestResult() }}
        result={modelTestResult}
        modelName={testedModelName}
      />
    </>
  )
}
