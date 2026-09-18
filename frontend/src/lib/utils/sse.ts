// Shared SSE reader for streaming chat jobs.
//
// Protocol (one JSON object per `data:` line):
// - { type: "delta", content }                raw model token text
// - { type: "context_indicators", data }      source chat only
// - { type: "complete", message_id, content } terminal
// - { type: "error", message }                terminal
//
// Keepalives arrive as `: keepalive` comment lines and are ignored.

import type { ChatStreamEvent } from '@/lib/types/api'

export async function readSseStream(
  response: Response,
  onEvent: (event: ChatStreamEvent) => void
): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body received from server')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')

    // Keep the last incomplete line in the buffer
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const jsonStr = line.slice(6).trim()
      if (!jsonStr) continue
      try {
        onEvent(JSON.parse(jsonStr) as ChatStreamEvent)
      } catch (e) {
        if (e instanceof SyntaxError) {
          // Incomplete/malformed JSON — skip, don't abort the stream
          console.error('Error parsing SSE data:', e, 'Line:', line)
        } else {
          throw e
        }
      }
    }
  }
}
