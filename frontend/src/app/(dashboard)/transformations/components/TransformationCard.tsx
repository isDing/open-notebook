'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronRight, Trash2, Wand2, Edit } from 'lucide-react'
import { Transformation } from '@/lib/types/transformations'
import { useDeleteTransformation } from '@/lib/hooks/use-transformations'
import { useTranslation } from '@/lib/hooks/use-translation'
import { cn } from '@/lib/utils'

interface TransformationCardProps {
  transformation: Transformation
  onPlayground?: () => void
  onEdit?: () => void
}

export function TransformationCard({ transformation, onPlayground, onEdit }: TransformationCardProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const deleteTransformation = useDeleteTransformation()

  const handleDelete = () => {
    deleteTransformation.mutate(transformation.id)
    setShowDeleteDialog(false)
  }

  return (
    <>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
              <CollapsibleTrigger className="flex-1 text-left">
                  <div className={cn('flex min-w-0 items-start gap-3', isExpanded ? 'mb-2' : '')}>
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                  <div className="min-w-0 flex flex-col">
                    <span className="break-words font-semibold">{transformation.name}</span>
                    {!isExpanded && transformation.description && (
                      <span className="break-words text-sm text-muted-foreground">{transformation.description}</span>
                    )}
                  </div>
                  {transformation.apply_default && (
                  <Badge variant="secondary" className="shrink-0">{t('common.default')}</Badge>
                  )}
                </div>
              </CollapsibleTrigger>

              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                {onPlayground && (
                  <Button variant="outline" size="sm" onClick={onPlayground} className="flex-1 sm:flex-none">
                    <Wand2 className="h-4 w-4 mr-2" />
                    {t('transformations.playground')}
                  </Button>
                )}
                {onEdit && (
                  <Button variant="outline" size="sm" onClick={onEdit} className="flex-1 sm:flex-none">
                    <Edit className="h-4 w-4 mr-2" />
                    {t('common.edit')}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11 min-w-11 text-destructive hover:text-destructive sm:min-h-8 sm:min-w-8"
                  onClick={() => setShowDeleteDialog(true)}
                  aria-label={t('common.delete')}
                  title={t('common.delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{t('common.title')}</p>
                <p className="text-sm font-medium">{transformation.title || t('sources.untitledSource')}</p>
              </div>

              {transformation.description && (
                <div>
                  <p className="text-sm text-muted-foreground">{t('common.description')}</p>
                  <p className="text-sm leading-6">{transformation.description}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground">{t('transformations.systemPrompt')}</p>
                <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm font-mono">
                  {transformation.prompt}
                </pre>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={t('sources.delete')}
        description={t('transformations.deleteConfirm')}
        confirmText={t('common.delete')}
        confirmVariant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteTransformation.isPending}
      />
    </>
  )
}
