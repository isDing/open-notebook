'use client'

import { useState } from 'react'
import { Book, FileText, Mic, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCreateDialogs } from '@/lib/hooks/use-create-dialogs'
import { useTranslation } from '@/lib/hooks/use-translation'
import { cn } from '@/lib/utils'

type CreateTarget = 'source' | 'notebook' | 'podcast'

const CREATE_TARGETS: {
  target: CreateTarget
  icon: typeof FileText
  labelKey: 'common.source' | 'common.notebook' | 'common.podcast'
}[] = [
  { target: 'source', icon: FileText, labelKey: 'common.source' },
  { target: 'notebook', icon: Book, labelKey: 'common.notebook' },
  { target: 'podcast', icon: Mic, labelKey: 'common.podcast' },
]

interface CreateMenuProps {
  /** Icon-only trigger for compact bars (mobile top bar). */
  iconOnly?: boolean
  side?: 'bottom' | 'right'
  className?: string
  /** Called after a target is selected (e.g. to close the mobile drawer). */
  onSelected?: () => void
}

export function CreateMenu({
  iconOnly = false,
  side = 'bottom',
  className,
  onSelected,
}: CreateMenuProps) {
  const { t } = useTranslation()
  const { openSourceDialog, openNotebookDialog, openPodcastDialog } = useCreateDialogs()
  const [open, setOpen] = useState(false)

  const handleSelect = (target: CreateTarget) => {
    setOpen(false)
    if (target === 'source') {
      openSourceDialog()
    } else if (target === 'notebook') {
      openNotebookDialog()
    } else {
      openPodcastDialog()
    }
    onSelected?.()
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="default"
          size={iconOnly ? 'icon' : 'sm'}
          aria-label={t('common.create')}
          className={cn(
            'font-display font-bold',
            iconOnly ? 'h-11 w-11 shrink-0 touch-manipulation p-0' : 'w-full justify-start',
            className
          )}
        >
          <Plus className={iconOnly ? 'h-5 w-5' : 'h-4 w-4'} />
          {!iconOnly && t('common.create')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} className="w-48">
        {CREATE_TARGETS.map(({ target, icon: Icon, labelKey }) => (
          <DropdownMenuItem
            key={target}
            onSelect={(event) => {
              event.preventDefault()
              handleSelect(target)
            }}
            className="gap-2"
          >
            <Icon className="h-4 w-4" />
            {t(labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
