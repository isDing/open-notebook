'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ComponentProps } from 'react'

type NavigationLinkProps = Omit<ComponentProps<typeof Link>, 'href' | 'prefetch'> & { href: string }

/** Warm a destination on intent, without downloading every visible list item. */
export function NavigationLink({ href, onMouseEnter, onFocus, ...props }: NavigationLinkProps) {
  const router = useRouter()
  return (
    <Link {...props} href={href} prefetch={false}
      onMouseEnter={event => { router.prefetch(href); onMouseEnter?.(event) }}
      onFocus={event => { router.prefetch(href); onFocus?.(event) }} />
  )
}
