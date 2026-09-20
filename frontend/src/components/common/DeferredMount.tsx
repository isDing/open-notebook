'use client'

import { useEffect, useState, type ReactNode } from 'react'

/** Mount on first use, then retain drafts and in-flight work when hidden. */
export function DeferredMount({ active, children }: { active: boolean; children: ReactNode }) {
  const [hasOpened, setHasOpened] = useState(active)

  useEffect(() => {
    if (active) setHasOpened(true)
  }, [active])

  return active || hasOpened ? children : null
}
