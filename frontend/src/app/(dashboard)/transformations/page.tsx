'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/common/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DefaultPromptEditor } from './components/DefaultPromptEditor'
import { TransformationsList } from './components/TransformationsList'
import { TransformationPlayground } from './components/TransformationPlayground'
import { PresetList } from './components/PresetList'
import { useTransformations } from '@/lib/hooks/use-transformations'
import { Transformation } from '@/lib/types/transformations'
import { Wand2, FlaskConical, Sparkles } from 'lucide-react'
import { useTranslation } from '@/lib/hooks/use-translation'

export default function TransformationsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('transformations')
  const [selectedTransformation, setSelectedTransformation] = useState<Transformation | undefined>()
  const { data: transformations, isLoading } = useTransformations()

  const handlePlayground = (transformation: Transformation) => {
    setSelectedTransformation(transformation)
    setActiveTab('playground')
  }

  return (
    <AppShell>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader
          title={t('transformations.title')}
          description={t('transformations.desc')}
          className="mb-6"
        />
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList aria-label={t('common.accessibility.transformationViews')} className="w-full max-w-xl">
            <TabsTrigger value="transformations" className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              {t('transformations.title')}
            </TabsTrigger>
          <TabsTrigger value="playground" className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            {t('transformations.playground')}
          </TabsTrigger>
          <TabsTrigger value="presets" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {t('presets.title')}
          </TabsTrigger>
        </TabsList>
          
          <TabsContent value="transformations" className="space-y-6">
            <DefaultPromptEditor />
            <TransformationsList 
              transformations={transformations} 
              isLoading={isLoading}
              onPlayground={handlePlayground}
            />
          </TabsContent>
          
          <TabsContent value="playground">
            <TransformationPlayground 
              transformations={transformations}
              selectedTransformation={selectedTransformation}
            />
          </TabsContent>

          <TabsContent value="presets">
            <PresetList />
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </AppShell>
  )
}
