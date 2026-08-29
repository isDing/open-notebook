'use client'

import { AppSidebar } from './AppSidebar'
import { SetupBanner } from './SetupBanner'
import { MobileTopBar } from './MobileTopBar'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <AppSidebar />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden pb-[env(safe-area-inset-bottom)]">
        <MobileTopBar />
        <SetupBanner />
        {children}
      </main>
    </div>
  )
}
