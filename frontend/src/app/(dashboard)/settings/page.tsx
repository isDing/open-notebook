'use client'

import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/common/PageHeader'
import { SettingsForm } from './components/SettingsForm'
import { useTranslation } from '@/lib/hooks/use-translation'

export default function SettingsPage() {
  const { t } = useTranslation()
  return (
    <AppShell>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 py-5 md:px-6 md:py-6">
          <div className="max-w-4xl">
            <PageHeader
              title={t('settings.pageTitle')}
              description={t('settings.pageDescription')}
              className="mb-6"
            />
            <SettingsForm />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
