import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { insightsApi } from '@/lib/api/insights'
import { QUERY_KEYS } from '@/lib/api/query-client'
import { useToast } from '@/lib/hooks/use-toast'
import { useTranslation } from '@/lib/hooks/use-translation'
import { getApiErrorKey } from '@/lib/utils/error-handler'

export function useInsight(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['insights', id],
    queryFn: () => insightsApi.get(id),
    enabled: options?.enabled !== false && !!id,
    staleTime: 30 * 1000, // 30 seconds
  })
}

export function useSaveInsightAsNote() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: ({ insightId, notebookId }: { insightId: string; notebookId: string }) =>
      insightsApi.saveAsNote(insightId, notebookId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notebook(variables.notebookId) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notebooks })
      toast({
        title: t('common.success'),
        description: t('searchPage.saveSuccess'),
      })
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.error'),
        description: getApiErrorKey(error, t('searchPage.saveError')),
        variant: 'destructive',
      })
    },
  })
}
