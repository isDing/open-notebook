import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { presetsApi } from '@/lib/api/presets'
import { useToast } from '@/lib/hooks/use-toast'
import { useTranslation } from '@/lib/hooks/use-translation'
import { getApiErrorMessage } from '@/lib/utils/error-handler'
import {
  CreatePresetRequest,
  UpdatePresetRequest,
} from '@/lib/types/presets'

export const PRESET_QUERY_KEYS = {
  presets: ['presets'] as const,
  preset: (id: string) => ['presets', id] as const,
}

export function usePresets() {
  return useQuery({
    queryKey: PRESET_QUERY_KEYS.presets,
    queryFn: () => presetsApi.list(),
  })
}

export function useCreatePreset() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (data: CreatePresetRequest) => presetsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRESET_QUERY_KEYS.presets })
      toast({
        title: t('common.success'),
        description: t('presets.createSuccess'),
      })
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.error'),
        description: getApiErrorMessage(
          error,
          (key) => t(key),
        ),
        variant: 'destructive',
      })
    },
  })
}

export function useUpdatePreset() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: UpdatePresetRequest
    }) => presetsApi.update(id, data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: PRESET_QUERY_KEYS.presets })
      queryClient.invalidateQueries({
        queryKey: PRESET_QUERY_KEYS.preset(id),
      })
      toast({
        title: t('common.success'),
        description: t('presets.updateSuccess'),
      })
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.error'),
        description: getApiErrorMessage(
          error,
          (key) => t(key),
        ),
        variant: 'destructive',
      })
    },
  })
}

export function useDeletePreset() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (id: string) => presetsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRESET_QUERY_KEYS.presets })
      toast({
        title: t('common.success'),
        description: t('presets.deleteSuccess'),
      })
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.error'),
        description: getApiErrorMessage(
          error,
          (key) => t(key),
        ),
        variant: 'destructive',
      })
    },
  })
}
