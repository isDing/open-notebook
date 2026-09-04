'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/common/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { EpisodesTab } from '@/components/podcasts/EpisodesTab'
import { TemplatesTab } from '@/components/podcasts/TemplatesTab'
import { Mic, LayoutTemplate } from 'lucide-react'
import { useTranslation } from '@/lib/hooks/use-translation'
import { useEpisodeProfiles, useSpeakerProfiles } from '@/lib/hooks/use-podcasts'
import { needsModelSetup } from '@/lib/types/podcasts'

export default function PodcastsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'episodes' | 'templates'>('episodes')

  const { episodeProfiles } = useEpisodeProfiles()
  const { speakerProfiles } = useSpeakerProfiles(episodeProfiles)

  const hasUnconfiguredProfiles = useMemo(() => {
    return episodeProfiles.some(needsModelSetup) || speakerProfiles.some(needsModelSetup)
  }, [episodeProfiles, speakerProfiles])

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
          <PageHeader
            title={t('podcasts.pageTitle')}
            description={t('podcasts.pageDescription')}
            className="mb-0"
          />

          {hasUnconfiguredProfiles ? (
            <Alert className="bg-warn-tint text-warn border-warn/30">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t('podcasts.setupRequired')}</AlertTitle>
              <AlertDescription>
                {t('podcasts.setupRequiredDesc')}
              </AlertDescription>
            </Alert>
          ) : null}

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'episodes' | 'templates')}
            className="space-y-6"
          >
            <TabsList aria-label={t('common.accessibility.podcastViews')} className="w-full max-w-md">
              <TabsTrigger value="episodes">
                <Mic className="h-4 w-4" />
                {t('podcasts.episodesTab')}
              </TabsTrigger>
              <TabsTrigger value="templates">
                <LayoutTemplate className="h-4 w-4" />
                {t('podcasts.templatesTab')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="episodes">
              <EpisodesTab />
            </TabsContent>

            <TabsContent value="templates">
              <TemplatesTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppShell>
  )
}
