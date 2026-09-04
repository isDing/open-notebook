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
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <span className="mb-4 flex size-11 items-center justify-center rounded-md border bg-muted/50">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </span>
      <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-[13px] leading-5 text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
