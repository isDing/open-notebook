import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

import { MarkdownRenderer } from './markdown-renderer'

// MermaidDiagram loads the (DOM-only, heavy) mermaid package lazily; mock it
// so tests neither execute the real renderer nor need its jsdom support.
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async (_id: string, text: string) => ({
      svg: `<svg data-testid="mermaid-svg">${text}</svg>`,
    })),
  },
}))

describe('MarkdownRenderer', () => {
  it('renders basic markdown', () => {
    const { container } = render(<MarkdownRenderer>{'# Title\n\nSome **bold** text'}</MarkdownRenderer>)
    expect(container.querySelector('h1')?.textContent).toBe('Title')
    expect(container.querySelector('strong')?.textContent).toBe('bold')
  })

  it('highlights fenced code blocks for registered languages', () => {
    const { container } = render(
      <MarkdownRenderer>{'```python\ndef hello():\n    return 42\n```'}</MarkdownRenderer>
    )
    // PrismLight emits token spans when the grammar is registered; a plain
    // fallback would leave the code block without any token markup.
    expect(container.querySelectorAll('span[class*="token"]').length).toBeGreaterThan(0)
  })

  it('falls back to plain text for unknown languages without crashing', () => {
    const { container } = render(
      <MarkdownRenderer>{'```notalanguage\nsome content\n```'}</MarkdownRenderer>
    )
    expect(container.textContent).toContain('some content')
  })

  it('renders inline code without a highlighter block', () => {
    const { container } = render(<MarkdownRenderer>{'Use `npm ci` here'}</MarkdownRenderer>)
    expect(container.querySelector('code')?.textContent).toBe('npm ci')
    expect(container.querySelectorAll('span[class*="token"]').length).toBe(0)
  })

  it('renders mermaid fenced code blocks as diagrams', async () => {
    render(<MarkdownRenderer>{'```mermaid\ngraph TD\nA --> B\n```'}</MarkdownRenderer>)
    const svg = await screen.findByTestId('mermaid-svg')
    expect(svg.textContent).toContain('A --> B')
  })

  it('falls back to the raw source when a mermaid diagram fails to parse', async () => {
    const mermaid = (await import('mermaid')).default
    vi.mocked(mermaid.render).mockRejectedValueOnce(new Error('Parse error on line 1'))
    const { container } = render(<MarkdownRenderer>{'```mermaid\ngraph TD\n```'}</MarkdownRenderer>)
    await waitFor(() => expect(container.textContent).toContain('graph TD'))
    expect(screen.queryByTestId('mermaid-svg')).toBeNull()
  })
})
