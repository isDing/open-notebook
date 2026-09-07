import { apiClient } from './client'
import type {
  CreatePresetRequest,
  Preset,
  UpdatePresetRequest,
} from '@/lib/types/presets'

export const presetsApi = {
  list: async (): Promise<Preset[]> => {
    const response = await apiClient.get<Preset[]>('/presets')
    return response.data
  },

  get: async (id: string): Promise<Preset> => {
    const response = await apiClient.get<Preset>(`/presets/${id}`)
    return response.data
  },

  create: async (data: CreatePresetRequest): Promise<Preset> => {
    const response = await apiClient.post<Preset>('/presets', data)
    return response.data
  },

  update: async (id: string, data: UpdatePresetRequest): Promise<Preset> => {
    const response = await apiClient.put<Preset>(`/presets/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/presets/${id}`)
  },
}
