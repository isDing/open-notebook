import { describe, it, expect } from 'vitest'
import { splitThinking } from './thinking'

describe('splitThinking', () => {
  it('returns empty parts for empty input', () => {
    expect(splitThinking('')).toEqual({thinking: '', content: '' })
    expect(splitThinking(null as unknown as string)).toEqual({
     thinking: '',
      content: '',
    })
  })

  it('returns content unchanged when no thinking tags present', () => {
    expect(splitThinking('Just an answer')).toEqual({
     thinking: '',
      content: 'Just an answer',
    })
  })

  it('extracts a single well-formed thinking block', () => {
    expect(splitThinking('<thinkLet me analyze this</think>Here is the answer'))
      .toEqual({thinking: 'Let me analyze this', content: 'Here is the answer' })
  })

  it('extracts multiple thinking blocks joined with blank lines', () => {
    const result = splitThinking('<thinkStep 1</think>Middle<thinkStep 2</think>Done')
    expect(result.thinking).toBe('Step 1\n\nStep 2')
    expect(result.content).toBe('MiddleDone')
  })

  it('handles thinking with no answer content', () => {
    expect(splitThinking('<thinkOnly reasoning</think>')).toEqual({
     thinking: 'Only reasoning',
      content: '',
    })
  })

  it('handles malformed output (closing tag without opening)', () => {
    expect(splitThinking('Some reasoning without an open tag</think>The answer'))
      .toEqual({thinking: 'Some reasoning without an open tag', content: 'The answer' })
  })

  it('treats an unclosed opening tag as live thinking (streaming)', () => {
    expect(splitThinking('<thinkStill reasoning...')).toEqual({
     thinking: 'Still reasoning...',
      content: '',
    })
    expect(splitThinking('Lead-in<thinkStill reasoning...')).toEqual({
     thinking: 'Still reasoning...',
      content: 'Lead-in',
    })
  })

  it('collapses extra whitespace left after block removal', () => {
    const result = splitThinking('<thinkreason</think>\n\n\n\nAnswer')
    expect(result.content).toBe('Answer')
  })
})
