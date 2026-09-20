import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NavigationLink } from './NavigationLink'

const prefetch = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ prefetch }) }))

describe('NavigationLink', () => {
  it('prefetches on mouse or keyboard intent and retains caller handlers', () => {
    const onFocus = vi.fn()
    const onMouseEnter = vi.fn()
    render(<NavigationLink href="/sources" onFocus={onFocus} onMouseEnter={onMouseEnter}>Sources</NavigationLink>)
    const link = screen.getByRole('link', { name: 'Sources' })
    expect(prefetch).not.toHaveBeenCalled()
    fireEvent.mouseEnter(link)
    expect(prefetch).toHaveBeenCalledWith('/sources')
    expect(onMouseEnter).toHaveBeenCalledOnce()
    fireEvent.focus(link)
    expect(prefetch).toHaveBeenCalledTimes(2)
    expect(onFocus).toHaveBeenCalledOnce()
    expect(link).toHaveAttribute('href', '/sources')
  })
})
