'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { SupplyHubLogo } from '@/components/supply-hub-logo'
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

export default function ActivatePage() {
  const params = useParams<{ token: string }>()
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError(t('activate.passwordMismatch'))
      return
    }

    if (password.length < 8) {
      setError(t('activate.passwordTooShort'))
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: params.token, password, confirmPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t('activate.failed'))
      } else {
        setIsSuccess(true)
      }
    } catch {
      setError(t('auth.unexpectedError'))
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl">{t('activate.successTitle')}</CardTitle>
            <CardDescription>
              {t('activate.successMessage')}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button asChild>
              <Link href="/login">{t('activate.goToSignIn')}</Link>
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
          <CardTitle className="text-2xl">{t('activate.title')}</CardTitle>
          <CardDescription>
            {t('activate.description')}
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
              <Label htmlFor="password">{t('activate.password')}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t('activate.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                {t('activate.passwordHint')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('activate.confirmPassword')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t('activate.confirmPlaceholder')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('activate.submitting') : t('activate.submit')}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
