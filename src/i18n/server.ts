import { cookies } from 'next/headers'
import { getTranslation, type TranslationFunction } from '@/i18n'
import type { LanguageType } from '@/types'

export async function getServerLanguage(): Promise<LanguageType> {
  try {
    const cookieStore = await cookies()
    const lang = cookieStore.get('preferred-language')?.value
    if (lang && ['en', 'nl', 'pl'].includes(lang)) {
      return lang as LanguageType
    }
  } catch {
    // cookies() can fail outside request context
  }
  return 'en'
}

export function getServerTranslation(lang: LanguageType | string): TranslationFunction {
  return getTranslation(lang)
}
