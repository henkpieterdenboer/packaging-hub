'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Mail, ChevronDown, ExternalLink, Check } from 'lucide-react'

const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true'

export function DemoBanner() {
  const [emailProvider, setEmailProvider] = useState<'ethereal' | 'resend'>('ethereal')
  const [demoEmail, setDemoEmail] = useState('')
  const [demoEmailInput, setDemoEmailInput] = useState('')
  const [emailSaved, setEmailSaved] = useState(false)

  useEffect(() => {
    if (!isTestMode) return
    fetch('/api/email-provider')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data) return
        if (data.provider) setEmailProvider(data.provider)
        if (data.demoEmail) {
          setDemoEmail(data.demoEmail)
          setDemoEmailInput(data.demoEmail)
        }
      })
      .catch(() => {})
  }, [])

  if (!isTestMode) return null

  const handleProviderChange = async (provider: 'ethereal' | 'resend') => {
    const res = await fetch('/api/email-provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    })
    if (res.ok) setEmailProvider(provider)
  }

  const handleEmailSave = async () => {
    const res = await fetch('/api/email-provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demoEmail: demoEmailInput || null }),
    })
    if (res.ok) {
      setDemoEmail(demoEmailInput)
      setEmailSaved(true)
      setTimeout(() => setEmailSaved(false), 2000)
    }
  }

  return (
    <div className="bg-red-50 border-b border-red-200 text-red-700 text-sm font-medium py-1.5 px-4">
      <div className="flex items-center justify-between gap-4 max-w-screen-xl mx-auto flex-wrap">
        <span className="font-semibold whitespace-nowrap">TEST ENVIRONMENT</span>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex items-center gap-1 hover:underline cursor-pointer">
                  <Badge variant="outline" className="bg-white text-red-700 border-red-300 text-xs">
                    {emailProvider === 'resend' ? 'Real mail' : 'Test inbox'}
                  </Badge>
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleProviderChange('ethereal')}>
                  <span className="flex-1">Test inbox (Ethereal)</span>
                  <a
                    href="https://ethereal.email/login"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="ml-2 text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleProviderChange('resend')}>
                  Real mail (Resend)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-1.5">
            <Input
              type="email"
              value={demoEmailInput}
              onChange={(e) => setDemoEmailInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEmailSave()}
              placeholder="Redirect emails to..."
              className="h-6 w-52 text-xs bg-white border-red-300 placeholder:text-red-300"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleEmailSave}
              className="h-6 px-2 text-xs border-red-300 bg-white text-red-700 hover:bg-red-100"
            >
              {emailSaved ? <Check className="h-3 w-3" /> : 'Save'}
            </Button>
          </div>

          {demoEmail && (
            <span className="text-xs text-red-500">
              Active: {demoEmail}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
