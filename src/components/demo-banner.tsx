'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, ExternalLink, Check } from 'lucide-react'

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
      <div className="relative flex items-center justify-center">
        <span className="font-semibold whitespace-nowrap">TEST ENVIRONMENT</span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="absolute right-0 flex items-center gap-2 bg-red-50 border-red-300 hover:bg-red-100 h-7"
            >
              <span className="text-xs text-red-700">Mail:</span>
              <Badge
                variant="outline"
                className={`text-xs ${
                  emailProvider === 'resend'
                    ? 'bg-green-100 text-green-700 border-green-300'
                    : 'bg-muted text-muted-foreground border-border'
                }`}
              >
                {emailProvider === 'resend' ? 'Real mail' : 'Test inbox'}
              </Badge>
              <ChevronDown className="h-3 w-3 text-red-700" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
              Email provider
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleProviderChange('ethereal')}
              className={`cursor-pointer ${emailProvider === 'ethereal' ? 'bg-accent font-medium' : ''}`}
            >
              <div className="flex items-center gap-2 w-full">
                {emailProvider === 'ethereal' ? <Check className="h-4 w-4" /> : <div className="w-4" />}
                <span className="flex-1">Test inbox (Ethereal)</span>
                <a
                  href="https://ethereal.email/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleProviderChange('resend')}
              className={`cursor-pointer ${emailProvider === 'resend' ? 'bg-accent font-medium' : ''}`}
            >
              <div className="flex items-center gap-2 w-full">
                {emailProvider === 'resend' ? <Check className="h-4 w-4" /> : <div className="w-4" />}
                Real mail (enter address)
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
              Email recipient
            </div>
            <div className="px-2 pb-2">
              <Input
                type="email"
                value={demoEmailInput}
                onChange={(e) => setDemoEmailInput(e.target.value)}
                placeholder="Email address..."
                className="h-8 text-xs"
                onKeyDown={(e) => e.stopPropagation()}
              />
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-1.5 h-7 text-xs"
                onClick={handleEmailSave}
              >
                {emailSaved ? 'Saved!' : 'Save'}
              </Button>
              <p className="text-[10px] text-muted-foreground mt-1 truncate">
                {demoEmail ? `Active: ${demoEmail}` : 'No address set'}
              </p>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
