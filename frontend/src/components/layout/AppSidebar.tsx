'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/hooks/use-auth'
import { useSidebarStore } from '@/lib/stores/sidebar-store'
import { useIsDesktop } from '@/lib/hooks/use-media-query'
import { useCreateDialogs } from '@/lib/hooks/use-create-dialogs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import type { TFunction } from 'i18next'
import { useTranslation } from '@/lib/hooks/use-translation'
import { Separator } from '@/components/ui/separator'
import {
  Book,
  Search,
  Mic,
  Bot,
  Shuffle,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  FileText,
  Plus,
  Wrench,
  Command,
  StickyNote,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type NavigationItem = {
  name: string
  href: string
  icon: LucideIcon
  iconClass?: string
}

const getNavigation = (t: TFunction): Array<{ title: string; items: NavigationItem[] }> => [
  {
    title: t('navigation.collect'),
    items: [
      { name: t('navigation.sources'), href: '/sources', icon: FileText, iconClass: 'text-sage' },
    ],
  },
  {
    title: t('navigation.process'),
    items: [
      { name: t('navigation.notebooks'), href: '/notebooks', icon: Book, iconClass: 'text-teal' },
      { name: t('notes.reading'), href: '/notes', icon: StickyNote, iconClass: 'text-gold' },
      { name: t('navigation.askAndSearch'), href: '/search', icon: Search, iconClass: undefined },
    ],
  },
  {
    title: t('navigation.create'),
    items: [
      { name: t('navigation.podcasts'), href: '/podcasts', icon: Mic, iconClass: 'text-mauve' },
    ],
  },
  {
    title: t('navigation.manage'),
    items: [
      { name: t('navigation.models'), href: '/settings/api-keys', icon: Bot, iconClass: undefined },
      { name: t('navigation.transformations'), href: '/transformations', icon: Shuffle, iconClass: undefined },
      { name: t('navigation.settings'), href: '/settings', icon: Settings, iconClass: undefined },
      { name: t('navigation.advanced'), href: '/advanced', icon: Wrench, iconClass: undefined },
    ],
  },
]

// The tri-hue mark recomposed in the owned palette: fern / gold / teal.
export function LogoPebbles({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-[3px]', className)} aria-hidden="true">
      <span className="size-[9px] rounded-[3px] bg-fern" />
      <span className="size-[9px] rounded-[3px] bg-gold" />
      <span className="size-[9px] rounded-[3px] bg-teal" />
    </span>
  )
}

type CreateTarget = 'source' | 'notebook' | 'podcast'

export function AppSidebar() {
  const { t } = useTranslation()
  const navigation = getNavigation(t)
  const pathname = usePathname()
  const { logout } = useAuth()
  const { isCollapsed, toggleCollapse, mobileOpen, setMobileOpen } = useSidebarStore()
  const { openSourceDialog, openNotebookDialog, openPodcastDialog } = useCreateDialogs()
  const isDesktop = useIsDesktop()
  const isDrawer = !isDesktop

  // The drawer is always shown expanded; collapse only applies to desktop.
  const collapsed = isCollapsed && !isDrawer

  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [isMac, setIsMac] = useState(true) // Default to Mac for SSR

  // Keep the drawer's focus lifecycle local to the shell. The trigger lives
  // in MobileTopBar, so restoration uses its stable DOM id rather than
  // coupling the two components through another store field.
  const drawerRef = useRef<HTMLDivElement>(null)
  const drawerCloseRef = useRef<HTMLButtonElement>(null)
  const wasDrawerOpenRef = useRef(false)

  // Only the deepest matching route should be highlighted. A plain
  // `startsWith('/settings')` would light both Settings and Models for
  // `/settings/api-keys`.
  const activeHref = navigation
    .flatMap((section) => section.items)
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname?.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0]

  // Detect platform for keyboard shortcut display
  useEffect(() => {
    setIsMac(navigator.platform.toLowerCase().includes('mac'))
  }, [])

  const closeMobileSidebar = useCallback(() => setMobileOpen(false), [setMobileOpen])

  // Close the drawer whenever the route changes (e.g. after tapping a nav link)
  useEffect(() => {
    if (isDrawer) setMobileOpen(false)
  }, [pathname, isDrawer, setMobileOpen])

  // Close the drawer on Escape and keep keyboard focus inside it while open.
  useEffect(() => {
    if (!isDrawer || !mobileOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMobileSidebar()

      if (event.key !== 'Tab' || !drawerRef.current) return

      // A dropdown menu is rendered in a portal. Once focus leaves the
      // drawer for that menu, let Radix manage its own roving focus.
      if (!drawerRef.current.contains(event.target as Node)) return

      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('aria-hidden'))

      if (focusable.length === 0) {
        event.preventDefault()
        drawerCloseRef.current?.focus()
        return
      }

      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement)
      if (currentIndex === -1) {
        event.preventDefault()
        focusable[event.shiftKey ? focusable.length - 1 : 0]?.focus()
      } else if (event.shiftKey && currentIndex === 0) {
        event.preventDefault()
        focusable[focusable.length - 1]?.focus()
      } else if (!event.shiftKey && currentIndex === focusable.length - 1) {
        event.preventDefault()
        focusable[0]?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isDrawer, mobileOpen, closeMobileSidebar])

  // Move focus into the drawer when it opens and return it to the trigger
  // when the drawer closes (Escape, backdrop, route change, or close button).
  useEffect(() => {
    if (!isDrawer) {
      wasDrawerOpenRef.current = false
      return
    }

    if (mobileOpen) {
      wasDrawerOpenRef.current = true
      drawerCloseRef.current?.focus()
      return
    }

    if (
      wasDrawerOpenRef.current &&
      drawerRef.current &&
      drawerRef.current.contains(document.activeElement)
    ) {
      document.getElementById('mobile-menu-trigger')?.focus()
    }
    wasDrawerOpenRef.current = false
  }, [isDrawer, mobileOpen])

  // Prevent the page behind the overlay from scrolling on touch devices,
  // while preserving any pre-existing body overflow style on cleanup.
  useEffect(() => {
    if (!isDrawer || !mobileOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isDrawer, mobileOpen])

  const handleCreateSelection = (target: CreateTarget) => {
    setCreateMenuOpen(false)
    closeMobileSidebar()

    if (target === 'source') {
      openSourceDialog()
    } else if (target === 'notebook') {
      openNotebookDialog()
    } else {
      openPodcastDialog()
    }
  }

  return (
    <TooltipProvider delayDuration={0}>
      {isDrawer && (
        <div
          data-testid="sidebar-backdrop"
          className={cn(
            'fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 motion-reduce:transition-none',
            mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
          aria-hidden="true"
          onClick={closeMobileSidebar}
        />
      )}
      <div
        id="mobile-sidebar"
        ref={drawerRef}
        className={cn(
          'app-sidebar flex shrink-0 flex-col border-sidebar-border bg-sidebar',
          isDrawer
            ? cn(
                'fixed inset-y-0 left-0 z-50 w-[min(18rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] transform-gpu border-r pb-[env(safe-area-inset-bottom)] transition-transform duration-200 ease-out motion-reduce:transition-none',
                mobileOpen ? 'translate-x-0' : 'pointer-events-none -translate-x-full'
              )
            : cn(
                'h-full border-r transition-[width] duration-200 ease-out motion-reduce:transition-none',
                collapsed ? 'w-16' : 'w-64'
              )
        )}
        role={isDrawer ? 'dialog' : undefined}
        aria-modal={isDrawer && mobileOpen ? true : undefined}
        aria-label={isDrawer ? t('navigation.nav') : undefined}
        aria-hidden={isDrawer && !mobileOpen ? true : undefined}
        inert={isDrawer && !mobileOpen ? true : undefined}
      >
        <div
          className={cn(
            'flex flex-shrink-0 items-center group',
            isDrawer ? 'h-auto min-h-16 justify-between pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top)]' :
              !collapsed ? 'h-16 justify-between px-4' : 'h-16 justify-center px-2'
          )}
        >
          {isDrawer ? (
            <>
              <div className="flex min-w-0 items-center gap-2.5">
                <LogoPebbles />
                <span className="truncate font-display text-[15px] font-bold tracking-tight text-sidebar-foreground">
                  {t('common.appName')}
                </span>
              </div>
              <Button
                ref={drawerCloseRef}
                variant="ghost"
                size="sm"
                onClick={closeMobileSidebar}
                className="h-11 w-11 shrink-0 touch-manipulation p-0 text-sidebar-foreground hover:bg-sidebar-accent"
                aria-label={t('common.close')}
              >
                <X className="h-5 w-5" />
              </Button>
            </>
          ) : collapsed ? (
            <div className="relative flex items-center justify-center w-full">
              <LogoPebbles className="flex-col gap-[3px] transition-opacity group-hover:opacity-0 pointer-coarse:hidden" />
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleCollapse}
                className="absolute text-sidebar-foreground opacity-0 transition-opacity hover:bg-sidebar-accent focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
                aria-label={t('navigation.openMenu')}
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <LogoPebbles />
                <span className="font-display text-[15px] font-bold tracking-tight text-sidebar-foreground">
                  {t('common.appName')}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleCollapse}
                className="text-sidebar-foreground hover:bg-sidebar-accent"
                aria-label={t('common.close')}
                data-testid="sidebar-toggle"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <nav
          className={cn(
            'min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain py-4',
            collapsed ? 'px-2' : 'px-3',
            isDrawer && 'pl-[max(0.75rem,env(safe-area-inset-left))]'
          )}
          aria-label={t('navigation.nav')}
        >
          <div
            className={cn(
              'mb-4',
              collapsed ? 'px-0' : 'px-3'
            )}
          >
            <DropdownMenu open={createMenuOpen} onOpenChange={setCreateMenuOpen}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full justify-center px-2 font-display font-bold"
                        aria-label={t('common.create')}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                   <TooltipContent side="right">{t('common.create')}</TooltipContent>
                </Tooltip>
              ) : (
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    className={cn(
                      'w-full justify-start font-display font-bold',
                      isDrawer && 'min-h-11 touch-manipulation'
                    )}
                   >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('common.create')}
                  </Button>
                </DropdownMenuTrigger>
              )}

              <DropdownMenuContent
                align={collapsed ? 'end' : 'start'}
                side={collapsed ? 'right' : 'bottom'}
                className="w-48"
              >
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    handleCreateSelection('source')
                  }}
                  className="gap-2"
                >
                   <FileText className="h-4 w-4" />
                  {t('common.source')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    handleCreateSelection('notebook')
                  }}
                  className="gap-2"
                >
                   <Book className="h-4 w-4" />
                  {t('common.notebook')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    handleCreateSelection('podcast')
                  }}
                  className="gap-2"
                >
                   <Mic className="h-4 w-4" />
                  {t('common.podcast')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {navigation.map((section, index) => (
            <div key={section.title}>
              {index > 0 && (
                <Separator className="my-3" />
              )}
              <div className="space-y-1">
                {!collapsed && (
                  <h3 className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/40">
                    {section.title}
                  </h3>
                )}

                {section.items.map((item) => {
                  const isActive = activeHref === item.href
                  const button = (
                    <Button
                      asChild
                      variant="ghost"
                      className={cn(
                        'relative w-full min-w-0 gap-2.5 text-[13px] font-medium text-sidebar-foreground/80 sidebar-menu-item',
                        isActive &&
                          'bg-popover font-semibold text-sidebar-foreground ring-1 ring-inset ring-border before:absolute before:-left-1.5 before:top-[7px] before:bottom-[7px] before:w-[3px] before:rounded-[2px] before:bg-fern',
                        collapsed ? 'justify-center px-2' : 'justify-start',
                        isDrawer && 'min-h-11 touch-manipulation'
                      )}
                    >
                      <Link
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        className="flex min-w-0 flex-1 items-center gap-2.5"
                      >
                        <item.icon className={cn('h-4 w-4 opacity-85', item.iconClass)} />
                        {!collapsed && <span className="min-w-0 truncate">{item.name}</span>}
                      </Link>
                    </Button>
                  )

                  if (collapsed) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>
                          {button}
                        </TooltipTrigger>
                        <TooltipContent side="right">{item.name}</TooltipContent>
                      </Tooltip>
                    )
                  }

                  return (
                    <div key={item.href}>{button}</div>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div
          className={cn(
            'shrink-0 space-y-2 border-t border-sidebar-border p-3',
            collapsed && 'px-2',
            isDrawer && 'pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] [&_[data-slot=button]]:min-h-11 [&_[data-slot=button]]:touch-manipulation'
          )}
        >
          {/* Command Palette hint */}
          {!collapsed && !isDrawer && (
            <div className="px-3 py-1.5 text-xs text-sidebar-foreground/60">
              <div className="flex items-center justify-between">
                 <span className="flex items-center gap-1.5">
                  <Command className="h-3 w-3" />
                  {t('common.quickActions')}
                </span>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  {isMac ? <span className="text-xs">⌘</span> : <span>Ctrl+</span>}K
                </kbd>
              </div>
               <p className="mt-1 text-[10px] text-sidebar-foreground/40">
                {t('common.quickActionsDesc')}
              </p>
            </div>
          )}

            <div
             className={cn(
               'flex flex-col gap-2',
               collapsed ? 'items-center' : 'items-stretch'
             )}
           >
             {collapsed ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <ThemeToggle iconOnly />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">{t('common.theme')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <LanguageToggle iconOnly />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">{t('common.language')}</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <>
                <ThemeToggle />
                <LanguageToggle />
              </>
            )}
          </div>

          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-center sidebar-menu-item"
                  onClick={logout}
                  aria-label={t('common.signOut')}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
               <TooltipContent side="right">{t('common.signOut')}</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="outline"
              className="w-full justify-start gap-3 sidebar-menu-item"
              onClick={logout}
              aria-label={t('common.signOut')}
             >
              <LogOut className="h-4 w-4" />
              {t('common.signOut')}
            </Button>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
