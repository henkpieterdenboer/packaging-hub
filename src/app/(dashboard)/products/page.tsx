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
import { Package, Search } from 'lucide-react'

interface Supplier {
  id: string
  name: string
  articleGroup: string
}

interface Product {
  id: string
  name: string
  articleCode: string
  supplierId: string
  unitsPerBox: number | null
  unitsPerPallet: number | null
  pricePerUnit: number | null
  supplier: {
    id: string
    name: string
  }
}

export default function ProductCatalogPage() {
  const { status } = useSession()
  const router = useRouter()

  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

    if (status === 'authenticated') {
      fetchSuppliers()
    }
  }, [status])

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true)
      setError(null)
      try {
        const url = selectedSupplierId
          ? `/api/products?supplierId=${selectedSupplierId}`
          : '/api/products'
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
  }, [status, selectedSupplierId])

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products

    const query = searchQuery.toLowerCase()
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.articleCode.toLowerCase().includes(query),
    )
  }, [products, searchQuery])

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
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
          Product Catalog
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Browse available packaging materials from all suppliers.
        </p>
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

      {/* Empty State */}
      {!loading && !error && filteredProducts.length === 0 && (
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
      {!loading && !error && filteredProducts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => (
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
