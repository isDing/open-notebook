'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ShieldAlert, AlertTriangle, ArrowRight, ExternalLink } from 'lucide-react'
import { useTranslation } from '@/lib/hooks/use-translation'
import { useCredentialStatus, useEnvStatus } from '@/lib/hooks/use-credentials'

export function SetupBanner() {
  const { t } = useTranslation()
  const { data: credentialStatus } = useCredentialStatus()
  const { data: envStatus } = useEnvStatus()

  const encryptionReady = credentialStatus?.encryption_configured ?? true

  const providersToMigrate = useMemo(() => {
    if (!envStatus || !credentialStatus) return []
    const providers: string[] = []
    for (const provider in envStatus) {
      if (envStatus[provider] && credentialStatus.source[provider] === 'environment') {
        providers.push(provider)
      }
    }
    return providers
  }, [envStatus, credentialStatus])

  if (encryptionReady && providersToMigrate.length === 0) {
    return null
  }

  if (!encryptionReady) {
    return (
      <div className="shrink-0 px-3 pt-3 sm:px-4">
        <Alert className="border-destructive/30 bg-destructive-tint p-3 sm:p-4">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          <AlertTitle className="text-destructive">
            {t('setupBanner.encryptionRequired')}
          </AlertTitle>
          <AlertDescription className="flex min-w-0 flex-col gap-2 text-destructive sm:flex-row sm:items-center sm:justify-between">
            <span className="min-w-0 break-words">{t('setupBanner.encryptionRequiredDescription')}</span>
            <a
              href="https://github.com/lfnovo/open-notebook/blob/main/docs/3-USER-GUIDE/api-configuration.md#encryption-setup"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium underline underline-offset-2 touch-manipulation hover:text-destructive/80"
            >
              {t('setupBanner.viewDocs')}
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="shrink-0 px-3 pt-3 sm:px-4">
      <Alert className="border-warn/30 bg-warn-tint p-3 sm:p-4">
        <AlertTriangle className="h-4 w-4 text-warn" />
        <AlertTitle className="text-warn">
          {t('setupBanner.migrationAvailable')}
        </AlertTitle>
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0 break-words text-warn">
            {t('setupBanner.migrationDescription', { count: providersToMigrate.length })}
          </span>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="min-h-11 w-full shrink-0 touch-manipulation border-warn text-warn hover:bg-warn-tint sm:w-auto"
          >
            <Link href="/settings/api-keys">
              {t('setupBanner.goToSettings')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  )
}
