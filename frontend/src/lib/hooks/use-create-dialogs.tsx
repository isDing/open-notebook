'use client'

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { DeferredMount } from '@/components/common/DeferredMount'

const AddSourceDialog = dynamic(() => import('@/components/sources/AddSourceDialog').then(m => m.AddSourceDialog))
const CreateNotebookDialog = dynamic(() => import('@/components/notebooks/CreateNotebookDialog').then(m => m.CreateNotebookDialog))
const GeneratePodcastDialog = dynamic(() => import('@/components/podcasts/GeneratePodcastDialog').then(m => m.GeneratePodcastDialog))

interface CreateDialogsContextType {
  openSourceDialog: () => void
  openNotebookDialog: () => void
  openPodcastDialog: () => void
}

const CreateDialogsContext = createContext<CreateDialogsContextType | null>(null)

export function CreateDialogsProvider({ children }: { children: ReactNode }) {
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false)
  const [notebookDialogOpen, setNotebookDialogOpen] = useState(false)
  const [podcastDialogOpen, setPodcastDialogOpen] = useState(false)

  const openSourceDialog = useCallback(() => setSourceDialogOpen(true), [])
  const openNotebookDialog = useCallback(() => setNotebookDialogOpen(true), [])
  const openPodcastDialog = useCallback(() => setPodcastDialogOpen(true), [])
  const value = useMemo(() => ({ openSourceDialog, openNotebookDialog, openPodcastDialog }),
    [openSourceDialog, openNotebookDialog, openPodcastDialog])

  return (
    <CreateDialogsContext.Provider
      value={value}
    >
      {children}
      <DeferredMount active={sourceDialogOpen}>
        <AddSourceDialog open={sourceDialogOpen} onOpenChange={setSourceDialogOpen} />
      </DeferredMount>
      <DeferredMount active={notebookDialogOpen}>
        <CreateNotebookDialog open={notebookDialogOpen} onOpenChange={setNotebookDialogOpen} />
      </DeferredMount>
      <DeferredMount active={podcastDialogOpen}>
        <GeneratePodcastDialog open={podcastDialogOpen} onOpenChange={setPodcastDialogOpen} />
      </DeferredMount>
    </CreateDialogsContext.Provider>
  )
}

export function useCreateDialogs() {
  const context = useContext(CreateDialogsContext)
  if (!context) {
    throw new Error('useCreateDialogs must be used within a CreateDialogsProvider')
  }
  return context
}
