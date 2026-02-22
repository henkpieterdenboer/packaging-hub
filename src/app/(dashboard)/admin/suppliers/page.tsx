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
  ArticleGroupLabels,
  ArticleGroupType,
} from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Supplier {
  id: string
  name: string
  email: string
  ccEmails: string[]
  articleGroup: string
  isActive: boolean
  createdAt: string
  _count?: { products: number }
}

interface SupplierFormData {
  name: string
  email: string
  ccEmails: string
  articleGroup: ArticleGroupType | ''
  isActive: boolean
}

const emptyForm: SupplierFormData = {
  name: '',
  email: '',
  ccEmails: '',
  articleGroup: '',
  isActive: true,
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SupplierFormData>(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  // ── Fetch ----------------------------------------------------------------

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/suppliers')
      if (!res.ok) throw new Error('Failed to fetch suppliers')
      const data: Supplier[] = await res.json()
      setSuppliers(data)
    } catch {
      toast.error('Could not load suppliers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  // ── Dialog helpers -------------------------------------------------------

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
      isActive: sup.isActive,
    })
    setDialogOpen(true)
  }

  // ── Submit ---------------------------------------------------------------

  async function handleSubmit() {
    if (!form.name || !form.email || !form.articleGroup) {
      toast.error('Please fill in all required fields')
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

      toast.success(editingId ? 'Supplier updated' : 'Supplier created')
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

  // ── Render ---------------------------------------------------------------

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Supplier Management
        </h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Suppliers</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-muted-foreground">
              Loading...
            </p>
          ) : suppliers.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No suppliers found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Article Group</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((sup) => (
                  <TableRow key={sup.id}>
                    <TableCell className="font-medium">{sup.name}</TableCell>
                    <TableCell>{sup.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {ArticleGroupLabels[
                          sup.articleGroup as ArticleGroupType
                        ] ?? sup.articleGroup}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {sup._count?.products ?? 0}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={sup.isActive ? 'default' : 'destructive'}
                      >
                        {sup.isActive ? 'Active' : 'Inactive'}
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

      {/* ── Dialog ─────────────────────────────────────────────────────── */}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Supplier' : 'Add Supplier'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
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
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="supplier@example.com"
              />
            </div>

            {/* CC Emails */}
            <div className="grid gap-2">
              <Label htmlFor="ccEmails">CC Emails</Label>
              <Input
                id="ccEmails"
                value={form.ccEmails}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, ccEmails: e.target.value }))
                }
                placeholder="cc1@example.com, cc2@example.com"
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple addresses with commas
              </p>
            </div>

            {/* Article Group */}
            <div className="grid gap-2">
              <Label htmlFor="articleGroup">Article Group *</Label>
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
                  <SelectValue placeholder="Select article group" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ArticleGroup) as ArticleGroupType[]).map(
                    (group) => (
                      <SelectItem key={group} value={group}>
                        {ArticleGroupLabels[group]}
                      </SelectItem>
                    ),
                  )}
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
                <Label htmlFor="isActive">Active</Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting
                ? 'Saving...'
                : editingId
                  ? 'Update'
                  : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
