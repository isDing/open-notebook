// Splits an AI message into its thinking block(s) and the visible answer.
//
// Mirrors the backend's parse_thinking_content (open_notebook/utils/text_utils.py)
// with one addition for live streaming: an opened-but-not-closed thinking tag
// means everything after the opening tag is still-arriving thinking.
//
// The persisted message keeps thinking content verbatim; this helper is the
// single place the UI decides how to render it (collapsed section).

export interface ThinkingSplit {
  thinking: string
  content: string
}

// Tag characters are escaped (\u003C = "<") because some tooling mangles
// literal thinking-tag sequences in source files.
const THINK_OPEN = '\u003Cthink'
const THINK_BLOCK = /\u003Cthink([\s\S]*?)\u003C\/think>/g
// Malformed output: closing tag present but no opening tag (e.g. Nemotron)
const NO_OPEN_TAG = /^([\s\S]*?)\u003C\/think>/

export function splitThinking(raw: string): ThinkingSplit {
  const content = raw ?? ''
  if (!content) {
    return { thinking: '', content: '' }
  }

  // Well-formed thinking block(s)
  const matches = Array.from(content.matchAll(THINK_BLOCK))
  if (matches.length > 0) {
    const thinking = matches
      .map((match) => match[1].trim())
      .filter(Boolean)
      .join('\n\n')
    const cleaned = content
      .replace(THINK_BLOCK, '')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim()
    return { thinking, content: cleaned }
  }

  // Malformed: text followed by a closing tag only
  const malformed = NO_OPEN_TAG.exec(content)
  if (malformed) {
    return {
      thinking: malformed[1].trim(),
      content: content.slice(malformed[0].length).trim(),
    }
  }

  // Live streaming: opening tag seen, closing tag not yet arrived
  const openIndex = content.indexOf(THINK_OPEN)
  if (openIndex !== -1) {
    return {
      thinking: content.slice(openIndex + THINK_OPEN.length).trim(),
      content: content.slice(0, openIndex).trim(),
    }
  }

  return { thinking: '', content }
}
