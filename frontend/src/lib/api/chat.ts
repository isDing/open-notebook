import apiClient from './client'
import { getAuthToken } from '@/lib/auth-token'
import { readSseStream } from '@/lib/utils/sse'
import {
  NotebookChatSession,
  NotebookChatSessionWithMessages,
  CreateNotebookChatSessionRequest,
  UpdateNotebookChatSessionRequest,
  SendNotebookChatMessageRequest,
  BuildContextRequest,
  BuildContextResponse,
  JobSubmitResponse,
  ChatJobResponse,
  ChatStreamEvent,
} from '@/lib/types/api'

export const chatApi = {
  // Session management
  listSessions: async (notebookId: string) => {
    const response = await apiClient.get<NotebookChatSession[]>(
      `/chat/sessions`,
      { params: { notebook_id: notebookId } }
    )
    return response.data
  },

  createSession: async (data: CreateNotebookChatSessionRequest) => {
    const response = await apiClient.post<NotebookChatSession>(
      `/chat/sessions`,
      data
    )
    return response.data
  },

  getSession: async (sessionId: string) => {
    const response = await apiClient.get<NotebookChatSessionWithMessages>(
      `/chat/sessions/${sessionId}`
    )
    return response.data
  },

  updateSession: async (sessionId: string, data: UpdateNotebookChatSessionRequest) => {
    const response = await apiClient.put<NotebookChatSession>(
      `/chat/sessions/${sessionId}`,
      data
    )
    return response.data
  },

  deleteSession: async (sessionId: string) => {
    await apiClient.delete(`/chat/sessions/${sessionId}`)
  },

  // Messaging — submits a background generation job; tokens stream over
  // streamJob() and the final message is persisted server-side.
  sendMessage: async (data: SendNotebookChatMessageRequest) => {
    const response = await apiClient.post<JobSubmitResponse>(
      `/chat/execute`,
      data
    )
    return response.data
  },

  // Most recent generation job for a session (null when there is none),
  // used to re-attach after a page refresh.
  getActiveJob: async (sessionId: string): Promise<ChatJobResponse | null> => {
    try {
      const response = await apiClient.get<ChatJobResponse>(
        `/chat/sessions/${sessionId}/job`
      )
      return response.data
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 404) return null
      throw error
    }
  },

  // Attach to a job's SSE stream: replays buffered events, then follows live.
  // Resolves when a terminal (complete/error) event has been delivered.
  streamJob: async (
    jobId: string,
    onEvent: (event: ChatStreamEvent) => void,
    signal?: AbortSignal
  ): Promise<void> => {
    // Use a relative URL to leverage Next.js rewrites (dev proxy and
    // production Docker network alike).
    const url = `/api/chat/jobs/${jobId}/stream`
    const token = getAuthToken()

    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal,
    })
    if (!response.ok || !response.body) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    await readSseStream(response, onEvent)
  },

  buildContext: async (data: BuildContextRequest) => {
    const response = await apiClient.post<BuildContextResponse>(
      `/chat/context`,
      data
    )
    return response.data
  },
}

export default chatApi
