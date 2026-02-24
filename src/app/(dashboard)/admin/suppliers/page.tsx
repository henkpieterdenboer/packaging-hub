'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import {
  ArticleGroup,
  ArticleGroupType,
  Language,
  LanguageLabels,
  type LanguageType,
} from '@/types'
import { useTranslation } from '@/i18n/use-translation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Supplier {
  id: string
  name: string
  email: string
  ccEmails: string[]
  articleGroup: string
  language: string
  isActive: boolean
  createdAt: string
  _count?: { products: number }
}

interface SupplierFormData {
  name: string
  email: string
  ccEmails: string
  articleGroup: ArticleGroupType | ''
  language: LanguageType
  isActive: boolean
}

const emptyForm: SupplierFormData = {
  name: '',
  email: '',
  ccEmails: '',
  articleGroup: '',
  language: 'en',
  isActive: true,
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SuppliersPage() {
  const { t } = useTranslation()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SupplierFormData>(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  // -- Fetch ----------------------------------------------------------------

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/suppliers')
      if (!res.ok) throw new Error('Failed to fetch suppliers')
      const data: Supplier[] = await res.json()
      setSuppliers(data)
    } catch {
      toast.error(t('admin.suppliers.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  // -- Dialog helpers -------------------------------------------------------

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(sup: Supplier) {
    setEditingId(sup.id)
    setForm({
      name: sup.name,
      email: sup.email,
      ccEmails: sup.ccEmails.join(', '),
      articleGroup: sup.articleGroup as ArticleGroupType,
      language: (sup.language || 'en') as LanguageType,
      isActive: sup.isActive,
    })
    setDialogOpen(true)
  }

  // -- Submit ---------------------------------------------------------------

  async function handleSubmit() {
    if (!form.name || !form.email || !form.articleGroup) {
      toast.error(t('admin.suppliers.requiredFields'))
      return
    }

    setSubmitting(true)

    try {
      const ccEmails = form.ccEmails
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)

      const payload = {
        name: form.name,
        email: form.email,
        ccEmails,
        articleGroup: form.articleGroup,
        language: form.language,
        ...(editingId ? { isActive: form.isActive } : {}),
      }

      const url = editingId
        ? `/api/admin/suppliers/${editingId}`
        : '/api/admin/suppliers'

      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Request failed')
      }

      toast.success(editingId ? t('admin.suppliers.updated') : t('admin.suppliers.created'))
      setDialogOpen(false)
      fetchSuppliers()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Something went wrong',
      )
    } finally {
      setSubmitting(false)
    }
  }

  // -- Render ---------------------------------------------------------------

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('admin.suppliers.title')}
        </h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('admin.suppliers.addSupplier')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.suppliers.subtitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-muted-foreground">
              {t('common.loading')}
            </p>
          ) : suppliers.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {t('admin.suppliers.noSuppliers')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.suppliers.name')}</TableHead>
                  <TableHead>{t('admin.suppliers.email')}</TableHead>
                  <TableHead>{t('admin.suppliers.articleGroup')}</TableHead>
                  <TableHead className="text-right">{t('admin.suppliers.products')}</TableHead>
                  <TableHead>{t('admin.suppliers.status')}</TableHead>
                  <TableHead className="w-[80px]">{t('admin.suppliers.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((sup) => (
                  <TableRow key={sup.id}>
                    <TableCell className="font-medium">{sup.name}</TableCell>
                    <TableCell>{sup.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {t(`labels.articleGroups.${sup.articleGroup}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {sup._count?.products ?? 0}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={sup.isActive ? 'default' : 'destructive'}
                      >
                        {sup.isActive ? t('admin.suppliers.active') : t('admin.suppliers.inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(sup)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* -- Dialog --------------------------------------------------------- */}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('admin.suppliers.editTitle') : t('admin.suppliers.addTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">{t('admin.suppliers.nameLabel')}</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="email">{t('admin.suppliers.emailLabel')}</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder={t('admin.suppliers.emailPlaceholder')}
              />
            </div>

            {/* CC Emails */}
            <div className="grid gap-2">
              <Label htmlFor="ccEmails">{t('admin.suppliers.ccEmails')}</Label>
              <Input
                id="ccEmails"
                value={form.ccEmails}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, ccEmails: e.target.value }))
                }
                placeholder={t('admin.suppliers.ccEmailsPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('admin.suppliers.ccEmailsHint')}
              </p>
            </div>

            {/* Article Group */}
            <div className="grid gap-2">
              <Label htmlFor="articleGroup">{t('admin.suppliers.articleGroupLabel')}</Label>
              <Select
                value={form.articleGroup}
                onValueChange={(value: string) =>
                  setForm((prev) => ({
                    ...prev,
                    articleGroup: value as ArticleGroupType,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('admin.suppliers.articleGroupPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ArticleGroup) as ArticleGroupType[]).map(
                    (group) => (
                      <SelectItem key={group} value={group}>
                        {t(`labels.articleGroups.${group}`)}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Communication Language */}
            <div className="grid gap-2">
              <Label htmlFor="language">{t('admin.suppliers.languageLabel')}</Label>
              <Select
                value={form.language}
                onValueChange={(value: string) =>
                  setForm((prev) => ({
                    ...prev,
                    language: value as LanguageType,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.values(Language) as LanguageType[]).map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {LanguageLabels[lang]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active toggle (edit only) */}
            {editingId && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isActive"
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      isActive: checked === true,
                    }))
                  }
                />
                <Label htmlFor="isActive">{t('admin.suppliers.activeLabel')}</Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              {t('admin.suppliers.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting
                ? t('admin.suppliers.saving')
                : editingId
                  ? t('admin.suppliers.update')
                  : t('admin.suppliers.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
