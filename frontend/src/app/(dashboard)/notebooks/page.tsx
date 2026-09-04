'use client'

import { useMemo, useState } from 'react'

import { AppShell } from '@/components/layout/AppShell'
import { NotebookList } from './components/NotebookList'
import { RecentlyViewed } from './components/RecentlyViewed'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Plus, LayoutGrid, List, Search } from 'lucide-react'
import { useNotebooks } from '@/lib/hooks/use-notebooks'
import { CreateNotebookDialog } from '@/components/notebooks/CreateNotebookDialog'
import { Input } from '@/components/ui/input'
import { useTranslation } from '@/lib/hooks/use-translation'
import { useNotebookViewStore } from '@/lib/stores/notebook-view-store'

export default function NotebooksPage() {
  const { t } = useTranslation()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const viewMode = useNotebookViewStore((state) => state.viewMode)
  const setViewMode = useNotebookViewStore((state) => state.setViewMode)
  const { data: notebooks, isLoading } = useNotebooks(false)
  const { data: archivedNotebooks } = useNotebooks(true)

  const normalizedQuery = searchTerm.trim().toLowerCase()

  const filteredActive = useMemo(() => {
    if (!notebooks) {
      return undefined
    }
    if (!normalizedQuery) {
      return notebooks
    }
    return notebooks.filter((notebook) =>
      notebook.name.toLowerCase().includes(normalizedQuery)
    )
  }, [notebooks, normalizedQuery])

  const filteredArchived = useMemo(() => {
    if (!archivedNotebooks) {
      return undefined
    }
    if (!normalizedQuery) {
      return archivedNotebooks
    }
    return archivedNotebooks.filter((notebook) =>
      notebook.name.toLowerCase().includes(normalizedQuery)
    )
  }, [archivedNotebooks, normalizedQuery])

  const hasArchived = (archivedNotebooks?.length ?? 0) > 0
  const isSearching = normalizedQuery.length > 0

  return (
    <AppShell>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader
          title={t('notebooks.title')}
          description={t('notebooks.pageDescription')}
          actions={
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              {t('notebooks.newNotebook')}
            </Button>
          }
        />

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="notebook-search"
              name="notebook-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t('notebooks.searchPlaceholder')}
              autoComplete="off"
              aria-label={t('common.accessibility.searchNotebooks')}
              className="h-11 pl-9 sm:h-9"
            />
          </div>
          <div className="flex w-fit items-center rounded-md border p-0.5">
            <Button
              variant={viewMode === 'tile' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-10 w-10 p-0 sm:h-8 sm:w-8"
              onClick={() => setViewMode('tile')}
              aria-label={t('notebooks.tileView')}
              aria-pressed={viewMode === 'tile'}
              title={t('notebooks.tileView')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-10 w-10 p-0 sm:h-8 sm:w-8"
              onClick={() => setViewMode('list')}
              aria-label={t('notebooks.listView')}
              aria-pressed={viewMode === 'list'}
              title={t('notebooks.listView')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-8">
          <RecentlyViewed />

          <NotebookList 
            notebooks={filteredActive} 
            isLoading={isLoading}
            title={t('notebooks.activeNotebooks')}
            emptyTitle={isSearching ? t('common.noMatches') : undefined}
            emptyDescription={isSearching ? t('common.tryDifferentSearch') : undefined}
            onAction={!isSearching ? () => setCreateDialogOpen(true) : undefined}
            actionLabel={!isSearching ? t('notebooks.newNotebook') : undefined}
          />
          
          {hasArchived && (
            <NotebookList 
              notebooks={filteredArchived} 
              isLoading={false}
              title={t('notebooks.archivedNotebooks')}
              collapsible
              emptyTitle={isSearching ? t('common.noMatches') : undefined}
              emptyDescription={isSearching ? t('common.tryDifferentSearch') : undefined}
            />
          )}
        </div>
        </div>
      </div>

      <CreateNotebookDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </AppShell>
  )
}
