import { createEvent, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNoteReferenceLink } from './use-note-reference-link'

const { device, onReferenceClick } = vi.hoisted(() => ({
  device: { desktop: true },
  onReferenceClick: vi.fn(),
}))

vi.mock('@/lib/hooks/use-media-query', () => ({ useIsDesktop: () => device.desktop }))
vi.mock('@/lib/hooks/use-notes', () => ({
  useNote: () => ({ data: { title: '引用的研究笔记' }, isLoading: false, isError: false }),
}))

function Citation() {
  const Link = useNoteReferenceLink(onReferenceClick)
  return <Link href="#ref-note-abc">1</Link>
}

describe('Note citation interaction', () => {
  beforeEach(() => {
    device.desktop = true
    onReferenceClick.mockClear()
    // jsdom does not implement the observer used to position tooltip arrows.
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('shows the note name on desktop hover and still opens the note on click', async () => {
    render(<Citation />)
    const trigger = screen.getByRole('button', { name: '1' })
    const hover = createEvent.pointerMove(trigger)
    Object.defineProperty(hover, 'pointerType', { value: 'mouse' })
    fireEvent(trigger, hover)

    expect(await screen.findByRole('tooltip')).toHaveTextContent('引用的研究笔记')
    expect(onReferenceClick).not.toHaveBeenCalled()
    fireEvent.click(trigger)
    expect(onReferenceClick).toHaveBeenCalledWith('note', 'abc')
  })

  it('shows the name on keyboard focus', async () => {
    render(<Citation />)
    fireEvent.focus(screen.getByRole('button', { name: '1' }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('引用的研究笔记')
    expect(onReferenceClick).not.toHaveBeenCalled()
  })

  it('requires a second tap on the note name on mobile, without submitting the enclosing form', () => {
    device.desktop = false
    const onSubmit = vi.fn((event) => event.preventDefault())
    render(<form onSubmit={onSubmit}><Citation /></form>)

    fireEvent.click(screen.getByRole('button', { name: '1' }))
    expect(onReferenceClick).not.toHaveBeenCalled()
    const popover = screen.getByRole('dialog')
    fireEvent.click(within(popover).getByRole('button', { name: '引用的研究笔记' }))
    expect(onReferenceClick).toHaveBeenCalledExactlyOnceWith('note', 'abc')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('dismisses the mobile name popover without opening the note', () => {
    device.desktop = false
    render(<Citation />)
    const trigger = screen.getByRole('button', { name: '1' })
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onReferenceClick).not.toHaveBeenCalled()
  })
})
