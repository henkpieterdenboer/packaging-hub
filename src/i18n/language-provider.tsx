'use client'

import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
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

function useSyncHtmlLang(lang: string) {
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [language, setLanguageState] = useState<LanguageType>(
    () => getInitialLanguage(session?.user?.preferredLanguage)
  )

  // Only sync language from session on login/logout (when userId changes),
  // not on every render — otherwise it overrides the user's explicit choice.
  const [prevUserId, setPrevUserId] = useState<string | null>(null)
  const userId = session?.user?.id ?? null
  const sessionLang = session?.user?.preferredLanguage

  if (userId && userId !== prevUserId) {
    setPrevUserId(userId)
    if (sessionLang && ['en', 'nl', 'pl'].includes(sessionLang)) {
      setLanguageState(sessionLang as LanguageType)
    }
  }
  if (!userId && prevUserId) {
    setPrevUserId(null)
  }

  const t = useMemo(() => getTranslation(language), [language])

  // Keep <html lang> in sync — runs as a side effect after render
  useSyncHtmlLang(language)

  const setLanguage = useCallback(async (lang: LanguageType) => {
    setLanguageState(lang)
    // Set cookie for all pages (including unauthenticated)
    document.cookie = `preferred-language=${lang}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`

    // Update DB if authenticated (fire-and-forget, no session refresh needed)
    if (session?.user) {
      try {
        await fetch('/api/auth/language', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: lang }),
        })
      } catch (error) {
        console.error('[i18n] Failed to update language:', error)
      }
    }
  }, [session?.user])

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
