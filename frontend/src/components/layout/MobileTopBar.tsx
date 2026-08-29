'use client'

import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CreateMenu } from '@/components/common/CreateMenu'
import { LogoPebbles } from './AppSidebar'
import { useSidebarStore } from '@/lib/stores/sidebar-store'
import { useTranslation } from '@/lib/hooks/use-translation'

/** Top app bar shown only below the `lg` breakpoint, where the sidebar
 *  becomes a drawer. Gives mobile access to navigation and the create
 *  actions without a permanent sidebar eating the viewport. */
export function MobileTopBar() {
  const { t } = useTranslation()
  const { mobileOpen, setMobileOpen } = useSidebarStore()

  return (
    <header className="flex h-[calc(3rem+env(safe-area-inset-top))] min-h-12 flex-shrink-0 items-center justify-between gap-2 border-b border-sidebar-border bg-sidebar pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top)] lg:hidden">
      <div className="flex min-w-0 items-center gap-2.5">
        <Button
          id="mobile-menu-trigger"
          variant="ghost"
          size="sm"
          className="h-11 w-11 shrink-0 touch-manipulation p-0 text-sidebar-foreground hover:bg-sidebar-accent"
          aria-label={t('navigation.openMenu')}
          aria-controls="mobile-sidebar"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <LogoPebbles />
        <span className="truncate font-display text-[15px] font-bold tracking-tight text-sidebar-foreground">
          {t('common.appName')}
        </span>
      </div>
      <CreateMenu iconOnly />
    </header>
  )
}
