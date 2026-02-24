'use client'

import { Globe } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Language, LanguageLabels, type LanguageType } from '@/types'
import { useTranslation } from '@/i18n/use-translation'

export function LanguageSwitcher({ variant = 'nav' }: { variant?: 'nav' | 'auth' }) {
  const { language, setLanguage } = useTranslation()

  const languages = Object.values(Language) as LanguageType[]

  if (variant === 'auth') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <Globe className="h-4 w-4" />
            {language.toUpperCase()}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {languages.map((lang) => (
            <DropdownMenuItem
              key={lang}
              onClick={() => setLanguage(lang)}
              className={language === lang ? 'bg-accent' : ''}
            >
              {LanguageLabels[lang]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white w-full">
          <Globe className="h-4 w-4 shrink-0" />
          {LanguageLabels[language]}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => setLanguage(lang)}
            className={language === lang ? 'bg-accent' : ''}
          >
            {LanguageLabels[lang]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
