import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/** Standard empty placeholder: quiet icon tile, one title, one line of
 *  context, optional single action. Centered inside its parent. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center sm:py-16', className)}>
      <span className="mb-5 flex size-14 items-center justify-center rounded-xl border bg-popover shadow-soft">
        <Icon className="h-6 w-6 text-primary-ink" aria-hidden="true" />
      </span>
      <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
