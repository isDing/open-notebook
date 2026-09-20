'use client'

import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/hooks/use-translation'

export function CollectionSkeleton({ view = 'list' }: { view?: 'tile' | 'list' }) {
  const { t } = useTranslation()

  return (
    <div role="status" aria-label={t('common.loading')} className="space-y-4">
      <span className="sr-only">{t('common.loading')}</span>
      <div aria-hidden="true" className="h-5 w-36 animate-pulse rounded bg-muted" />
      <div aria-hidden="true" className={cn('grid gap-4', view === 'tile' && 'md:grid-cols-2 xl:grid-cols-3')}>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className={cn('flex animate-pulse gap-4 rounded-xl border bg-card p-5', view === 'tile' && 'min-h-44')}>
            <div className="size-10 shrink-0 rounded-lg bg-muted" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-4 w-2/3 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted" />
              {view === 'tile' && <div className="mt-6 h-3 w-1/2 rounded bg-muted" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
