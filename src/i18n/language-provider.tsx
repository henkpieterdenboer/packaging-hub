'use client'

import { createContext, useCallback, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { getTranslation, type TranslationFunction } from '@/i18n'
import type { LanguageType } from '@/types'

interface LanguageContextType {
  language: LanguageType
  t: TranslationFunction
  setLanguage: (lang: LanguageType) => Promise<void>
}

export const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  t: (key: string) => key,
  setLanguage: async () => {},
})

function getInitialLanguage(sessionLang?: string): LanguageType {
  if (sessionLang && ['en', 'nl', 'pl'].includes(sessionLang)) {
    return sessionLang as LanguageType
  }
  // Check cookie for unauthenticated users
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|; )preferred-language=([^;]*)/)
    if (match && ['en', 'nl', 'pl'].includes(match[1])) {
      return match[1] as LanguageType
    }
  }
  return 'en'
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { data: session, update: updateSession } = useSession()
  const [language, setLanguageState] = useState<LanguageType>(
    () => getInitialLanguage(session?.user?.preferredLanguage)
  )

  // Sync language from session when it changes (e.g. after login)
  const sessionLang = session?.user?.preferredLanguage
  if (sessionLang && ['en', 'nl', 'pl'].includes(sessionLang) && sessionLang !== language) {
    setLanguageState(sessionLang as LanguageType)
  }

  const t = useMemo(() => getTranslation(language), [language])

  const setLanguage = useCallback(async (lang: LanguageType) => {
    setLanguageState(lang)
    // Set cookie for unauthenticated pages
    document.cookie = `preferred-language=${lang}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`

    // Update DB if authenticated
    if (session?.user) {
      try {
        await fetch('/api/auth/language', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: lang }),
        })
        await updateSession()
      } catch (error) {
        console.error('[i18n] Failed to update language:', error)
      }
    }
  }, [session?.user, updateSession])

  const value = useMemo(
    () => ({ language, t, setLanguage }),
    [language, t, setLanguage]
  )

  return (
    <LanguageContext value={value}>
      {children}
    </LanguageContext>
  )
}
