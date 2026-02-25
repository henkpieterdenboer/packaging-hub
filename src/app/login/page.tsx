'use client'

import { useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Package } from 'lucide-react'
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
import { LanguageSwitcher } from '@/i18n/language-switcher'

export default function LoginPage() {
  const router = useRouter()
  const { status } = useSession()
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Redirect if already authenticated
  if (status === 'authenticated') {
    router.push('/dashboard')
    return null
  }

  // Show loading while checking session
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email: email.toLowerCase().trim(),
        password,
      })

      if (result?.error) {
        setError(t('auth.invalidCredentials'))
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError(t('auth.unexpectedError'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="relative text-center">
          <div className="absolute right-4 top-4">
            <LanguageSwitcher variant="auth" />
          </div>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <Package className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">{t('nav.appTitle')}</CardTitle>
          <CardDescription>{t('auth.signInTitle')}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
            <Link
              href="/forgot-password"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {t('auth.forgotPassword')}
            </Link>
          </CardFooter>
        </form>
        {process.env.NEXT_PUBLIC_TEST_MODE === 'true' && (
          <div className="border-t px-6 py-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('auth.demoAccounts')}</p>
            <div className="space-y-1.5 text-sm">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted transition-colors text-left"
                onClick={() => { setEmail('admin@example.com'); setPassword('Welkom01') }}
              >
                <span className="font-medium">{t('auth.demoAdmin')}</span>
                <span className="text-muted-foreground">admin@example.com</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted transition-colors text-left"
                onClick={() => { setEmail('employee@example.com'); setPassword('Welkom02') }}
              >
                <span className="font-medium">{t('auth.demoEmployee')}</span>
                <span className="text-muted-foreground">employee@example.com</span>
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
