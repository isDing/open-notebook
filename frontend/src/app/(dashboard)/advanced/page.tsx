'use client'

import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/common/PageHeader'
import { RebuildEmbeddings } from './components/RebuildEmbeddings'
import { SystemInfo } from './components/SystemInfo'
import { useTranslation } from '@/lib/hooks/use-translation'

export default function AdvancedPage() {
  const { t } = useTranslation()
  return (
    <AppShell>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto max-w-4xl space-y-6">
            <PageHeader
              title={t('advanced.pageTitle')}
              description={t('advanced.pageDescription')}
              className="mb-0"
            />
            <SystemInfo />
            <RebuildEmbeddings />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
