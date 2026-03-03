'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/lib/cart-context'
import { useTranslation } from '@/i18n/use-translation'
import { localeMap } from '@/i18n'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Package,
  Search,
  ArrowUp,
  ArrowDown,
  ShoppingCart,
} from 'lucide-react'

interface Supplier {
  id: string
  name: string
}

interface ProductType {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  articleCode: string
  supplierId: string
  unitsPerBox: number | null
  boxesPerPallet: number | null
  pricePerUnit: number | null
  preferredOrderUnit: string | null
  supplier: { id: string; name: string }
  productType: { id: string; name: string } | null
}

export default function NewOrderPage() {
  const { status } = useSession()
  const router = useRouter()
  const { t, language } = useTranslation()
  const { addItem, totalItems } = useCart()

  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [productTypes, setProductTypes] = useState<ProductType[]>([])

  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [selectedProductTypeId, setSelectedProductTypeId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortField, setSortField] = useState('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Per-product quantity and unit overrides (only stored when user changes from defaults)
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({})
  const [unitOverrides, setUnitOverrides] = useState<Record<string, string>>({})

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    async function fetchData() {
      try {
        const [suppRes, typeRes] = await Promise.all([
          fetch('/api/suppliers'),
          fetch('/api/product-types'),
        ])
        if (suppRes.ok) setSuppliers(await suppRes.json())
        if (typeRes.ok) setProductTypes(await typeRes.json())
      } catch (err) {
        console.error('Failed to fetch data:', err)
      }
    }
    if (status === 'authenticated') fetchData()
  }, [status])

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (selectedSupplierId) params.set('supplierId', selectedSupplierId)
        if (selectedProductTypeId)
          params.set('productTypeId', selectedProductTypeId)
        const query = params.toString()
        const url = query ? `/api/products?${query}` : '/api/products'
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch products')
        setProducts(await res.json())
      } catch (err) {
        setError('Failed to load products. Please try again.')
        console.error('Failed to fetch products:', err)
      } finally {
        setLoading(false)
      }
    }
    if (status === 'authenticated') fetchProducts()
  }, [status, selectedSupplierId, selectedProductTypeId])

  // Derive qty/unit for a product (override or defaults)
  function getQty(productId: string): number {
    return qtyOverrides[productId] ?? 1
  }

  function getUnit(product: Product): string {
    const override = unitOverrides[product.id]
    if (override) return override
    const pref = product.preferredOrderUnit ?? 'PIECE'
    // Fall back to PIECE if conversion data is missing
    if (pref === 'BOX' && !product.unitsPerBox) return 'PIECE'
    if (pref === 'PALLET' && !product.boxesPerPallet) return 'PIECE'
    return pref
  }

  // Filtering
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products
    const q = searchQuery.toLowerCase()
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.articleCode.toLowerCase().includes(q),
    )
  }, [products, searchQuery])

  // Sorting
  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      let aVal: string | number | null
      let bVal: string | number | null

      switch (sortField) {
        case 'articleCode':
          aVal = a.articleCode.toLowerCase()
          bVal = b.articleCode.toLowerCase()
          break
        case 'supplier':
          aVal = a.supplier.name.toLowerCase()
          bVal = b.supplier.name.toLowerCase()
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

      let cmp = 0
      if (aVal < bVal) cmp = -1
      if (aVal > bVal) cmp = 1

      return sortDirection === 'asc' ? cmp : -cmp
    })
  }, [filteredProducts, sortField, sortDirection])

  function handleTableHeaderClick(field: string) {
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

  function formatCurrency(price: number): string {
    return new Intl.NumberFormat(localeMap[language] || 'en-US', {
      style: 'currency',
      currency: 'EUR',
    }).format(price)
  }

  function handleAddToCart(product: Product) {
    const qty = getQty(product.id)
    const unit = getUnit(product)
    if (qty < 1) return

    addItem({
      productId: product.id,
      productName: product.name,
      articleCode: product.articleCode,
      supplierId: product.supplierId,
      supplierName: product.supplier.name,
      quantity: qty,
      unit,
      unitsPerBox: product.unitsPerBox,
      boxesPerPallet: product.boxesPerPallet,
      pricePerUnit: product.pricePerUnit,
    })

    toast.success(t('cart.addedToCart', { product: product.name }))

    // Reset quantity to 1
    setQtyOverrides((prev) => {
      const next = { ...prev }
      delete next[product.id]
      return next
    })
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            {t('products.title')}
          </h2>
          <p className="mt-1 text-sm text-gray-500">{t('products.subtitle')}</p>
        </div>
        {totalItems > 0 && (
          <Button asChild>
            <Link href="/cart">
              <ShoppingCart className="h-4 w-4" />
              {t('products.goToCart')} ({totalItems})
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="w-full sm:w-64">
          <Label htmlFor="supplier-filter" className="mb-1.5">
            {t('common.supplier')}
          </Label>
          <Select
            value={selectedSupplierId}
            onValueChange={(value) =>
              setSelectedSupplierId(value === 'all' ? '' : value)
            }
          >
            <SelectTrigger id="supplier-filter" className="w-full">
              <SelectValue placeholder={t('common.allSuppliers')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.allSuppliers')}</SelectItem>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-64">
          <Label htmlFor="type-filter" className="mb-1.5">
            {t('common.productType')}
          </Label>
          <Select
            value={selectedProductTypeId}
            onValueChange={(value) =>
              setSelectedProductTypeId(value === 'all' ? '' : value)
            }
          >
            <SelectTrigger id="type-filter" className="w-full">
              <SelectValue placeholder={t('common.allTypes')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.allTypes')}</SelectItem>
              {productTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative w-full sm:w-72">
          <Label htmlFor="search" className="mb-1.5">
            {t('common.search')}
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              id="search"
              placeholder={t('products.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-gray-500">
            {t('products.loadingProducts')}
          </p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && sortedProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <Package className="h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-sm font-medium text-gray-900">
            {t('products.noProductsFound')}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery
              ? t('products.noProductsFoundDesc')
              : t('products.noProducts')}
          </p>
        </div>
      )}

      {/* Product Table */}
      {!loading && !error && sortedProducts.length > 0 && (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleTableHeaderClick('name')}
                >
                  {t('products.name')}
                  {renderSortIcon('name')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hidden sm:table-cell"
                  onClick={() => handleTableHeaderClick('articleCode')}
                >
                  {t('products.articleCode')}
                  {renderSortIcon('articleCode')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hidden md:table-cell"
                  onClick={() => handleTableHeaderClick('supplier')}
                >
                  {t('products.supplier')}
                  {renderSortIcon('supplier')}
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t('products.type')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hidden sm:table-cell"
                  onClick={() => handleTableHeaderClick('pricePerUnit')}
                >
                  {t('products.pricePerUnit')}
                  {renderSortIcon('pricePerUnit')}
                </TableHead>
                <TableHead className="w-20">{t('cart.quantity')}</TableHead>
                <TableHead className="w-28">{t('cart.unit')}</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProducts.map((product) => {
                const qty = getQty(product.id)
                const unit = getUnit(product)

                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{product.name}</span>
                        {/* Show article code + supplier on mobile */}
                        <span className="block text-xs text-gray-500 sm:hidden">
                          {product.articleCode}
                        </span>
                        <span className="block text-xs text-gray-400 md:hidden sm:block">
                          {product.supplier.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-xs text-gray-500">
                      {product.articleCode}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {product.supplier.name}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {product.productType?.name ?? '-'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {product.pricePerUnit != null
                        ? formatCurrency(product.pricePerUnit)
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={qty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10)
                          if (!isNaN(val) && val > 0) {
                            setQtyOverrides((prev) => ({
                              ...prev,
                              [product.id]: val,
                            }))
                          }
                        }}
                        className="w-16 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={unit}
                        onValueChange={(value) => {
                          setUnitOverrides((prev) => ({
                            ...prev,
                            [product.id]: value,
                          }))
                        }}
                      >
                        <SelectTrigger className="w-24 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PIECE">
                            {t('labels.units.PIECE')}
                          </SelectItem>
                          {product.unitsPerBox && (
                            <SelectItem value="BOX">
                              {t('labels.units.BOX')}
                            </SelectItem>
                          )}
                          {product.boxesPerPallet && (
                            <SelectItem value="PALLET">
                              {t('labels.units.PALLET')}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddToCart(product)}
                        className="h-8"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">
                          {t('cart.addToCart')}
                        </span>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
