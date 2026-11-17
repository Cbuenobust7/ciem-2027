import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

import { syncClarityRecording, trackPageView } from '@/lib/analytics'

export function Analytics() {
  const { pathname, search } = useLocation()
  const lastPageViewPath = useRef<string | null>(null)

  useEffect(() => {
    syncClarityRecording(pathname, search)

    if (lastPageViewPath.current !== pathname) {
      trackPageView(pathname)
      lastPageViewPath.current = pathname
    }
  }, [pathname, search])

  return null
}
