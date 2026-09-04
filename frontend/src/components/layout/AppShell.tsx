'use client'

import { AppSidebar } from './AppSidebar'
import { SetupBanner } from './SetupBanner'
import { MobileTopBar } from './MobileTopBar'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell flex h-dvh min-w-0 overflow-hidden">
      <AppSidebar />
      <main className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
        <MobileTopBar />
        <SetupBanner />
        {children}
      </main>
    </div>
  )
}
