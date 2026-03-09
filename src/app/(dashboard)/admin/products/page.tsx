'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
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
import { Plus, Pencil, Check, X, ArrowUp, ArrowDown, Download, Upload, Search, AlertTriangle, Tags } from 'lucide-react'
import { toast } from 'sonner'
import { PreferredOrderUnit, PreferredOrderUnitType } from '@/types'
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
  supplier: { id: string; name: string; isActive: boolean }
  productType: { id: string; name: string } | null
  unitsPerBox: number | null
  boxesPerPallet: number | null
  pricePerUnit: number | null
  csrdRequirements: string | null
  remarks: string | null
  isCustom: boolean
  preferredOrderUnit: string | null
  isActive: boolean
  createdAt: string
}

interface ProductFormData {
  name: string
  articleCode: string
  supplierId: string
  productTypeId: string
  unitsPerBox: string
  boxesPerPallet: string
  pricePerUnit: string
  csrdRequirements: string
  remarks: string
  isCustom: boolean
  preferredOrderUnit: string
  isActive: boolean
}

const emptyForm: ProductFormData = {
  name: '',
  articleCode: '',
  supplierId: '',
  productTypeId: '',
  unitsPerBox: '',
  boxesPerPallet: '',
  pricePerUnit: '',
  csrdRequirements: '',
  remarks: '',
  isCustom: false,
  preferredOrderUnit: 'PIECE',
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

  // Filters + sorting
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterType, setFilterType] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<string>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Import
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  // Product type dialog + editing state
  const [typesDialogOpen, setTypesDialogOpen] = useState(false)
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

  // -- Filtered + sorted products -------------------------------------------

  const filteredProducts = useMemo(() => {
    let result = products

    if (filterSupplier) {
      result = result.filter((p) => p.supplierId === filterSupplier)
    }
    if (filterType) {
      result = result.filter((p) => p.productTypeId === filterType)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.articleCode && p.articleCode.toLowerCase().includes(q)),
      )
    }

    return result
  }, [products, filterSupplier, filterType, searchQuery])

  // Products with missing conversion data for their preferred order unit
  const misconfiguredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.isActive) return false
      const unit = p.preferredOrderUnit || 'PIECE'
      if (unit === 'BOX' && !p.unitsPerBox) return true
      if (unit === 'PALLET' && !p.boxesPerPallet) return true
      return false
    })
  }, [products])

  const sortedProducts = useMemo(() => {
    const sorted = [...filteredProducts].sort((a, b) => {
      let aVal: string | number | null
      let bVal: string | number | null

      switch (sortField) {
        case 'articleCode':
          aVal = (a.articleCode || '').toLowerCase()
          bVal = (b.articleCode || '').toLowerCase()
          break
        case 'supplier':
          aVal = a.supplier.name.toLowerCase()
          bVal = b.supplier.name.toLowerCase()
          break
        case 'type':
          aVal = (a.productType?.name || '').toLowerCase()
          bVal = (b.productType?.name || '').toLowerCase()
          break
        case 'unitsPerBox':
          aVal = a.unitsPerBox
          bVal = b.unitsPerBox
          if (aVal === null && bVal === null) return 0
          if (aVal === null) return 1
          if (bVal === null) return -1
          break
        case 'boxesPerPallet':
          aVal = a.boxesPerPallet
          bVal = b.boxesPerPallet
          if (aVal === null && bVal === null) return 0
          if (aVal === null) return 1
          if (bVal === null) return -1
          break
        case 'pricePerUnit':
          aVal = a.pricePerUnit
          bVal = b.pricePerUnit
          if (aVal === null && bVal === null) return 0
          if (aVal === null) return 1
          if (bVal === null) return -1
          break
        case 'name':
        default:
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
          break
      }

      if (aVal === null || bVal === null) return 0
      let comparison = 0
      if (aVal < bVal) comparison = -1
      if (aVal > bVal) comparison = 1
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [filteredProducts, sortField, sortDirection])

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  function renderSortIcon(field: string) {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    )
  }

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
      boxesPerPallet: product.boxesPerPallet?.toString() ?? '',
      pricePerUnit: product.pricePerUnit?.toString() ?? '',
      csrdRequirements: product.csrdRequirements ?? '',
      remarks: product.remarks ?? '',
      isCustom: product.isCustom,
      preferredOrderUnit: product.preferredOrderUnit || 'PIECE',
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
        isCustom: form.isCustom,
        ...(editingId ? { isActive: form.isActive } : {}),
      }

      payload.productTypeId = form.productTypeId || null
      payload.preferredOrderUnit = form.preferredOrderUnit || null

      if (form.unitsPerBox) payload.unitsPerBox = Number(form.unitsPerBox)
      else if (editingId) payload.unitsPerBox = null

      if (form.boxesPerPallet) payload.boxesPerPallet = Number(form.boxesPerPallet)
      else if (editingId) payload.boxesPerPallet = null

      if (form.pricePerUnit) payload.pricePerUnit = Number(form.pricePerUnit)
      else if (editingId) payload.pricePerUnit = null

      if (form.csrdRequirements) payload.csrdRequirements = form.csrdRequirements
      else if (editingId) payload.csrdRequirements = null

      if (form.remarks) payload.remarks = form.remarks
      else if (editingId) payload.remarks = null

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

  // -- Excel Export ----------------------------------------------------------

  async function handleExport() {
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Products')

    sheet.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Article Code', key: 'articleCode', width: 18 },
      { header: 'Supplier', key: 'supplier', width: 25 },
      { header: 'Type', key: 'type', width: 18 },
      { header: 'Units/Box', key: 'unitsPerBox', width: 12 },
      { header: 'Boxes/Pallet', key: 'boxesPerPallet', width: 14 },
      { header: 'Price/Unit', key: 'pricePerUnit', width: 12 },
      { header: 'Remarks', key: 'remarks', width: 30 },
      { header: 'Custom', key: 'isCustom', width: 10 },
      { header: 'Preferred Unit', key: 'preferredOrderUnit', width: 16 },
      { header: 'Status', key: 'status', width: 10 },
    ]

    // Style header
    sheet.getRow(1).font = { bold: true }

    for (const p of sortedProducts) {
      sheet.addRow({
        name: p.name,
        articleCode: p.articleCode,
        supplier: p.supplier.name,
        type: p.productType?.name ?? '',
        unitsPerBox: p.unitsPerBox,
        boxesPerPallet: p.boxesPerPallet,
        pricePerUnit: p.pricePerUnit,
        remarks: p.remarks ?? '',
        isCustom: p.isCustom ? 'Yes' : 'No',
        preferredOrderUnit: p.preferredOrderUnit ?? '',
        status: p.isActive ? 'Active' : 'Inactive',
      })
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `products-${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  // -- Excel Import ----------------------------------------------------------

  async function handleImportFile(file: File) {
    setImporting(true)
    try {
      const ExcelJS = (await import('exceljs')).default
      const workbook = new ExcelJS.Workbook()
      const arrayBuffer = await file.arrayBuffer()
      await workbook.xlsx.load(arrayBuffer)

      const sheet = workbook.worksheets[0]
      if (!sheet) throw new Error('No worksheet found')

      const rows: Record<string, unknown>[] = []
      const headers: string[] = []

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          row.eachCell((cell) => {
            headers.push(String(cell.value || '').trim().toLowerCase())
          })
          return
        }

        const rowData: Record<string, unknown> = {}
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber - 1]
          if (header) rowData[header] = cell.value
        })
        rows.push(rowData)
      })

      if (rows.length === 0) {
        toast.error('No data rows found in the file')
        return
      }

      const res = await fetch('/api/admin/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })

      const body = await res.json()

      if (!res.ok) {
        throw new Error(body?.error ?? 'Import failed')
      }

      if (body.errors?.length > 0) {
        const errorMessages = body.errors.slice(0, 5).map((e: { row: number; message: string }) => `Row ${e.row}: ${e.message}`).join('\n')
        toast.warning(`Imported ${body.imported} products. ${body.errors.length} errors:\n${errorMessages}`, { duration: 10000 })
      } else {
        toast.success(`Successfully imported ${body.imported} products`)
      }

      fetchProducts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDownloadTemplate() {
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Products')

    sheet.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Article Code', key: 'articleCode', width: 18 },
      { header: 'Supplier', key: 'supplier', width: 25 },
      { header: 'Type', key: 'type', width: 18 },
      { header: 'Units/Box', key: 'unitsPerBox', width: 12 },
      { header: 'Boxes/Pallet', key: 'boxesPerPallet', width: 14 },
      { header: 'Price/Unit', key: 'pricePerUnit', width: 12 },
      { header: 'Remarks', key: 'remarks', width: 30 },
      { header: 'Custom', key: 'isCustom', width: 10 },
      { header: 'Preferred Unit', key: 'preferredOrderUnit', width: 16 },
    ]

    sheet.getRow(1).font = { bold: true }

    // Add data validation for supplier/type dropdowns
    // Excel data validation list formula format: '"Item1,Item2,Item3"' (max 255 chars)
    const supplierList = suppliers.map((s) => s.name).join(',')
    const typeList = productTypes.filter((pt) => pt.isActive).map((pt) => pt.name).join(',')

    for (let i = 2; i <= 100; i++) {
      if (supplierList && supplierList.length <= 253) {
        sheet.getCell(`C${i}`).dataValidation = {
          type: 'list',
          formulae: [`"${supplierList}"`],
          showErrorMessage: true,
          errorTitle: 'Invalid Supplier',
          error: 'Please select a valid supplier',
        }
      }
      if (typeList && typeList.length <= 253) {
        sheet.getCell(`D${i}`).dataValidation = {
          type: 'list',
          formulae: [`"${typeList}"`],
          showErrorMessage: true,
          errorTitle: 'Invalid Type',
          error: 'Please select a valid product type',
        }
      }
      sheet.getCell(`I${i}`).dataValidation = {
        type: 'list',
        formulae: ['"Yes,No"'],
      }
      sheet.getCell(`J${i}`).dataValidation = {
        type: 'list',
        formulae: ['"BOX,PALLET"'],
      }
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'products-template.xlsx'
    a.click()
    URL.revokeObjectURL(url)
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('admin.products.title')}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            {t('admin.products.downloadTemplate')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <Upload className="mr-2 h-4 w-4" />
            {importing ? t('admin.products.importing') : t('admin.products.import')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImportFile(file)
            }}
          />
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            {t('admin.products.export')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTypesDialogOpen(true)}>
            <Tags className="mr-2 h-4 w-4" />
            {t('admin.products.productTypes')}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t('admin.products.addProduct')}
          </Button>
        </div>
      </div>

      {/* -- Product Types Dialog ------------------------------------------- */}

      <Dialog open={typesDialogOpen} onOpenChange={setTypesDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.products.productTypes')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Add new type */}
            <div className="flex items-center gap-2">
              <Input
                placeholder={t('admin.products.newTypePlaceholder')}
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddType()
                }}
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
              <div className="divide-y">
                {productTypes.map((type) => (
                  <div
                    key={type.id}
                    className="flex items-center justify-between py-2"
                  >
                    {editingTypeId === type.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editingTypeName}
                          onChange={(e) => setEditingTypeName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateType(type.id)
                            if (e.key === 'Escape') setEditingTypeId(null)
                          }}
                          className="h-8"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => handleUpdateType(type.id)}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => setEditingTypeId(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
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
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
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
                            className="h-8 w-8"
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
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* -- Filters -------------------------------------------------------- */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="w-full sm:w-48">
          <Label className="mb-1.5">{t('common.supplier')}</Label>
          <Select
            value={filterSupplier || 'all'}
            onValueChange={(v) => setFilterSupplier(v === 'all' ? '' : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('common.allSuppliers')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.allSuppliers')}</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-48">
          <Label className="mb-1.5">{t('common.productType')}</Label>
          <Select
            value={filterType || 'all'}
            onValueChange={(v) => setFilterType(v === 'all' ? '' : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('common.allTypes')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.allTypes')}</SelectItem>
              {activeProductTypes.map((pt) => (
                <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative w-full sm:w-64">
          <Label className="mb-1.5">{t('common.search')}</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder={t('products.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* -- Warnings -------------------------------------------------------- */}

      {misconfiguredProducts.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">
                {t('admin.products.missingDataWarning', { count: misconfiguredProducts.length })}
              </p>
              <ul className="mt-2 space-y-1">
                {misconfiguredProducts.map((p) => {
                  const unit = p.preferredOrderUnit || 'PIECE'
                  const missing = unit === 'BOX' ? t('admin.products.unitsPerBox') : t('admin.products.boxesPerPallet')
                  return (
                    <li key={p.id} className="text-sm text-amber-700">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-amber-600"> — {t('admin.products.missingField', { unit: t(`labels.units.${unit}`), field: missing })}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* -- Products Table ------------------------------------------------- */}

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.products.subtitle')} ({sortedProducts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-muted-foreground">
              {t('common.loading')}
            </p>
          ) : sortedProducts.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {t('admin.products.noProducts')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort('name')}>
                      {t('admin.products.name')}{renderSortIcon('name')}
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort('articleCode')}>
                      {t('admin.products.articleCode')}{renderSortIcon('articleCode')}
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort('supplier')}>
                      {t('admin.products.supplier')}{renderSortIcon('supplier')}
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort('type')}>
                      {t('admin.products.type')}{renderSortIcon('type')}
                    </TableHead>
                    <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort('unitsPerBox')}>
                      {t('admin.products.unitsPerBox')}{renderSortIcon('unitsPerBox')}
                    </TableHead>
                    <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort('boxesPerPallet')}>
                      {t('admin.products.boxesPerPallet')}{renderSortIcon('boxesPerPallet')}
                    </TableHead>
                    <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort('pricePerUnit')}>
                      {t('admin.products.pricePerUnit')}{renderSortIcon('pricePerUnit')}
                    </TableHead>
                    <TableHead>{t('admin.products.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProducts.map((product) => (
                    <TableRow
                      key={product.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openEdit(product)}
                    >
                      <TableCell className="font-medium">
                        {product.name}
                        {product.isCustom && (
                          <Badge variant="outline" className="ml-2 text-xs">Custom</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {displayValue(product.articleCode)}
                      </TableCell>
                      <TableCell className={!product.supplier.isActive ? 'text-gray-400 line-through' : ''}>
                        {product.supplier.name}
                      </TableCell>
                      <TableCell>
                        {product.productType?.name ?? '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {displayValue(product.unitsPerBox)}
                      </TableCell>
                      <TableCell className="text-right">
                        {displayValue(product.boxesPerPallet)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPrice(product.pricePerUnit)}
                      </TableCell>
                      <TableCell>
                        {!product.isActive ? (
                          <Badge variant="destructive">
                            {t('admin.products.inactive')}
                          </Badge>
                        ) : !product.supplier.isActive ? (
                          <Badge className="bg-amber-100 text-amber-800">
                            {t('admin.products.supplierInactive')}
                          </Badge>
                        ) : (
                          <Badge variant="default">
                            {t('admin.products.active')}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* -- Dialog --------------------------------------------------------- */}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
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

            {/* Units per Box & Boxes per Pallet */}
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
                <Label htmlFor="boxesPerPallet">{t('admin.products.boxesPerPalletLabel')}</Label>
                <Input
                  id="boxesPerPallet"
                  type="number"
                  min="0"
                  value={form.boxesPerPallet}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      boxesPerPallet: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* Calculated prices */}
            {form.pricePerUnit && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground space-y-1">
                {form.unitsPerBox && (
                  <div className="flex justify-between">
                    <span>{t('admin.products.pricePerBox')}</span>
                    <span className="font-medium">{(Number(form.pricePerUnit) * Number(form.unitsPerBox)).toFixed(2)}</span>
                  </div>
                )}
                {form.unitsPerBox && form.boxesPerPallet && (
                  <div className="flex justify-between">
                    <span>{t('admin.products.pricePerPallet')}</span>
                    <span className="font-medium">{(Number(form.pricePerUnit) * Number(form.unitsPerBox) * Number(form.boxesPerPallet)).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Price per Unit & Preferred Order Unit */}
            <div className="grid grid-cols-2 gap-4">
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
              <div className="grid gap-2">
                <Label htmlFor="preferredOrderUnit">{t('admin.products.preferredOrderUnitLabel')}</Label>
                <Select
                  value={form.preferredOrderUnit || 'PIECE'}
                  onValueChange={(value: string) =>
                    setForm((prev) => ({
                      ...prev,
                      preferredOrderUnit: value,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('admin.products.preferredOrderUnitPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.values(PreferredOrderUnit) as PreferredOrderUnitType[]).map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {t(`labels.units.${unit}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                rows={2}
              />
            </div>

            {/* Remarks */}
            <div className="grid gap-2">
              <Label htmlFor="remarks">{t('admin.products.remarksLabel')}</Label>
              <Textarea
                id="remarks"
                value={form.remarks}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    remarks: e.target.value,
                  }))
                }
                rows={2}
              />
            </div>

            {/* Custom product checkbox */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="isCustom"
                checked={form.isCustom}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({
                    ...prev,
                    isCustom: checked === true,
                  }))
                }
              />
              <Label htmlFor="isCustom">{t('admin.products.isCustomLabel')}</Label>
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
