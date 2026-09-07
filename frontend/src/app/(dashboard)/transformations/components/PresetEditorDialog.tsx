'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useCreatePreset, useUpdatePreset } from '@/lib/hooks/use-presets'
import { useTranslation } from '@/lib/hooks/use-translation'
import type { Preset } from '@/lib/types/presets'

const presetSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),
  prompt: z.string().min(1, 'Prompt is required'),
})

type PresetFormValues = z.infer<typeof presetSchema>

interface PresetEditorDialogProps {
  isOpen: boolean
  preset: Preset | null
  onClose: () => void
}

export function PresetEditorDialog({ isOpen, preset, onClose }: PresetEditorDialogProps) {
  const { t } = useTranslation()
  const createPreset = useCreatePreset()
  const updatePreset = useUpdatePreset()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    control,
  } = useForm<PresetFormValues>({
    resolver: zodResolver(presetSchema),
    defaultValues: {
      title: '',
      prompt: '',
    },
  })

  useEffect(() => {
    if (isOpen) {
      reset({
        title: preset?.title ?? '',
        prompt: preset?.prompt ?? '',
      })
    }
  }, [isOpen, preset, reset])

  const onSubmit = (data: PresetFormValues) => {
    const request = {
      title: data.title.trim(),
      prompt: data.prompt.trim(),
    }
    if (preset) {
      updatePreset.mutate(
        { id: preset.id, data: request },
        {
          onSuccess: () => {
            onClose()
          },
        },
      )
    } else {
      createPreset.mutate(request, {
        onSuccess: () => {
          onClose()
        },
      })
    }
  }

  const isSubmittingForm = isSubmitting || createPreset.isPending || updatePreset.isPending

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {preset ? t('presets.editTitle') : t('presets.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('presets.hint')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="preset-title" className="text-sm font-medium">
              {t('presets.titleLabel')}
            </label>
            <Input
              id="preset-title"
              placeholder={t('presets.titlePlaceholder')}
              {...register('title')}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? 'preset-title-error' : undefined}
            />
            {errors.title && (
              <p id="preset-title-error" className="text-sm text-destructive">
                {errors.title.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="preset-prompt" className="text-sm font-medium">
              {t('presets.promptLabel')}
            </label>
            <Controller
              control={control}
              name="prompt"
              render={({ field }) => (
                <Textarea
                  id="preset-prompt"
                  placeholder={t('presets.promptPlaceholder')}
                  rows={4}
                  {...field}
                  aria-invalid={errors.prompt ? true : undefined}
                  aria-describedby={errors.prompt ? 'preset-prompt-error' : undefined}
                />
              )}
            />
            {errors.prompt && (
              <p id="preset-prompt-error" className="text-sm text-destructive">
                {errors.prompt.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmittingForm}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmittingForm}>
              {preset ? t('common.save') : t('presets.createNew')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
