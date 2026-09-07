export interface Preset {
  id: string
  title: string
  prompt: string
  created: string
  updated: string
}

export interface CreatePresetRequest {
  title: string
  prompt: string
}

export interface UpdatePresetRequest {
  title?: string
  prompt?: string
}
