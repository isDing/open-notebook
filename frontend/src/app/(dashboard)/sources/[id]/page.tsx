'use client'

import { useRouter, useParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, FileText, MessageSquare } from 'lucide-react'
import { useSourceChat } from '@/lib/hooks/use-source-chat'
import { ChatPanel } from '@/components/sources/ChatPanel'
import { useNavigation } from '@/lib/hooks/use-navigation'
import { SourceDetailContent } from '@/components/sources/SourceDetailContent'
import { useTranslation } from '@/lib/hooks/use-translation'
import { cn } from '@/lib/utils'
import { AppShell } from '@/components/layout/AppShell'

export default function SourceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const sourceId = params?.id ? decodeURIComponent(params.id as string) : ''
  const navigation = useNavigation()
  const { t } = useTranslation()
  const [mobilePane, setMobilePane] = useState<'content' | 'chat'>('content')

  // Initialize source chat
  const chat = useSourceChat(sourceId)

  const handleBack = useCallback(() => {
    const returnPath = navigation.getReturnPath()
    router.push(returnPath)
    navigation.clearReturnTo()
  }, [navigation, router])

  return (
    <AppShell>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Back button */}
        <div className="shrink-0 px-4 pb-3 pt-2 sm:px-6 sm:pb-4 sm:pt-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="min-h-11 max-w-full justify-start touch-manipulation sm:min-h-8"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="truncate">{navigation.getReturnLabel()}</span>
          </Button>
        </div>

        <div className="shrink-0 px-4 pb-3 lg:hidden">
          <Tabs value={mobilePane} onValueChange={(value) => setMobilePane(value as 'content' | 'chat')}>
              <TabsList className="grid w-full grid-cols-2" aria-label={t('sources.detailsTitle')}>
                <TabsTrigger value="content">
                  <FileText className="h-4 w-4" />
                  {t('navigation.sources')}
                </TabsTrigger>
              <TabsTrigger value="chat">
                <MessageSquare className="h-4 w-4" />
                {t('common.chat')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Main content: Source detail + Chat */}
        <div className="grid min-h-0 min-w-0 flex-1 overflow-hidden px-4 pb-4 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] lg:gap-6">
          {/* Left column - Source detail */}
          <div className={cn(
            'min-h-0 min-w-0 overflow-y-auto pb-4 lg:block lg:px-4 lg:pb-6',
            mobilePane === 'content' ? 'block' : 'hidden'
          )}>
            <SourceDetailContent
              sourceId={sourceId}
              showChatButton={false}
              onClose={handleBack}
            />
          </div>

          {/* Right column - Chat */}
          <div className={cn(
            'min-h-0 min-w-0 overflow-hidden pb-4 lg:block lg:px-4 lg:pb-6',
            mobilePane === 'chat' ? 'block' : 'hidden'
          )}>
            <ChatPanel
              messages={chat.messages}
              isStreaming={chat.isStreaming}
              contextIndicators={chat.contextIndicators}
              onSendMessage={(message, model) => chat.sendMessage(message, model)}
              modelOverride={chat.currentSession?.model_override}
              onModelChange={(model) => {
                if (chat.currentSessionId) {
                  chat.updateSession(chat.currentSessionId, { model_override: model })
                }
              }}
              sessions={chat.sessions}
              currentSessionId={chat.currentSessionId}
              onCreateSession={(title) => chat.createSession({ title })}
              onSelectSession={chat.switchSession}
              onUpdateSession={(sessionId, title) => chat.updateSession(sessionId, { title })}
              onDeleteSession={chat.deleteSession}
              loadingSessions={chat.loadingSessions}
            />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
