import { StrictMode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { searchApi } from '@/lib/api/search'
import { AskStreamEvent } from '@/lib/types/search'
import { useAsk } from './use-ask'

vi.mock('@/lib/api/search', () => ({
  searchApi: { askKnowledgeBase: vi.fn() }
}))

vi.mock('@/lib/api/client', () => ({ API_TIMEOUT_MS: 1_000 }))

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const models = { strategy: 'strategy', answer: 'answer', finalAnswer: 'final' }

function createStream() {
  let controller: ReadableStreamDefaultController<Uint8Array>
  const stream = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value
    }
  })

  return {
    stream,
    send(event: AskStreamEvent) {
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`))
    },
    close() {
      controller.close()
    }
  }
}

describe('useAsk request lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('finishes a streamed answer after Strict Mode replays the mount effect', async () => {
    const stream = createStream()
    stream.send({ type: 'final_answer', content: 'The answer' })
    stream.send({ type: 'complete' })
    stream.close()
    vi.mocked(searchApi.askKnowledgeBase).mockResolvedValueOnce(stream.stream)
    const { result } = renderHook(() => useAsk(), { wrapper: StrictMode })

    await act(async () => {
      await result.current.sendAsk('Question', models)
    })

    expect(result.current.finalAnswer).toBe('The answer')
    expect(result.current.isStreaming).toBe(false)
    expect(stream.stream.locked).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['answer', 'end'] as const)(
    'ignores an old stream %s after a replacement request starts',
    async (event) => {
      const previousStream = createStream()
      const currentStream = createStream()
      vi.mocked(searchApi.askKnowledgeBase)
        .mockResolvedValueOnce(previousStream.stream)
        .mockResolvedValueOnce(currentStream.stream)
      const { result } = renderHook(() => useAsk())
      let previousRequest: Promise<void>
      let currentRequest: Promise<void>

      await act(async () => {
        previousRequest = result.current.sendAsk('Old question', models)
      })

      await act(async () => {
        // Resolve the pending read, then replace the request before its
        // continuation runs. Aborting fetch cannot retract this queued result.
        if (event === 'answer') {
          previousStream.send({ type: 'answer', content: 'Stale answer' })
        }
        previousStream.close()
        currentRequest = result.current.sendAsk('New question', models)
        await previousRequest
      })

      expect(result.current.isStreaming).toBe(true)
      expect(result.current.answers).toEqual([])
      expect(previousStream.stream.locked).toBe(false)

      // The old request's cleanup must leave the new watchdog running.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000)
      })

      const currentSignal = vi.mocked(searchApi.askKnowledgeBase).mock.calls[1][1]
      expect(currentSignal?.aborted).toBe(true)
      expect(result.current.isStreaming).toBe(false)
      expect(toast.error).not.toHaveBeenCalled()

      await act(async () => {
        currentStream.close()
        await currentRequest
      })
    }
  )

  it('keeps reset state when a previously queued answer arrives', async () => {
    const stream = createStream()
    vi.mocked(searchApi.askKnowledgeBase).mockResolvedValueOnce(stream.stream)
    const { result } = renderHook(() => useAsk())
    let request: Promise<void>

    await act(async () => {
      request = result.current.sendAsk('Question', models)
    })

    await act(async () => {
      stream.send({ type: 'answer', content: 'Stale answer' })
      stream.send({ type: 'final_answer', content: 'Stale final answer' })
      stream.close()
      result.current.reset()
      await request
    })

    expect(result.current.answers).toEqual([])
    expect(result.current.finalAnswer).toBeNull()
    expect(result.current.isStreaming).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('ignores a superseded request failure without changing the current request', async () => {
    let rejectPrevious: (reason: Error) => void
    const previousResponse = new Promise<ReadableStream<Uint8Array>>((_, reject) => {
      rejectPrevious = reject
    })
    const stream = createStream()
    vi.mocked(searchApi.askKnowledgeBase)
      .mockReturnValueOnce(previousResponse)
      .mockResolvedValueOnce(stream.stream)
    const { result } = renderHook(() => useAsk())
    let previousRequest: Promise<void>
    let currentRequest: Promise<void>

    await act(async () => {
      previousRequest = result.current.sendAsk('Old question', models)
      currentRequest = result.current.sendAsk('New question', models)
      rejectPrevious(new Error('Old network failure'))
      await previousRequest
    })

    expect(result.current.error).toBeNull()
    expect(result.current.isStreaming).toBe(true)
    expect(toast.error).not.toHaveBeenCalled()

    await act(async () => {
      stream.send({ type: 'complete', final_answer: 'Current answer' })
      stream.close()
      await currentRequest
    })

    expect(result.current.finalAnswer).toBe('Current answer')
    expect(result.current.isStreaming).toBe(false)
  })

  it.each(['request', 'stream'] as const)(
    'clears the watchdog and releases the reader on a %s failure',
    async (failure) => {
      const stream = createStream()
      if (failure === 'request') {
        vi.mocked(searchApi.askKnowledgeBase).mockRejectedValueOnce(new Error('Model unavailable'))
      } else {
        stream.send({ type: 'error', message: 'Model unavailable' })
        vi.mocked(searchApi.askKnowledgeBase).mockResolvedValueOnce(stream.stream)
      }
      const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { result } = renderHook(() => useAsk())

      try {
        await act(async () => {
          await result.current.sendAsk('Question', models)
        })

        expect(result.current.error).toBe('Model unavailable')
        expect(result.current.isStreaming).toBe(false)
        expect(toast.error).toHaveBeenCalledTimes(1)
        expect(stream.stream.locked).toBe(false)
        expect(vi.getTimerCount()).toBe(0)
      } finally {
        errorLog.mockRestore()
      }
    }
  )
})
