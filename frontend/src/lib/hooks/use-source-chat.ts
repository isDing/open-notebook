'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/utils/error-handler'
import { useTranslation } from '@/lib/hooks/use-translation'
import { chatApi } from '@/lib/api/chat'
import { sourceChatApi } from '@/lib/api/source-chat'
import {
  SourceChatSession,
  SourceChatMessage,
  SourceChatContextIndicator,
  CreateSourceChatSessionRequest,
  UpdateSourceChatSessionRequest,
  ChatStreamEvent
} from '@/lib/types/api'

export function useSourceChat(sourceId: string) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<SourceChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [contextIndicators, setContextIndicators] = useState<SourceChatContextIndicator | null>(null)

  // The job the UI is currently attached to (guards against double-attach)
  const activeJobRef = useRef<{ jobId: string; sessionId: string } | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Fetch sessions
  const { data: sessions = [], isLoading: loadingSessions, refetch: refetchSessions } = useQuery<SourceChatSession[]>({
    queryKey: ['sourceChatSessions', sourceId],
    queryFn: () => sourceChatApi.listSessions(sourceId),
    enabled: !!sourceId
  })

  // Fetch current session with messages
  const { data: currentSession } = useQuery({
    queryKey: ['sourceChatSession', sourceId, currentSessionId],
    queryFn: () => sourceChatApi.getSession(sourceId, currentSessionId!),
    enabled: !!sourceId && !!currentSessionId
  })

  // Update messages when session changes. Skip while a generation for THIS
  // session is streaming (the local state carries the in-progress message).
  useEffect(() => {
    if (!currentSession?.messages) return
    const active = activeJobRef.current
    if (active && active.sessionId === currentSessionId) return
    setMessages(currentSession.messages)
    if (currentSession.context_indicators) {
      setContextIndicators(currentSession.context_indicators)
    }
  }, [currentSession, currentSessionId])

  // Auto-select most recent session when sessions are loaded
  useEffect(() => {
    if (sessions.length > 0 && !currentSessionId) {
      // Find most recent session (sessions are sorted by created date desc from API)
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
    setIsStreaming(true)

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
      } else if (event.type === 'context_indicators') {
        setContextIndicators(event.data as SourceChatContextIndicator)
      } else if (event.type === 'error') {
        throw new Error(event.message || 'Stream error')
      }
      // 'complete' is terminal; the final message is persisted server-side
      // and picked up by the session refetch below. Its payload may also
      // carry context_indicators (source chat).
      if (event.type === 'complete' && event.context_indicators) {
        setContextIndicators(event.context_indicators)
      }
    }

    try {
      await chatApi.streamJob(jobId, handleEvent, controller.signal)

      // Replace the streamed placeholder with the persisted message
      queryClient.invalidateQueries({ queryKey: ['sourceChatSession', sourceId, sessionId] })
      queryClient.invalidateQueries({ queryKey: ['sourceChatSessions', sourceId] })
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled the attachment; the job keeps running server-side
        return
      }
      const error = err as { response?: { data?: { detail?: string } }, message?: string };
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
      setIsStreaming(false)
    }
  }, [sourceId, queryClient, t])

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
        queryClient.invalidateQueries({ queryKey: ['sourceChatSession', sourceId, currentSessionId] })
      }
    }

    tryReattach().catch((err) => {
      console.error('Failed to re-attach to active job:', err)
    })

    return () => {
      cancelled = true
    }
  }, [currentSessionId, attachToJob, queryClient, sourceId])

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: (data: Omit<CreateSourceChatSessionRequest, 'source_id'>) => 
      sourceChatApi.createSession(sourceId, data),
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ['sourceChatSessions', sourceId] })
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
    mutationFn: ({ sessionId, data }: { sessionId: string, data: UpdateSourceChatSessionRequest }) =>
      sourceChatApi.updateSession(sourceId, sessionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sourceChatSessions', sourceId] })
      queryClient.invalidateQueries({ queryKey: ['sourceChatSession', sourceId, currentSessionId] })
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
      sourceChatApi.deleteSession(sourceId, sessionId),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['sourceChatSessions', sourceId] })
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

  // Send message: submit the generation job, then attach to its stream
  const sendMessage = useCallback(async (message: string, modelOverride?: string) => {
    let sessionId = currentSessionId

    // Auto-create session if none exists
    if (!sessionId) {
      try {
        const defaultTitle = message.length > 30 ? `${message.substring(0, 30)}...` : message
        const newSession = await sourceChatApi.createSession(sourceId, { title: defaultTitle })
        sessionId = newSession.id
        setCurrentSessionId(sessionId)
        queryClient.invalidateQueries({ queryKey: ['sourceChatSessions', sourceId] })
      } catch (err: unknown) {
        const error = err as { response?: { data?: { detail?: string } }, message?: string };
        console.error('Failed to create chat session:', error)
        toast.error(getApiErrorMessage(error.response?.data?.detail || error.message, (key) => t(key), 'apiErrors.failedToCreateSession'))
        return
      }
    }

    // Add user message optimistically
    const userMessage: SourceChatMessage = {
      id: `temp-${Date.now()}`,
      type: 'human',
      content: message,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMessage])
    setContextIndicators(null)

    try {
      const job = await sourceChatApi.sendMessage(sourceId, sessionId, {
        message,
        model_override: modelOverride
      })

      await attachToJob(job.job_id, job.session_id)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }, message?: string };
      console.error('Error sending message:', error)
      toast.error(getApiErrorMessage(error.response?.data?.detail || error.message, (key) => t(key), 'apiErrors.failedToSendMessage'))
      // Remove optimistic messages on error
      setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp-')))
    }
  }, [sourceId, currentSessionId, attachToJob, queryClient, t])

  // Cancel streaming: detaches from the job; generation continues server-side
  // and the final message is persisted (re-attach after refresh to see it).
  const cancelStreaming = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  // Switch session
  const switchSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId)
    setContextIndicators(null)
  }, [])

  // Create session
  const createSession = useCallback((data: Omit<CreateSourceChatSessionRequest, 'source_id'>) => {
    return createSessionMutation.mutate(data)
  }, [createSessionMutation])

  // Update session
  const updateSession = useCallback((sessionId: string, data: UpdateSourceChatSessionRequest) => {
    return updateSessionMutation.mutate({ sessionId, data })
  }, [updateSessionMutation])

  // Delete session
  const deleteSession = useCallback((sessionId: string) => {
    return deleteSessionMutation.mutate(sessionId)
  }, [deleteSessionMutation])

  return {
    // State
    sessions,
    currentSession: sessions.find(s => s.id === currentSessionId),
    currentSessionId,
    messages,
    isStreaming,
    contextIndicators,
    loadingSessions,
    
    // Actions
    createSession,
    updateSession,
    deleteSession,
    switchSession,
    sendMessage,
    cancelStreaming,
    refetchSessions
  }
}
