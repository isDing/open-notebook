import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DeferredMount } from './DeferredMount'

describe('DeferredMount', () => {
  it('avoids mounting unused dialogs and preserves drafts after closing', () => {
    const mounted = vi.fn()
    function Editor() {
      const [draft, setDraft] = useState(() => { mounted(); return '' })
      return <input aria-label="draft" value={draft} onChange={event => setDraft(event.target.value)} />
    }
    const { rerender } = render(<DeferredMount active={false}><Editor /></DeferredMount>)
    expect(mounted).not.toHaveBeenCalled()
    rerender(<DeferredMount active><Editor /></DeferredMount>)
    fireEvent.change(screen.getByLabelText('draft'), { target: { value: 'Research notes' } })
    rerender(<DeferredMount active={false}><Editor /></DeferredMount>)
    rerender(<DeferredMount active><Editor /></DeferredMount>)
    expect(screen.getByLabelText('draft')).toHaveValue('Research notes')
    expect(mounted).toHaveBeenCalledTimes(1)
  })
})
