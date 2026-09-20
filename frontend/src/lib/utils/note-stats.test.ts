import { describe, expect, it } from 'vitest'
import { noteStats } from './note-stats'

describe('noteStats', () => {
  it.each([
    ['中文没有空格', 6],
    ['你好，世界！', 4],
    ['你好 Open Notebook 2026！', 5],
    ['hello,world! don’t stop', 4],
    ['𠮷野家', 3],
    ['café cafe\u0301', 2],
    ['结论 [note:abc] [source:xyz] [insight:def] [source_insight:ghi]', 2],
    ['1. First\n2. Second', 2],
    ['   \n\t', 0],
    ['，。！？ — | 😀', 0],
  ])('counts %j as %i reading units', (content, count) => {
    expect(noteStats(content).words).toBe(count)
  })

  it('uses the corrected count for reading time', () => {
    expect(noteStats('中'.repeat(441))).toEqual({ words: 441, minutes: 3 })
    expect(noteStats('')).toEqual({ words: 0, minutes: 1 })
  })
})
