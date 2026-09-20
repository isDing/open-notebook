'use client'

import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'

import { AppShell } from '@/components/layout/AppShell'
import { NotebookList } from './components/NotebookList'
import { RecentlyViewed } from './components/RecentlyViewed'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Plus, LayoutGrid, List } from 'lucide-react'
import { useNotebooks } from '@/lib/hooks/use-notebooks'
import { DeferredMount } from '@/components/common/DeferredMount'
import { SearchInput } from '@/components/common/SearchInput'
import { useTranslation } from '@/lib/hooks/use-translation'
import { useNotebookViewStore } from '@/lib/stores/notebook-view-store'

const CreateNotebookDialog = dynamic(() => import('@/components/notebooks/CreateNotebookDialog').then(m => m.CreateNotebookDialog))

export default function NotebooksPage() {
  const { t } = useTranslation()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const viewMode = useNotebookViewStore((state) => state.viewMode)
  const setViewMode = useNotebookViewStore((state) => state.setViewMode)
  const { data: notebooks, isLoading, isError, refetch } = useNotebooks(false)
  const archived = useNotebooks(true)
  const archivedNotebooks = archived.data
  const openCreateDialog = useCallback(() => setCreateDialogOpen(true), [])

  const deferredSearch = useDeferredValue(searchTerm)
  const normalizedQuery = deferredSearch.trim().toLowerCase()

  const filteredActive = useMemo(() => {
    if (!notebooks) {
      return undefined
    }
    if (!normalizedQuery) {
      return notebooks
    }
    return notebooks.filter((notebook) =>
      `${notebook.name} ${notebook.description ?? ''}`.toLowerCase().includes(normalizedQuery)
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
      `${notebook.name} ${notebook.description ?? ''}`.toLowerCase().includes(normalizedQuery)
    )
  }, [archivedNotebooks, normalizedQuery])

  const hasArchived = (archivedNotebooks?.length ?? 0) > 0
  const isSearching = normalizedQuery.length > 0

  return (
    <AppShell>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-8 sm:py-10 lg:px-10">
          <PageHeader
            title={t('notebooks.title')}
            description={t('notebooks.pageDescription')}
            actions={<Button className="h-11 px-5" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />{t('notebooks.newNotebook')}
            </Button>}
          />
          <div className="mb-8 flex items-center gap-3 rounded-xl border bg-card p-2 shadow-soft sm:p-3">
              <SearchInput
                id="notebook-search"
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={t('notebooks.searchPlaceholder')}
                label={t('common.accessibility.searchNotebooks')}
              />
              <div className="flex shrink-0 items-center rounded-lg bg-muted p-0.5">
                <Button
                  variant={viewMode === 'tile' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-10 w-10 p-0"
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
                  className="h-10 w-10 p-0"
                  onClick={() => setViewMode('list')}
                  aria-label={t('notebooks.listView')}
                  aria-pressed={viewMode === 'list'}
                  title={t('notebooks.listView')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
          </div>

          <div className="space-y-8" aria-busy={searchTerm !== deferredSearch}>
            {!isSearching && <RecentlyViewed limit={4} />}

            <NotebookList
              notebooks={filteredActive}
              isLoading={isLoading}
              isError={isError}
              onRetry={refetch}
              title={t('notebooks.activeNotebooks')}
              emptyTitle={isSearching ? t('common.noMatches') : undefined}
              emptyDescription={isSearching ? t('common.tryDifferentSearch') : undefined}
              onAction={!isSearching ? openCreateDialog : undefined}
              actionLabel={!isSearching ? t('notebooks.newNotebook') : undefined}
            />

            {(hasArchived || archived.isError) && (
              <NotebookList
                notebooks={filteredArchived}
                isLoading={false}
                isError={archived.isError}
                onRetry={archived.refetch}
                title={t('notebooks.archivedNotebooks')}
                collapsible
                emptyTitle={isSearching ? t('common.noMatches') : undefined}
                emptyDescription={isSearching ? t('common.tryDifferentSearch') : undefined}
              />
            )}
          </div>
        </div>
      </div>

      <DeferredMount active={createDialogOpen}>
        <CreateNotebookDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />
      </DeferredMount>
    </AppShell>
  )
}
