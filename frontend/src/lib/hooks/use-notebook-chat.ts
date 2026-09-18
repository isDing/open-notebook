'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/utils/error-handler'
import { useTranslation } from '@/lib/hooks/use-translation'
import { chatApi } from '@/lib/api/chat'
import { QUERY_KEYS } from '@/lib/api/query-client'
import {
  NotebookChatMessage,
  CreateNotebookChatSessionRequest,
  UpdateNotebookChatSessionRequest,
  SourceListResponse,
  NoteResponse,
  ChatStreamEvent
} from '@/lib/types/api'
import type { ContextSelections } from '@/lib/types/notebook-context'

interface UseNotebookChatParams {
  notebookId: string
  sources: SourceListResponse[]
  notes: NoteResponse[]
  contextSelections: ContextSelections
}

export function useNotebookChat({ notebookId, sources, notes, contextSelections }: UseNotebookChatParams) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<NotebookChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const [tokenCount, setTokenCount] = useState<number>(0)
  const [charCount, setCharCount] = useState<number>(0)
  // Pending model override for when user changes model before a session exists
  const [pendingModelOverride, setPendingModelOverride] = useState<string | null>(null)

  // The job the UI is currently attached to (guards against double-attach)
  const activeJobRef = useRef<{ jobId: string; sessionId: string } | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Fetch sessions for this notebook
  const {
    data: sessions = [],
    isLoading: loadingSessions,
    refetch: refetchSessions
  } = useQuery({
    queryKey: QUERY_KEYS.notebookChatSessions(notebookId),
    queryFn: () => chatApi.listSessions(notebookId),
    enabled: !!notebookId
  })

  // Fetch current session with messages
  const {
    data: currentSession
  } = useQuery({
    queryKey: QUERY_KEYS.notebookChatSession(currentSessionId!),
    queryFn: () => chatApi.getSession(currentSessionId!),
    enabled: !!notebookId && !!currentSessionId
  })

  // Update messages when current session changes. Skip while a generation
  // for THIS session is streaming (the local state carries the in-progress
  // message); a switch to another session still loads that session's history.
  useEffect(() => {
    if (!currentSession?.messages) return
    const active = activeJobRef.current
    if (active && active.sessionId === currentSessionId) return
    setMessages(currentSession.messages)
  }, [currentSession, currentSessionId])

  // Auto-select most recent session when sessions are loaded
  useEffect(() => {
    if (sessions.length > 0 && !currentSessionId) {
      // Sessions are sorted by created date desc from API
      const mostRecentSession = sessions[0]
      setCurrentSessionId(mostRecentSession.id)
    }
  }, [sessions, currentSessionId])

  // Attach to a generation job: replay buffered tokens, then follow live.
  // The job keeps running server-side regardless of this attachment.
  const attachToJob = useCallback(async (jobId: string, sessionId: string) => {
    // Already attached to this job (e.g. re-attach effect racing sendMessage)
    if (activeJobRef.current?.jobId === jobId) return

    const controller = new AbortController()
    activeJobRef.current = { jobId, sessionId }
    abortControllerRef.current = controller
    setIsSending(true)

    // Accumulated streaming AI message for this attachment
    const aiMessageId = `stream-${jobId}`
    let appended = false

    const handleEvent = (event: ChatStreamEvent) => {
      if (event.type === 'delta') {
        const piece = event.content || ''
        if (!appended) {
          appended = true
          setMessages(prev => [...prev, {
            id: aiMessageId,
            type: 'ai',
            content: piece,
            timestamp: new Date().toISOString()
          }])
        } else {
          setMessages(prev => prev.map(msg =>
            msg.id === aiMessageId ? { ...msg, content: msg.content + piece } : msg
          ))
        }
      } else if (event.type === 'error') {
        throw new Error(event.message || 'Generation failed')
      }
      // 'complete' is terminal; the final message is persisted server-side
      // and picked up by the session refetch below.
    }

    try {
      await chatApi.streamJob(jobId, handleEvent, controller.signal)

      // Replace the streamed placeholder with the persisted message
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.notebookChatSession(sessionId)
      })
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.notebookChatSessions(notebookId)
      })
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled the attachment; the job keeps running server-side
        return
      }
      const error = err as { response?: { data?: { detail?: string } }, message?: string }
      console.error('Error streaming response:', error)
      toast.error(getApiErrorMessage(
        error.response?.data?.detail || error.message,
        (key) => t(key),
        'apiErrors.failedToSendMessage'
      ))
      // Drop the optimistic user message and partial AI placeholder
      setMessages(prev => prev.filter(
        msg => !msg.id.startsWith('temp-') && msg.id !== aiMessageId
      ))
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
      if (activeJobRef.current?.jobId === jobId) {
        activeJobRef.current = null
      }
      setIsSending(false)
    }
  }, [notebookId, queryClient, t])

  // Re-attach after a page refresh: if this session has a live (or recently
  // finished) job, resume its stream or pick up the persisted result.
  useEffect(() => {
    if (!currentSessionId) return
    let cancelled = false

    const tryReattach = async () => {
      const job = await chatApi.getActiveJob(currentSessionId)
      if (cancelled || !job) return
      if (activeJobRef.current?.jobId === job.job_id) return
      if (job.status === 'running') {
        await attachToJob(job.job_id, currentSessionId)
      } else if (job.status === 'completed') {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.notebookChatSession(currentSessionId)
        })
      }
    }

    tryReattach().catch((err) => {
      console.error('Failed to re-attach to active job:', err)
    })

    return () => {
      cancelled = true
    }
  }, [currentSessionId, attachToJob, queryClient])

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: (data: CreateNotebookChatSessionRequest) =>
      chatApi.createSession(data),
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.notebookChatSessions(notebookId)
      })
      setCurrentSessionId(newSession.id)
      toast.success(t('chat.sessionCreated'))
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { detail?: string } }, message?: string };
      toast.error(getApiErrorMessage(error.response?.data?.detail || error.message, (key) => t(key), 'apiErrors.failedToCreateSession'))
    }
  })

  // Update session mutation
  const updateSessionMutation = useMutation({
    mutationFn: ({ sessionId, data }: {
      sessionId: string
      data: UpdateNotebookChatSessionRequest
    }) => chatApi.updateSession(sessionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.notebookChatSessions(notebookId)
      })
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.notebookChatSession(currentSessionId!)
      })
      toast.success(t('chat.sessionUpdated'))
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { detail?: string } }, message?: string };
      toast.error(getApiErrorMessage(error.response?.data?.detail || error.message, (key) => t(key), 'apiErrors.failedToUpdateSession'))
    }
  })

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) =>
      chatApi.deleteSession(sessionId),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.notebookChatSessions(notebookId)
      })
      if (currentSessionId === deletedId) {
        setCurrentSessionId(null)
        setMessages([])
      }
      toast.success(t('chat.sessionDeleted'))
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { detail?: string } }, message?: string };
      toast.error(getApiErrorMessage(error.response?.data?.detail || error.message, (key) => t(key), 'apiErrors.failedToDeleteSession'))
    }
  })

  // Build context from sources and notes based on user selections
  const buildContext = useCallback(async () => {
    // Build context_config mapping IDs to selection modes
    const context_config: { sources: Record<string, string>, notes: Record<string, string> } = {
      sources: {},
      notes: {}
    }

    // Map source selections
    sources.forEach(source => {
      const mode = contextSelections.sources[source.id]
      if (mode === 'insights') {
        context_config.sources[source.id] = 'insights'
      } else if (mode === 'full') {
        context_config.sources[source.id] = 'full content'
      } else {
        context_config.sources[source.id] = 'not in'
      }
    })

    // Map note selections
    notes.forEach(note => {
      const mode = contextSelections.notes[note.id]
      if (mode === 'full') {
        context_config.notes[note.id] = 'full content'
      } else {
        context_config.notes[note.id] = 'not in'
      }
    })

    // Call API to build context with actual content
    const response = await chatApi.buildContext({
      notebook_id: notebookId,
      context_config
    })

    // Store token and char counts
    setTokenCount(response.token_count)
    setCharCount(response.char_count)

    return response.context
  }, [notebookId, sources, notes, contextSelections])

  // Send message: submit the generation job, then attach to its stream
  const sendMessage = useCallback(async (message: string, modelOverride?: string) => {
    let sessionId = currentSessionId

    // Auto-create session if none exists
    if (!sessionId) {
      try {
        const defaultTitle = message.length > 30
          ? `${message.substring(0, 30)}...`
          : message
        const newSession = await chatApi.createSession({
          notebook_id: notebookId,
          title: defaultTitle,
          // Include pending model override when creating session
          model_override: pendingModelOverride ?? undefined
        })
        sessionId = newSession.id
        setCurrentSessionId(sessionId)
        // Clear pending model override now that it's applied to the session
        setPendingModelOverride(null)
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.notebookChatSessions(notebookId)
        })
      } catch (err: unknown) {
        const error = err as { response?: { data?: { detail?: string } }, message?: string };
        toast.error(getApiErrorMessage(error.response?.data?.detail || error.message, (key) => t(key), 'apiErrors.failedToCreateSession'))
        return
      }
    }

    // Add user message optimistically
    const userMessage: NotebookChatMessage = {
      id: `temp-${Date.now()}`,
      type: 'human',
      content: message,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMessage])

    try {
      // Build context and submit the generation job
      const context = await buildContext()
      const job = await chatApi.sendMessage({
        session_id: sessionId,
        message,
        context,
        model_override: modelOverride ?? (currentSession?.model_override ?? undefined)
      })

      await attachToJob(job.job_id, job.session_id)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }, message?: string };
      console.error('Error sending message:', error)
      toast.error(getApiErrorMessage(error.response?.data?.detail || error.message, (key) => t(key), 'apiErrors.failedToSendMessage'))
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp-')))
    }
  }, [
    notebookId,
    currentSessionId,
    currentSession,
    pendingModelOverride,
    buildContext,
    attachToJob,
    queryClient,
    t
  ])

  // Cancel streaming: detaches from the job; generation continues server-side
  // and the final message is persisted (re-attach after refresh to see it).
  const cancelStreaming = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  // Switch session
  const switchSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId)
  }, [])

  // Create session
  const createSession = useCallback((title?: string) => {
    return createSessionMutation.mutate({
      notebook_id: notebookId,
      title
    })
  }, [createSessionMutation, notebookId])

  // Update session
  const updateSession = useCallback((sessionId: string, data: UpdateNotebookChatSessionRequest) => {
    return updateSessionMutation.mutate({
      sessionId,
      data
    })
  }, [updateSessionMutation])

  // Delete session
  const deleteSession = useCallback((sessionId: string) => {
    return deleteSessionMutation.mutate(sessionId)
  }, [deleteSessionMutation])

  // Set model override - handles both existing sessions and pending state
  const setModelOverride = useCallback((model: string | null) => {
    if (currentSessionId) {
      // Session exists - update it directly
      updateSessionMutation.mutate({
        sessionId: currentSessionId,
        data: { model_override: model }
      })
    } else {
      // No session yet - store as pending
      setPendingModelOverride(model)
    }
  }, [currentSessionId, updateSessionMutation])

  // Update token/char counts when context selections change
  useEffect(() => {
    const updateContextCounts = async () => {
      try {
        await buildContext()
      } catch (error) {
        console.error('Error updating context counts:', error)
      }
    }
    updateContextCounts()
  }, [buildContext])

  return {
    // State
    sessions,
    currentSession: currentSession || sessions.find(s => s.id === currentSessionId),
    currentSessionId,
    messages,
    isSending,
    loadingSessions,
    tokenCount,
    charCount,
    pendingModelOverride,

    // Actions
    createSession,
    updateSession,
    deleteSession,
    switchSession,
    sendMessage,
    cancelStreaming,
    setModelOverride,
    refetchSessions
  }
}
