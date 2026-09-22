'use client'

import { useEffect, useRef, useState } from 'react'

import { useThemeStore } from '@/lib/stores/theme-store'

/**
 * Flatten ReactMarkdown/remark code `children` into the raw source text.
 * Children may be a plain string (react-markdown) or arrays of text nodes
 * wrapped in element nodes - the @uiw preview pipeline wraps each line in
 * <span> elements even for unregistered languages - so walk recursively.
 */
export function extractCodeString(children: React.ReactNode): string {
  if (children == null || typeof children === 'boolean') return ''
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(extractCodeString).join('')
  const element = children as { props?: { children?: React.ReactNode } }
  return extractCodeString(element.props?.children)
}

type RenderResult = {
  svg: string
  bindFunctions?: (container: HTMLElement) => void
}

/**
 * Render a mermaid diagram from its source text.
 *
 * The `mermaid` package is large and DOM-only, so it is loaded with a
 * dynamic import inside an effect: it is code-split out of the main bundle
 * and never executes on the server. The rendered SVG is held in state (not
 * injected via innerHTML) so the element stays mounted while content is
 * still changing, e.g. during streaming. If the source fails to parse, the
 * raw source is shown as a code block instead of an empty box.
 */
export function MermaidDiagram({ code, className }: { code: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  // mermaid.render uses this id for its temporary DOM node; a stable,
  // unique id per instance avoids collisions between diagrams on a page.
  const diagramIdRef = useRef(`mermaid-${Math.random().toString(36).slice(2)}`)
  const [result, setResult] = useState<RenderResult | null>(null)
  const [failed, setFailed] = useState(false)
  const theme = useThemeStore((state) => state.theme)
  const [systemDark, setSystemDark] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const isDark = theme === 'system' ? systemDark : theme === 'dark'

  useEffect(() => {
    let cancelled = false
    setResult(null)
    setFailed(false)
    if (!code.trim()) return
    import('mermaid')
      .then(({ default: mermaid }) => {
        if (cancelled) return undefined
        mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default' })
        return mermaid.render(diagramIdRef.current, code)
      })
      .then((rendered) => {
        if (cancelled || !rendered) return
        setResult({ svg: rendered.svg, bindFunctions: rendered.bindFunctions })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.warn('Mermaid diagram failed to render', error)
        setFailed(true)
      })
    return () => { cancelled = true }
  }, [code, isDark])

  useEffect(() => {
    if (result?.bindFunctions && containerRef.current) {
      result.bindFunctions(containerRef.current)
    }
  }, [result])

  if (failed) {
    return <code className="block my-4 overflow-x-auto whitespace-pre-wrap text-sm">{code}</code>
  }

  return (
    <div
      ref={containerRef}
      data-mermaid="diagram"
      className={`my-4 overflow-x-auto ${className ?? ''}`.trim()}
      dangerouslySetInnerHTML={result ? { __html: result.svg } : undefined}
    />
  )
}
