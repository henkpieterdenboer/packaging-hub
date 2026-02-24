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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/i18n/use-translation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Supplier {
  id: string
  name: string
  isActive: boolean
}

interface ProductType {
  id: string
  name: string
  isActive: boolean
}

interface Product {
  id: string
  name: string
  articleCode: string | null
  supplierId: string
  productTypeId: string | null
  supplier: { id: string; name: string }
  productType: { id: string; name: string } | null
  unitsPerBox: number | null
  unitsPerPallet: number | null
  pricePerUnit: number | null
  csrdRequirements: string | null
  isActive: boolean
  createdAt: string
}

interface ProductFormData {
  name: string
  articleCode: string
  supplierId: string
  productTypeId: string
  unitsPerBox: string
  unitsPerPallet: string
  pricePerUnit: string
  csrdRequirements: string
  isActive: boolean
}

const emptyForm: ProductFormData = {
  name: '',
  articleCode: '',
  supplierId: '',
  productTypeId: '',
  unitsPerBox: '',
  unitsPerPallet: '',
  pricePerUnit: '',
  csrdRequirements: '',
  isActive: true,
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProductsPage() {
  const { t } = useTranslation()
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductFormData>(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  // Product type inline editing state
  const [newTypeName, setNewTypeName] = useState('')
  const [addingType, setAddingType] = useState(false)
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null)
  const [editingTypeName, setEditingTypeName] = useState('')

  // -- Fetch ----------------------------------------------------------------

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/products')
      if (!res.ok) throw new Error('Failed to fetch products')
      const data: Product[] = await res.json()
      setProducts(data)
    } catch {
      toast.error(t('admin.products.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/suppliers')
      if (!res.ok) throw new Error('Failed to fetch suppliers')
      const data: Supplier[] = await res.json()
      setSuppliers(data.filter((s) => s.isActive))
    } catch {
      toast.error(t('admin.products.loadSuppliersError'))
    }
  }, [t])

  const fetchProductTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/product-types')
      if (!res.ok) throw new Error('Failed to fetch product types')
      const data: ProductType[] = await res.json()
      setProductTypes(data)
    } catch {
      toast.error(t('admin.products.loadTypesError'))
    }
  }, [t])

  useEffect(() => {
    fetchProducts()
    fetchSuppliers()
    fetchProductTypes()
  }, [fetchProducts, fetchSuppliers, fetchProductTypes])

  // -- Product Type handlers ------------------------------------------------

  async function handleAddType() {
    if (!newTypeName.trim()) return

    setAddingType(true)
    try {
      const res = await fetch('/api/admin/product-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTypeName.trim() }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Request failed')
      }

      toast.success(t('admin.products.typeCreated'))
      setNewTypeName('')
      fetchProductTypes()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Something went wrong',
      )
    } finally {
      setAddingType(false)
    }
  }

  async function handleUpdateType(id: string) {
    if (!editingTypeName.trim()) return

    try {
      const res = await fetch(`/api/admin/product-types/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingTypeName.trim() }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Request failed')
      }

      toast.success(t('admin.products.typeUpdated'))
      setEditingTypeId(null)
      fetchProductTypes()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Something went wrong',
      )
    }
  }

  async function handleToggleType(id: string, currentActive: boolean) {
    try {
      const res = await fetch(`/api/admin/product-types/${id}`, {
        method: currentActive ? 'DELETE' : 'PATCH',
        ...(currentActive
          ? {}
          : {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isActive: true }),
            }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Request failed')
      }

      toast.success(
        currentActive ? t('admin.products.typeDeactivated') : t('admin.products.typeActivated'),
      )
      fetchProductTypes()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Something went wrong',
      )
    }
  }

  // -- Dialog helpers -------------------------------------------------------

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(product: Product) {
    setEditingId(product.id)
    setForm({
      name: product.name,
      articleCode: product.articleCode ?? '',
      supplierId: product.supplierId,
      productTypeId: product.productTypeId ?? '',
      unitsPerBox: product.unitsPerBox?.toString() ?? '',
      unitsPerPallet: product.unitsPerPallet?.toString() ?? '',
      pricePerUnit: product.pricePerUnit?.toString() ?? '',
      csrdRequirements: product.csrdRequirements ?? '',
      isActive: product.isActive,
    })
    setDialogOpen(true)
  }

  // -- Submit ---------------------------------------------------------------

  async function handleSubmit() {
    if (!form.name || !form.articleCode || !form.supplierId) {
      toast.error(t('admin.products.requiredFields'))
      return
    }

    setSubmitting(true)

    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        articleCode: form.articleCode,
        supplierId: form.supplierId,
        ...(editingId ? { isActive: form.isActive } : {}),
      }

      // productTypeId: always send (null to clear, string to set)
      payload.productTypeId = form.productTypeId || null

      // Optional fields: only include when filled in, or null when editing (to allow clearing)
      if (form.unitsPerBox) payload.unitsPerBox = Number(form.unitsPerBox)
      else if (editingId) payload.unitsPerBox = null

      if (form.unitsPerPallet) payload.unitsPerPallet = Number(form.unitsPerPallet)
      else if (editingId) payload.unitsPerPallet = null

      if (form.pricePerUnit) payload.pricePerUnit = Number(form.pricePerUnit)
      else if (editingId) payload.pricePerUnit = null

      if (form.csrdRequirements) payload.csrdRequirements = form.csrdRequirements
      else if (editingId) payload.csrdRequirements = null

      const url = editingId
        ? `/api/admin/products/${editingId}`
        : '/api/admin/products'

      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const details = body?.details
        if (details && typeof details === 'object') {
          const fields = Object.entries(details)
            .map(([key, msgs]) => `${key}: ${(msgs as string[]).join(', ')}`)
            .join('; ')
          throw new Error(fields)
        }
        throw new Error(body?.error ?? 'Request failed')
      }

      toast.success(editingId ? t('admin.products.updated') : t('admin.products.created'))
      setDialogOpen(false)
      fetchProducts()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Something went wrong',
      )
    } finally {
      setSubmitting(false)
    }
  }

  // -- Formatting -----------------------------------------------------------

  function formatPrice(value: number | null): string {
    if (value == null) return '-'
    return value.toFixed(2)
  }

  function displayValue(value: string | number | null): string {
    if (value == null || value === '') return '-'
    return String(value)
  }

  const activeProductTypes = productTypes.filter((pt) => pt.isActive)

  // -- Render ---------------------------------------------------------------

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('admin.products.title')}
        </h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('admin.products.addProduct')}
        </Button>
      </div>

      {/* -- Product Types -------------------------------------------------- */}

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.products.productTypes')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Add new type */}
            <div className="flex items-center gap-2">
              <Input
                placeholder={t('admin.products.newTypePlaceholder')}
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddType()
                }}
                className="max-w-xs"
              />
              <Button
                size="sm"
                onClick={handleAddType}
                disabled={addingType || !newTypeName.trim()}
              >
                <Plus className="mr-1 h-4 w-4" />
                {t('admin.products.add')}
              </Button>
            </div>

            {/* Type list */}
            {productTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('admin.products.noTypes')}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {productTypes.map((type) => (
                  <div
                    key={type.id}
                    className="flex items-center gap-1.5 rounded-md border px-3 py-1.5"
                  >
                    {editingTypeId === type.id ? (
                      <>
                        <Input
                          value={editingTypeName}
                          onChange={(e) => setEditingTypeName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateType(type.id)
                            if (e.key === 'Escape') setEditingTypeId(null)
                          }}
                          className="h-7 w-32"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleUpdateType(type.id)}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setEditingTypeId(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span
                          className={
                            type.isActive
                              ? 'text-sm'
                              : 'text-sm text-muted-foreground line-through'
                          }
                        >
                          {type.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingTypeId(type.id)
                            setEditingTypeName(type.name)
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            handleToggleType(type.id, type.isActive)
                          }
                        >
                          {type.isActive ? (
                            <X className="h-3 w-3" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* -- Products Table ------------------------------------------------- */}

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.products.subtitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-muted-foreground">
              {t('common.loading')}
            </p>
          ) : products.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {t('admin.products.noProducts')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.products.name')}</TableHead>
                  <TableHead>{t('admin.products.articleCode')}</TableHead>
                  <TableHead>{t('admin.products.supplier')}</TableHead>
                  <TableHead>{t('admin.products.type')}</TableHead>
                  <TableHead className="text-right">{t('admin.products.unitsPerBox')}</TableHead>
                  <TableHead className="text-right">{t('admin.products.unitsPerPallet')}</TableHead>
                  <TableHead className="text-right">{t('admin.products.pricePerUnit')}</TableHead>
                  <TableHead>{t('admin.products.status')}</TableHead>
                  <TableHead className="w-[80px]">{t('admin.products.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      {product.name}
                    </TableCell>
                    <TableCell>
                      {displayValue(product.articleCode)}
                    </TableCell>
                    <TableCell>{product.supplier.name}</TableCell>
                    <TableCell>
                      {product.productType?.name ?? '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {displayValue(product.unitsPerBox)}
                    </TableCell>
                    <TableCell className="text-right">
                      {displayValue(product.unitsPerPallet)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPrice(product.pricePerUnit)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          product.isActive ? 'default' : 'destructive'
                        }
                      >
                        {product.isActive ? t('admin.products.active') : t('admin.products.inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(product)}
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
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('admin.products.editTitle') : t('admin.products.addTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">{t('admin.products.nameLabel')}</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            {/* Article Code */}
            <div className="grid gap-2">
              <Label htmlFor="articleCode">{t('admin.products.articleCodeLabel')}</Label>
              <Input
                id="articleCode"
                value={form.articleCode}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    articleCode: e.target.value,
                  }))
                }
              />
            </div>

            {/* Supplier */}
            <div className="grid gap-2">
              <Label htmlFor="supplierId">{t('admin.products.supplierLabel')}</Label>
              <Select
                value={form.supplierId}
                onValueChange={(value: string) =>
                  setForm((prev) => ({ ...prev, supplierId: value }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('admin.products.supplierPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((sup) => (
                    <SelectItem key={sup.id} value={sup.id}>
                      {sup.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Product Type */}
            <div className="grid gap-2">
              <Label htmlFor="productTypeId">{t('admin.products.typeLabel')}</Label>
              <Select
                value={form.productTypeId || 'none'}
                onValueChange={(value: string) =>
                  setForm((prev) => ({
                    ...prev,
                    productTypeId: value === 'none' ? '' : value,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('admin.products.typePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('admin.products.none')}</SelectItem>
                  {activeProductTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Units per Box & Units per Pallet */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="unitsPerBox">{t('admin.products.unitsPerBoxLabel')}</Label>
                <Input
                  id="unitsPerBox"
                  type="number"
                  min="0"
                  value={form.unitsPerBox}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      unitsPerBox: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unitsPerPallet">{t('admin.products.unitsPerPalletLabel')}</Label>
                <Input
                  id="unitsPerPallet"
                  type="number"
                  min="0"
                  value={form.unitsPerPallet}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      unitsPerPallet: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* Price per Unit */}
            <div className="grid gap-2">
              <Label htmlFor="pricePerUnit">{t('admin.products.pricePerUnitLabel')}</Label>
              <Input
                id="pricePerUnit"
                type="number"
                min="0"
                step="0.01"
                value={form.pricePerUnit}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    pricePerUnit: e.target.value,
                  }))
                }
              />
            </div>

            {/* CSRD Requirements */}
            <div className="grid gap-2">
              <Label htmlFor="csrdRequirements">{t('admin.products.csrdLabel')}</Label>
              <Textarea
                id="csrdRequirements"
                value={form.csrdRequirements}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    csrdRequirements: e.target.value,
                  }))
                }
                rows={3}
              />
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
                <Label htmlFor="isActive">{t('admin.products.activeLabel')}</Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              {t('admin.products.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting
                ? t('admin.products.saving')
                : editingId
                  ? t('admin.products.update')
                  : t('admin.products.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
