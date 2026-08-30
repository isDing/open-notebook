'use client'

import { AppShell } from '@/components/layout/AppShell'
import { RebuildEmbeddings } from './components/RebuildEmbeddings'
import { SystemInfo } from './components/SystemInfo'

export default function AdvancedPage() {
  return (
    <AppShell>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 sm:p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <SystemInfo />
            <RebuildEmbeddings />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
