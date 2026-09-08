'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { NotebookResponse } from '@/lib/types/api'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MoreHorizontal, Archive, ArchiveRestore, Trash2, FileText, StickyNote } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUpdateNotebook } from '@/lib/hooks/use-notebooks'
import { NotebookDeleteDialog } from './NotebookDeleteDialog'
import { useState } from 'react'
import { useTranslation } from '@/lib/hooks/use-translation'
import { getDateLocale } from '@/lib/utils/date-locale'
interface NotebookCardProps {
  notebook: NotebookResponse
}

export function NotebookCard({ notebook }: NotebookCardProps) {
  const { t, language } = useTranslation()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const router = useRouter()
  const updateNotebook = useUpdateNotebook()

  const handleArchiveToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateNotebook.mutate({
      id: notebook.id,
      data: { archived: !notebook.archived }
    })
  }

  const handleCardClick = () => {
    router.push(`/notebooks/${encodeURIComponent(notebook.id)}`)
  }

  return (
    <>
      <Card
        className="group card-hover gap-0 p-5 sm:p-6"
        onClick={handleCardClick}
        style={{ cursor: 'pointer' }}
      >
        <div className="flex items-start gap-3.5">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-popover"
            aria-hidden="true"
          >
            <FileText className="h-5 w-5 text-foreground/70" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-1">
              <CardTitle className="min-w-0 truncate text-base">
                <Link
                  href={`/notebooks/${encodeURIComponent(notebook.id)}`}
                  onClick={(event) => event.stopPropagation()}
                  className="block truncate rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {notebook.name}
                </Link>
              </CardTitle>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={t('common.actions')}
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={handleArchiveToggle}>
                    {notebook.archived ? (
                      <>
                        <ArchiveRestore className="h-4 w-4 mr-2" />
                        {t('notebooks.unarchive')}
                      </>
                    ) : (
                      <>
                        <Archive className="h-4 w-4 mr-2" />
                        {t('notebooks.archive')}
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowDeleteDialog(true)
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('common.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {notebook.archived && (
              <Badge variant="secondary" className="mt-1.5">
                {t('notebooks.archived')}
              </Badge>
            )}

            <CardDescription className="mt-1.5 line-clamp-2 text-sm">
              {notebook.description || t('chat.noDescription')}
            </CardDescription>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{notebook.source_count}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{notebook.note_count}</span>
            </span>
          </div>
          <span className="shrink-0">
            {t('common.updated', {
              time: formatDistanceToNow(new Date(notebook.updated), {
                addSuffix: true,
                locale: getDateLocale(language)
              })
            })}
          </span>
        </div>
      </Card>

      <NotebookDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        notebookId={notebook.id}
        notebookName={notebook.name}
      />
    </>
  )
}
