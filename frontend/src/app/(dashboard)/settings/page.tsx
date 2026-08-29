'use client'

import { AppShell } from '@/components/layout/AppShell'
import { SettingsForm } from './components/SettingsForm'
import { useSettings } from '@/lib/hooks/use-settings'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { useTranslation } from '@/lib/hooks/use-translation'

export default function SettingsPage() {
  const { t } = useTranslation()
  const { refetch } = useSettings()

  return (
    <AppShell>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 md:p-6">
          <div className="max-w-4xl">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-bold tracking-tight">{t('navigation.settings')}</h1>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="h-11 w-11 shrink-0 p-0 sm:h-8 sm:w-8"
                aria-label={t('common.refresh')}
                title={t('common.refresh')}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <SettingsForm />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
