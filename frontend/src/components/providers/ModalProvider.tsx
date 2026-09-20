'use client'

import { useModalManager } from '@/lib/hooks/use-modal-manager'
import dynamic from 'next/dynamic'
import { DeferredMount } from '@/components/common/DeferredMount'

const NoteEditorDialog = dynamic(() => import('@/app/(dashboard)/notebooks/components/NoteEditorDialog').then(m => m.NoteEditorDialog))
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
 * - note: Note editor modal
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
        <NoteEditorDialog
          open={modalType === 'note'}
          onOpenChange={(open) => {
            if (!open) closeModal()
          }}
          notebookId="" // Will need to be fetched or handled in Phase 9
          note={modalId ? { id: modalId, title: null, content: null } : undefined}
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
