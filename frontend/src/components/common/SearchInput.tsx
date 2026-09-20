'use client'

import { useRef } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/hooks/use-translation'

export function SearchInput({ id, value, onChange, placeholder, label = placeholder }: {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  label?: string
}) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="relative min-w-0 flex-1">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input ref={inputRef} id={id} name={id} value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder} aria-label={label} autoComplete="off"
        className="h-11 bg-background pl-10 pr-12" />
      {value && (
        <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 size-11 text-muted-foreground"
          aria-label={t('common.clearSearch')}
          onClick={() => { onChange(''); inputRef.current?.focus() }}>
          <X className="size-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}
