'use client'

import { AppSidebar } from './AppSidebar'
import { SetupBanner } from './SetupBanner'
import { MobileTopBar } from './MobileTopBar'

interface AppShellProps {
  children: React.ReactNode
  /** Hide the mobile top app bar (menu/create). Mobile-only effect —
   *  the bar is not rendered at the `lg` breakpoint anyway. */
  hideMobileTopBar?: boolean
}

export function AppShell({ children, hideMobileTopBar = false }: AppShellProps) {
  return (
    <div className="app-shell flex h-dvh min-w-0 overflow-hidden">
      <AppSidebar />
      <main className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
        {!hideMobileTopBar && <MobileTopBar />}
        <SetupBanner />
        {children}
      </main>
    </div>
  )
}
