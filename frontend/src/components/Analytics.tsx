import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

import { getAnalyticsEvent, syncClarityRecording, trackAnalyticsEvent, trackPageView } from '@/lib/analytics'

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

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return

      const element = event.target.closest<HTMLElement>('[data-analytics-event]')
      const analyticsEvent = getAnalyticsEvent(element?.dataset.analyticsEvent)
      if (analyticsEvent) trackAnalyticsEvent(analyticsEvent)
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  return null
}
