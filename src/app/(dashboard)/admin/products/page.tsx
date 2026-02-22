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
import { Plus, Pencil } from 'lucide-react'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Supplier {
  id: string
  name: string
  isActive: boolean
}

interface Product {
  id: string
  name: string
  articleCode: string | null
  supplierId: string
  supplier: { id: string; name: string }
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
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductFormData>(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  // ── Fetch ----------------------------------------------------------------

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/products')
      if (!res.ok) throw new Error('Failed to fetch products')
      const data: Product[] = await res.json()
      setProducts(data)
    } catch {
      toast.error('Could not load products')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/suppliers')
      if (!res.ok) throw new Error('Failed to fetch suppliers')
      const data: Supplier[] = await res.json()
      setSuppliers(data.filter((s) => s.isActive))
    } catch {
      toast.error('Could not load suppliers')
    }
  }, [])

  useEffect(() => {
    fetchProducts()
    fetchSuppliers()
  }, [fetchProducts, fetchSuppliers])

  // ── Dialog helpers -------------------------------------------------------

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
      unitsPerBox: product.unitsPerBox?.toString() ?? '',
      unitsPerPallet: product.unitsPerPallet?.toString() ?? '',
      pricePerUnit: product.pricePerUnit?.toString() ?? '',
      csrdRequirements: product.csrdRequirements ?? '',
      isActive: product.isActive,
    })
    setDialogOpen(true)
  }

  // ── Submit ---------------------------------------------------------------

  async function handleSubmit() {
    if (!form.name || !form.supplierId) {
      toast.error('Please fill in all required fields')
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        name: form.name,
        articleCode: form.articleCode || null,
        supplierId: form.supplierId,
        unitsPerBox: form.unitsPerBox ? Number(form.unitsPerBox) : null,
        unitsPerPallet: form.unitsPerPallet
          ? Number(form.unitsPerPallet)
          : null,
        pricePerUnit: form.pricePerUnit ? Number(form.pricePerUnit) : null,
        csrdRequirements: form.csrdRequirements || null,
        ...(editingId ? { isActive: form.isActive } : {}),
      }

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
        throw new Error(body?.error ?? 'Request failed')
      }

      toast.success(editingId ? 'Product updated' : 'Product created')
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

  // ── Formatting -----------------------------------------------------------

  function formatPrice(value: number | null): string {
    if (value == null) return '-'
    return value.toFixed(2)
  }

  function displayValue(value: string | number | null): string {
    if (value == null || value === '') return '-'
    return String(value)
  }

  // ── Render ---------------------------------------------------------------

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Product Management
        </h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-muted-foreground">
              Loading...
            </p>
          ) : products.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No products found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Article Code</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Units/Box</TableHead>
                  <TableHead className="text-right">Units/Pallet</TableHead>
                  <TableHead className="text-right">Price/Unit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
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
                        {product.isActive ? 'Active' : 'Inactive'}
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

      {/* ── Dialog ─────────────────────────────────────────────────────── */}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Product' : 'Add Product'}
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

            {/* Article Code */}
            <div className="grid gap-2">
              <Label htmlFor="articleCode">Article Code</Label>
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
              <Label htmlFor="supplierId">Supplier *</Label>
              <Select
                value={form.supplierId}
                onValueChange={(value: string) =>
                  setForm((prev) => ({ ...prev, supplierId: value }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select supplier" />
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

            {/* Units per Box & Units per Pallet */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="unitsPerBox">Units per Box</Label>
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
                <Label htmlFor="unitsPerPallet">Units per Pallet</Label>
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
              <Label htmlFor="pricePerUnit">Price per Unit</Label>
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
              <Label htmlFor="csrdRequirements">CSRD Requirements</Label>
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
