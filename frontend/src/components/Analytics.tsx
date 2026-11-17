import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

import {
  syncClarityRecording,
  trackAssistantChatOpen,
  trackPageView,
  trackWhatsAppClick,
} from '@/lib/analytics'

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
    const handleAssistantChatOpen = () => trackAssistantChatOpen()
    const handleAssistantWhatsAppClick = () => trackWhatsAppClick('assistant_message')

    document.addEventListener('ciem:assistant-chat-open', handleAssistantChatOpen)
    document.addEventListener('ciem:assistant-whatsapp-click', handleAssistantWhatsAppClick)

    return () => {
      document.removeEventListener('ciem:assistant-chat-open', handleAssistantChatOpen)
      document.removeEventListener('ciem:assistant-whatsapp-click', handleAssistantWhatsAppClick)
    }
  }, [])

  return null
}
