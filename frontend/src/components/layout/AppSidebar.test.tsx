/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AppSidebar } from './AppSidebar'
import { useSidebarStore } from '@/lib/stores/sidebar-store'

// Mock Tooltip components to avoid Radix UI async issues in tests
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const DESKTOP_QUERY = '(min-width: 1024px)'

// The global setup mock always reports "no match"; steer the desktop query
// per test to cover both the desktop sidebar and the mobile drawer.
function mockViewport(isDesktop: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: isDesktop && query === DESKTOP_QUERY,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function storeMock(overrides: Record<string, unknown> = {}) {
  vi.mocked(useSidebarStore).mockReturnValue({
    isCollapsed: false,
    mobileOpen: false,
    toggleCollapse: vi.fn(),
    setMobileOpen: vi.fn(),
    ...overrides,
  } as any)
}

describe('AppSidebar', () => {
  it('renders correctly when expanded', () => {
    mockViewport(true)
    storeMock()
    render(<AppSidebar />)

    // With mocked t() returning keys, check for translation key strings
    expect(screen.getByText('common.appName')).toBeDefined()
    expect(screen.getByText('navigation.sources')).toBeDefined()
    expect(screen.getByText('navigation.notebooks')).toBeDefined()
  })

  it('toggles collapse state when clicking handle', () => {
    mockViewport(true)
    const toggleCollapse = vi.fn()
    storeMock({ isCollapsed: false, toggleCollapse })

    render(<AppSidebar />)

    fireEvent.click(screen.getByTestId('sidebar-toggle'))

    expect(toggleCollapse).toHaveBeenCalled()
  })

  it('shows collapsed view when isCollapsed is true', () => {
    mockViewport(true)
    storeMock({ isCollapsed: true, toggleCollapse: vi.fn() })

    render(<AppSidebar />)

    // In collapsed mode, app name shouldn't be visible (as text)
    expect(screen.queryByText('common.appName')).toBeNull()
  })

  describe('mobile drawer', () => {
    it('renders the close button when the drawer is open', () => {
      mockViewport(false)
      storeMock({ mobileOpen: true })

      render(<AppSidebar />)

      expect(screen.getByLabelText('common.close')).toBeDefined()
    })

    it('closes the drawer when the close button is clicked', () => {
      mockViewport(false)
      const setMobileOpen = vi.fn()
      storeMock({ mobileOpen: true, setMobileOpen })

      render(<AppSidebar />)

      fireEvent.click(screen.getByLabelText('common.close'))

      expect(setMobileOpen).toHaveBeenCalledWith(false)
    })

    it('closes the drawer when the backdrop is clicked', () => {
      mockViewport(false)
      const setMobileOpen = vi.fn()
      storeMock({ mobileOpen: true, setMobileOpen })

      render(<AppSidebar />)

      fireEvent.click(screen.getByTestId('sidebar-backdrop'))

      expect(setMobileOpen).toHaveBeenCalledWith(false)
    })

    it('closes the drawer on Escape', () => {
      mockViewport(false)
      const setMobileOpen = vi.fn()
      storeMock({ mobileOpen: true, setMobileOpen })

      render(<AppSidebar />)

      fireEvent.keyDown(window, { key: 'Escape' })

      expect(setMobileOpen).toHaveBeenCalledWith(false)
    })
  })
})
