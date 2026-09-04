import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}

/** Standard page identity for top-level pages: display-font title, one
 *  quiet description line, right-aligned actions. On mobile the actions
 *  drop below the title at full width. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 sm:mb-6',
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display text-xl font-bold leading-tight tracking-tight sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
          {actions}
        </div>
      ) : null}
    </header>
  )
}
