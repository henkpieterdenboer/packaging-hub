'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useTranslation } from '@/i18n/use-translation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Language, LanguageLabels, type LanguageType } from '@/types'

export default function SettingsPage() {
  const { data: session } = useSession()
  const { t, language, setLanguage } = useTranslation()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.details) {
          const messages = Object.values(data.details).flat() as string[]
          toast.error(messages[0] || t('settings.validationFailed'))
        } else {
          toast.error(data.error || t('settings.changePasswordFailed'))
        }
        return
      }

      toast.success(t('settings.passwordChanged'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
    } catch {
      toast.error(t('settings.unexpectedError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
          {t('settings.title')}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {t('settings.subtitle')}
        </p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* Profile Info */}
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.profileInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1">
              <Label className="text-sm text-muted-foreground">{t('settings.name')}</Label>
              <p className="text-sm font-medium">
                {session?.user?.name || '-'}
              </p>
            </div>
            <div className="grid gap-1">
              <Label className="text-sm text-muted-foreground">{t('settings.email')}</Label>
              <p className="text-sm font-medium">
                {session?.user?.email || '-'}
              </p>
            </div>
            <div className="grid gap-1">
              <Label className="text-sm text-muted-foreground">{t('settings.roles')}</Label>
              <div className="flex gap-2">
                {session?.user?.roles?.map((role) => (
                  <Badge key={role} variant="secondary">
                    {t(`labels.roles.${role}`)}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid gap-1">
              <Label className="text-sm text-muted-foreground">{t('settings.language')}</Label>
              <Select
                value={language}
                onValueChange={(value) => setLanguage(value as LanguageType)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(Language).map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {LanguageLabels[lang]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.changePassword')}</CardTitle>
          </CardHeader>
          <form onSubmit={handleChangePassword}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">{t('settings.currentPassword')}</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder={t('settings.currentPasswordPlaceholder')}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t('settings.newPassword')}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder={t('settings.newPasswordPlaceholder')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">{t('settings.confirmNewPassword')}</Label>
                <Input
                  id="confirmNewPassword"
                  type="password"
                  placeholder={t('settings.confirmNewPasswordPlaceholder')}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
              </div>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('settings.changingPassword')}
                  </>
                ) : (
                  t('settings.changePasswordButton')
                )}
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  )
}
