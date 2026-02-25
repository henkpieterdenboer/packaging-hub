'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail } from 'lucide-react'
import { SupplyHubLogo } from '@/components/supply-hub-logo'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useTranslation } from '@/i18n/use-translation'

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t('forgotPassword.failed'))
      } else {
        setIsSuccess(true)
        if (data.etherealUrl) {
          toast.success('Email sent', {
            duration: 15000,
            action: {
              label: 'View email',
              onClick: () => window.open(data.etherealUrl, '_blank'),
            },
          })
        }
      }
    } catch {
      setError(t('forgotPassword.unexpectedError'))
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">{t('forgotPassword.successTitle')}</CardTitle>
            <CardDescription>
              {t('forgotPassword.successMessage')}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="ghost" asChild>
              <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('forgotPassword.backToSignIn')}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2">
            <SupplyHubLogo size={48} />
          </div>
          <CardTitle className="text-2xl">{t('forgotPassword.title')}</CardTitle>
          <CardDescription>
            {t('forgotPassword.description')}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t('forgotPassword.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('forgotPassword.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('forgotPassword.submitting') : t('forgotPassword.submit')}
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('forgotPassword.backToSignIn')}
              </Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
