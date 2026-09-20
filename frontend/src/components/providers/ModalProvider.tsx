'use client'

import { useModalManager } from '@/lib/hooks/use-modal-manager'
import dynamic from 'next/dynamic'
import { DeferredMount } from '@/components/common/DeferredMount'

const NoteReaderDialog = dynamic(() => import('@/components/notebooks/NoteReaderDialog').then(m => m.NoteReaderDialog))
const SourceInsightDialog = dynamic(() => import('@/components/sources/SourceInsightDialog').then(m => m.SourceInsightDialog))
const SourceDialog = dynamic(() => import('@/components/sources/SourceDialog').then(m => m.SourceDialog))

/**
 * Modal Provider Component
 *
 * Renders modals based on URL query parameters (?modal=type&id=xxx)
 * Manages modal state through the useModalManager hook
 *
 * Supported modal types:
 * - source: Source detail modal
 * - note: Read-only note modal
 * - insight: Source insight modal
 */
export function ModalProvider() {
  const { modalType, modalId, closeModal } = useModalManager()

  return (
    <>
      {/* Source Modal */}
      <DeferredMount active={modalType === 'source'}>
        <SourceDialog
          open={modalType === 'source'}
          onOpenChange={(open) => {
            if (!open) closeModal()
          }}
          sourceId={modalId}
        />
      </DeferredMount>

      {/* Note Modal */}
      <DeferredMount active={modalType === 'note'}>
        <NoteReaderDialog
          open={modalType === 'note'}
          onOpenChange={(open) => {
            if (!open) closeModal()
          }}
          noteId={modalId}
        />
      </DeferredMount>

      {/* Source Insight Modal */}
      <DeferredMount active={modalType === 'insight'}>
        <SourceInsightDialog
          open={modalType === 'insight'}
          onOpenChange={(open) => {
            if (!open) closeModal()
          }}
          insight={modalId ? { id: modalId, insight_type: '', content: '' } : undefined}
        />
      </DeferredMount>
    </>
  )
}
