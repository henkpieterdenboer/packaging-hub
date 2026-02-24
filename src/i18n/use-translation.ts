'use client'

import { useContext } from 'react'
import { LanguageContext } from './language-provider'

export function useTranslation() {
  return useContext(LanguageContext)
}
