import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// The trigger opens the menu on a completed click/tap, not on
// pointerdown (mouse/touch down), so a press+drag never triggers it.

const flushTimers = () => new Promise((resolve) => setTimeout(resolve, 10))

function TestMenu({ onItem }: { onItem?: () => void }) {
  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button">menu-trigger</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={onItem}>menu-item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div>outside-area</div>
    </div>
  )
}

const getTrigger = () => screen.getByRole('button', { name: 'menu-trigger' })

function ControlledMenu({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = React.useState(false)
  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        onOpenChange?.(next)
      }}
    >
      <DropdownMenuTrigger asChild>
        <button type="button">menu-trigger</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>menu-item</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

describe('DropdownMenu trigger', () => {
  it('does not open when merely touched (pointerdown)', () => {
    render(<TestMenu />)
    fireEvent.pointerDown(getTrigger())
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  it('opens on a completed tap (click)', () => {
    render(<TestMenu />)
    fireEvent.click(getTrigger())
    expect(screen.getByRole('menuitem', { name: 'menu-item' })).toBeInTheDocument()
  })

  it('runs the item action and closes when an item is tapped', () => {
    const onItem = vi.fn()
    render(<TestMenu onItem={onItem} />)
    fireEvent.click(getTrigger())
    fireEvent.click(screen.getByRole('menuitem', { name: 'menu-item' }))
    expect(onItem).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  it('closes when tapping outside', async () => {
    render(<TestMenu />)
    fireEvent.click(getTrigger())
    expect(screen.getByRole('menuitem')).toBeInTheDocument()
    await flushTimers()
    fireEvent.pointerDown(screen.getByText('outside-area'))
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  it('closes when the trigger is tapped again instead of reopening', async () => {
    render(<TestMenu />)
    const trigger = getTrigger()
    fireEvent.click(trigger)
    expect(screen.getByRole('menuitem')).toBeInTheDocument()
    await flushTimers()
    fireEvent.pointerDown(trigger)
    fireEvent.click(trigger)
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  it('toggles when the parent controls open via open/onOpenChange', () => {
    const onOpenChange = vi.fn()
    render(<ControlledMenu onOpenChange={onOpenChange} />)
    const trigger = getTrigger()

    fireEvent.click(trigger)
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
    expect(screen.getByRole('menuitem', { name: 'menu-item' })).toBeInTheDocument()

    fireEvent.click(trigger)
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })
})
