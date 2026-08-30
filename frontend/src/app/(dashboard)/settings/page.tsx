'use client'

import { AppShell } from '@/components/layout/AppShell'
import { SettingsForm } from './components/SettingsForm'

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 md:p-6">
          <div className="max-w-4xl">
            <SettingsForm />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
