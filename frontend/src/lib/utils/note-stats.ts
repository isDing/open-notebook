/** Count CJK characters individually and other words/numbers as reading units. */
export function noteStats(plainText: string) {
  const text = plainText
    .replace(/(?:source_insight|insight|note|source):[a-zA-Z0-9_]+/g, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
  const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu
  const characters = text.match(cjk)?.length ?? 0
  const words = text.replace(cjk, ' ').match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:['’][\p{L}\p{N}\p{M}]+)*/gu)?.length ?? 0
  const count = characters + words
  return { words: count, minutes: Math.max(1, Math.ceil(count / 220)) }
}
