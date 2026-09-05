import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface NotebookColumnsState {
  // Legacy per-column collapse state (kept for compatibility; the new
  // context panel uses contextPanelCollapsed instead).
  sourcesCollapsed: boolean
  notesCollapsed: boolean
  toggleSources: () => void
  toggleNotes: () => void
  setSources: (collapsed: boolean) => void
  setNotes: (collapsed: boolean) => void
  // Whole context-panel collapse state for the notebook detail page.
  contextPanelCollapsed: boolean
  toggleContextPanel: () => void
  setContextPanelCollapsed: (collapsed: boolean) => void
  // Hydration guard so the initial server render never reads unhydrated
  // persisted values (same pattern as the auth store).
  hasHydrated: boolean
  setHasHydrated: (hydrated: boolean) => void
}

export const useNotebookColumnsStore = create<NotebookColumnsState>()(
  persist(
    (set) => ({
      sourcesCollapsed: false,
      notesCollapsed: false,
      toggleSources: () => set((state) => ({ sourcesCollapsed: !state.sourcesCollapsed })),
      toggleNotes: () => set((state) => ({ notesCollapsed: !state.notesCollapsed })),
      setSources: (collapsed) => set({ sourcesCollapsed: collapsed }),
      setNotes: (collapsed) => set({ notesCollapsed: collapsed }),
      contextPanelCollapsed: false,
      toggleContextPanel: () =>
        set((state) => ({ contextPanelCollapsed: !state.contextPanelCollapsed })),
      setContextPanelCollapsed: (collapsed) => set({ contextPanelCollapsed: collapsed }),
      hasHydrated: false,
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
    }),
    {
      name: 'notebook-columns-storage',
      partialize: (state) => ({
        sourcesCollapsed: state.sourcesCollapsed,
        notesCollapsed: state.notesCollapsed,
        contextPanelCollapsed: state.contextPanelCollapsed,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
