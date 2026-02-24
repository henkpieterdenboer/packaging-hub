'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  Package,
  Search,
  LayoutGrid,
  List,
  ArrowUp,
  ArrowDown,
  ShoppingCart,
} from 'lucide-react'
import Link from 'next/link'

interface Supplier {
  id: string
  name: string
  articleGroup: string
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
  productTypeId: string | null
  unitsPerBox: number | null
  unitsPerPallet: number | null
  pricePerUnit: number | null
  supplier: {
    id: string
    name: string
  }
  productType: {
    id: string
    name: string
  } | null
}

export default function ProductCatalogPage() {
  const { status } = useSession()
  const router = useRouter()

  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [selectedProductTypeId, setSelectedProductTypeId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortField, setSortField] = useState<string>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    async function fetchSuppliers() {
      try {
        const res = await fetch('/api/suppliers')
        if (!res.ok) throw new Error('Failed to fetch suppliers')
        const data = await res.json()
        setSuppliers(data)
      } catch (err) {
        console.error('Failed to fetch suppliers:', err)
      }
    }

    async function fetchProductTypes() {
      try {
        const res = await fetch('/api/product-types')
        if (!res.ok) throw new Error('Failed to fetch product types')
        const data = await res.json()
        setProductTypes(data)
      } catch (err) {
        console.error('Failed to fetch product types:', err)
      }
    }

    if (status === 'authenticated') {
      fetchSuppliers()
      fetchProductTypes()
    }
  }, [status])

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (selectedSupplierId) params.set('supplierId', selectedSupplierId)
        if (selectedProductTypeId) params.set('productTypeId', selectedProductTypeId)
        const query = params.toString()
        const url = query ? `/api/products?${query}` : '/api/products'
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch products')
        const data = await res.json()
        setProducts(data)
      } catch (err) {
        setError('Failed to load products. Please try again.')
        console.error('Failed to fetch products:', err)
      } finally {
        setLoading(false)
      }
    }

    if (status === 'authenticated') {
      fetchProducts()
    }
  }, [status, selectedSupplierId, selectedProductTypeId])

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products

    const query = searchQuery.toLowerCase()
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.articleCode.toLowerCase().includes(query),
    )
  }, [products, searchQuery])

  const sortedProducts = useMemo(() => {
    const sorted = [...filteredProducts].sort((a, b) => {
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
          // Null values sort to the end regardless of direction
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

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            Product Catalog
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Browse available packaging materials from all suppliers.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon-sm"
            onClick={() => setViewMode('grid')}
            title="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="icon-sm"
            onClick={() => setViewMode('list')}
            title="List view"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="w-full sm:w-64">
          <Label htmlFor="supplier-filter" className="mb-1.5">
            Supplier
          </Label>
          <Select
            value={selectedSupplierId}
            onValueChange={(value) =>
              setSelectedSupplierId(value === 'all' ? '' : value)
            }
          >
            <SelectTrigger id="supplier-filter" className="w-full">
              <SelectValue placeholder="All suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All suppliers</SelectItem>
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
            Product Type
          </Label>
          <Select
            value={selectedProductTypeId}
            onValueChange={(value) =>
              setSelectedProductTypeId(value === 'all' ? '' : value)
            }
          >
            <SelectTrigger id="type-filter" className="w-full">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
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
            Search
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              id="search"
              placeholder="Search by name or article code..."
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
          <p className="text-sm text-gray-500">Loading products...</p>
        </div>
      )}

      {/* Sort controls for grid view */}
      {viewMode === 'grid' && !loading && !error && filteredProducts.length > 0 && (
        <div className="flex items-center gap-2">
          <Label className="text-sm text-gray-500 whitespace-nowrap">Sort by</Label>
          <Select
            value={sortField}
            onValueChange={(value) => setSortField(value)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="articleCode">Article Code</SelectItem>
              <SelectItem value="supplier">Supplier</SelectItem>
              <SelectItem value="pricePerUnit">Price</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() =>
              setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
            }
            title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortDirection === 'asc' ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && sortedProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <Package className="h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-sm font-medium text-gray-900">
            No products found
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery
              ? 'Try adjusting your search terms.'
              : 'No active products available.'}
          </p>
        </div>
      )}

      {/* Product Grid */}
      {!loading && !error && sortedProducts.length > 0 && viewMode === 'grid' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedProducts.map((product) => (
            <Card key={product.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base leading-snug">
                  {product.name}
                </CardTitle>
                <p className="text-xs text-gray-500 font-mono">
                  {product.articleCode}
                </p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Supplier</span>
                  <span className="font-medium text-gray-900">
                    {product.supplier.name}
                  </span>
                </div>
                {product.productType && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type</span>
                    <span className="font-medium text-gray-900">
                      {product.productType.name}
                    </span>
                  </div>
                )}
                {product.unitsPerBox != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Units / Box</span>
                    <span className="font-medium text-gray-900">
                      {product.unitsPerBox}
                    </span>
                  </div>
                )}
                {product.unitsPerPallet != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Units / Pallet</span>
                    <span className="font-medium text-gray-900">
                      {product.unitsPerPallet}
                    </span>
                  </div>
                )}
                {product.pricePerUnit != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Price / Unit</span>
                    <span className="font-medium text-gray-900">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'EUR',
                      }).format(product.pricePerUnit)}
                    </span>
                  </div>
                )}
                <div className="pt-2">
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href={`/orders/new?supplierId=${product.supplierId}&productId=${product.id}`}>
                      <ShoppingCart className="h-3.5 w-3.5" />
                      Order
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Product List */}
      {!loading && !error && sortedProducts.length > 0 && viewMode === 'list' && (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleTableHeaderClick('name')}
                >
                  Name{renderSortIcon('name')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleTableHeaderClick('articleCode')}
                >
                  Article Code{renderSortIcon('articleCode')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleTableHeaderClick('supplier')}
                >
                  Supplier{renderSortIcon('supplier')}
                </TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Units / Box</TableHead>
                <TableHead>Units / Pallet</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleTableHeaderClick('pricePerUnit')}
                >
                  Price{renderSortIcon('pricePerUnit')}
                </TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="font-mono text-xs text-gray-500">
                    {product.articleCode}
                  </TableCell>
                  <TableCell>{product.supplier.name}</TableCell>
                  <TableCell>{product.productType?.name ?? '-'}</TableCell>
                  <TableCell>
                    {product.unitsPerBox != null ? product.unitsPerBox : '-'}
                  </TableCell>
                  <TableCell>
                    {product.unitsPerPallet != null
                      ? product.unitsPerPallet
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {product.pricePerUnit != null
                      ? new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'EUR',
                        }).format(product.pricePerUnit)
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/orders/new?supplierId=${product.supplierId}&productId=${product.id}`}>
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Order
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
