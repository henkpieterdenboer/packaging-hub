import type { LanguageType } from '@/types'
import en from './locales/en.json'
import nl from './locales/nl.json'
import pl from './locales/pl.json'

type NestedRecord = { [key: string]: string | NestedRecord }

const locales: Record<string, NestedRecord> = { en, nl, pl }

// Cache flattened translations per language
const flatCache: Record<string, Record<string, string>> = {}

function flatten(obj: NestedRecord, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    const value = obj[key]
    if (typeof value === 'string') {
      result[fullKey] = value
    } else {
      Object.assign(result, flatten(value, fullKey))
    }
  }
  return result
}

function getFlatTranslations(lang: string): Record<string, string> {
  if (!flatCache[lang]) {
    flatCache[lang] = flatten(locales[lang] || locales.en)
  }
  return flatCache[lang]
}

export type TranslationFunction = (key: string, params?: Record<string, string | number>) => string

export const localeMap: Record<string, string> = { en: 'en-US', nl: 'nl-NL', pl: 'pl-PL' }

export function getTranslation(lang: LanguageType | string): TranslationFunction {
  const translations = getFlatTranslations(lang)
  const fallback = lang !== 'en' ? getFlatTranslations('en') : translations

  return (key: string, params?: Record<string, string | number>): string => {
    let text = translations[key] ?? fallback[key] ?? key

    if (params) {
      for (const [param, value] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{\\{${param}\\}\\}`, 'g'), String(value))
      }
    }

    return text
  }
}
