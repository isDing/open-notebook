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
        'mb-6 flex shrink-0 flex-wrap items-end justify-between gap-x-6 gap-y-4 sm:mb-8',
        className
      )}
    >
      <div className="min-w-0 max-w-3xl">
        <h1 className="break-words text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
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
