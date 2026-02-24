'use client'

import { Suspense, useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Loader2, ShoppingCart, ArrowLeft } from 'lucide-react'
import { Unit, type UnitType } from '@/types'
import Link from 'next/link'
import { useTranslation } from '@/i18n/use-translation'

interface Supplier {
  id: string
  name: string
  articleGroup: string
}

interface Product {
  id: string
  name: string
  articleCode: string
  unitsPerBox: number | null
  unitsPerPallet: number | null
  pricePerUnit: number | null
  supplier: {
    id: string
    name: string
  }
}

interface OrderLine {
  productId: string
  quantity: number
  unit: UnitType
}

function NewOrderContent() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillSupplierId = searchParams.get('supplierId')
  const prefillProductId = searchParams.get('productId')
  const prefilled = useRef(false)
  const { t } = useTranslation()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [orderLines, setOrderLines] = useState<Map<string, OrderLine>>(new Map())
  const [notes, setNotes] = useState('')
  const [loadingSuppliers, setLoadingSuppliers] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showSummary, setShowSummary] = useState(false)

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
        // Auto-select supplier from URL params
        if (prefillSupplierId && !prefilled.current) {
          const match = data.find((s: Supplier) => s.id === prefillSupplierId)
          if (match) {
            setSelectedSupplierId(prefillSupplierId)
          }
        }
      } catch (err) {
        toast.error(t('newOrder.failed'))
        console.error('Failed to fetch suppliers:', err)
      } finally {
        setLoadingSuppliers(false)
      }
    }

    if (status === 'authenticated') {
      fetchSuppliers()
    }
  }, [status, prefillSupplierId, t])

  useEffect(() => {
    if (!selectedSupplierId) {
      setProducts([])
      setOrderLines(new Map())
      return
    }

    async function fetchProducts() {
      setLoadingProducts(true)
      try {
        const res = await fetch(`/api/products?supplierId=${selectedSupplierId}`)
        if (!res.ok) throw new Error('Failed to fetch products')
        const data = await res.json()
        setProducts(data)
        // Auto-set quantity for prefilled product
        if (prefillProductId && !prefilled.current) {
          const match = data.find((p: Product) => p.id === prefillProductId)
          if (match) {
            const initial = new Map<string, OrderLine>()
            initial.set(prefillProductId, {
              productId: prefillProductId,
              quantity: 1,
              unit: Unit.PIECE as UnitType,
            })
            setOrderLines(initial)
            prefilled.current = true
          } else {
            setOrderLines(new Map())
          }
        } else {
          setOrderLines(new Map())
        }
      } catch (err) {
        toast.error(t('newOrder.failed'))
        console.error('Failed to fetch products:', err)
      } finally {
        setLoadingProducts(false)
      }
    }

    fetchProducts()
  }, [selectedSupplierId, prefillProductId, t])

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      setOrderLines((prev) => {
        const next = new Map(prev)
        if (quantity <= 0) {
          next.delete(productId)
        } else {
          const existing = next.get(productId)
          next.set(productId, {
            productId,
            quantity,
            unit: existing?.unit ?? (Unit.PIECE as UnitType),
          })
        }
        return next
      })
    },
    [],
  )

  const updateUnit = useCallback(
    (productId: string, unit: UnitType) => {
      setOrderLines((prev) => {
        const next = new Map(prev)
        const existing = next.get(productId)
        if (existing) {
          next.set(productId, { ...existing, unit })
        } else {
          next.set(productId, { productId, quantity: 1, unit })
        }
        return next
      })
    },
    [],
  )

  const selectedItems = Array.from(orderLines.values()).filter(
    (line) => line.quantity > 0,
  )

  const handleReviewOrder = () => {
    if (selectedItems.length === 0) {
      toast.error(t('newOrder.noItemsError'))
      return
    }
    setShowSummary(true)
  }

  const handleSubmitOrder = async () => {
    if (selectedItems.length === 0) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          notes: notes.trim() || undefined,
          items: selectedItems.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            unit: line.unit,
          })),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || t('newOrder.failed'))
      }

      toast.success(t('newOrder.success'), {
        duration: data.etherealUrl ? 15000 : 4000,
        action: data.etherealUrl
          ? {
              label: t('newOrder.viewEmail'),
              onClick: () => window.open(data.etherealUrl, '_blank'),
            }
          : undefined,
      })
      router.push('/orders')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('newOrder.failed')
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
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

  // Order summary view
  if (showSummary) {
    const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId)

    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSummary(false)}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Button>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            {t('newOrder.orderSummary')}
          </h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('newOrder.reviewOrder')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-sm text-gray-500">{t('newOrder.supplier')}</span>
              <p className="font-medium text-gray-900">
                {selectedSupplier?.name}
              </p>
            </div>

            <Separator />

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('newOrder.product')}</TableHead>
                  <TableHead>{t('newOrder.articleCode')}</TableHead>
                  <TableHead className="text-right">{t('newOrder.quantity')}</TableHead>
                  <TableHead>{t('newOrder.unit')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedItems.map((line) => {
                  const product = products.find(
                    (p) => p.id === line.productId,
                  )
                  return (
                    <TableRow key={line.productId}>
                      <TableCell className="font-medium">
                        {product?.name}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-gray-500">
                        {product?.articleCode}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.quantity}
                      </TableCell>
                      <TableCell>
                        {t(`labels.units.${line.unit}`)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            {notes.trim() && (
              <>
                <Separator />
                <div>
                  <span className="text-sm text-gray-500">{t('orderDetail.notes')}</span>
                  <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                    {notes}
                  </p>
                </div>
              </>
            )}

            <Separator />

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowSummary(false)}
                disabled={submitting}
              >
                {t('newOrder.editOrder')}
              </Button>
              <Button onClick={handleSubmitOrder} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('newOrder.placingOrder')}
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4" />
                    {t('newOrder.placeOrder')}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/orders">
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Link>
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            {t('newOrder.title')}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {t('newOrder.subtitle')}
          </p>
        </div>
      </div>

      {/* Step 1: Select Supplier */}
      <Card>
        <CardHeader>
          <CardTitle>{t('newOrder.step1')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSuppliers ? (
            <p className="text-sm text-gray-500">{t('newOrder.loadingSuppliers')}</p>
          ) : (
            <div className="w-full sm:w-80">
              <Label htmlFor="supplier-select" className="mb-1.5">
                {t('newOrder.supplier')}
              </Label>
              <Select
                value={selectedSupplierId}
                onValueChange={setSelectedSupplierId}
              >
                <SelectTrigger id="supplier-select" className="w-full">
                  <SelectValue placeholder={t('newOrder.chooseSupplier')} />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Select Products */}
      {selectedSupplierId && (
        <Card>
          <CardHeader>
            <CardTitle>{t('newOrder.step2')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingProducts ? (
              <p className="text-sm text-gray-500">{t('newOrder.loadingProducts')}</p>
            ) : products.length === 0 ? (
              <p className="text-sm text-gray-500">
                {t('newOrder.noProducts')}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('newOrder.product')}</TableHead>
                    <TableHead>{t('newOrder.articleCode')}</TableHead>
                    <TableHead className="w-32">{t('newOrder.quantity')}</TableHead>
                    <TableHead className="w-36">{t('newOrder.unit')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const line = orderLines.get(product.id)
                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">
                          {product.name}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-gray-500">
                          {product.articleCode}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={line?.quantity ?? ''}
                            onChange={(e) => {
                              const val = e.target.value
                              updateQuantity(
                                product.id,
                                val === '' ? 0 : parseInt(val, 10) || 0,
                              )
                            }}
                            placeholder="0"
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={line?.unit ?? Unit.PIECE}
                            onValueChange={(value) =>
                              updateUnit(product.id, value as UnitType)
                            }
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(Unit).map(([key, value]) => (
                                <SelectItem key={key} value={value}>
                                  {t(`labels.units.${value}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {selectedSupplierId && products.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('newOrder.notes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder={t('newOrder.notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>
      )}

      {/* Order Summary Bar */}
      {selectedItems.length > 0 && (
        <div className="sticky bottom-4 rounded-lg border bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              {t('newOrder.selectedSummary', {
                count: selectedItems.length,
                total: selectedItems.reduce((sum, line) => sum + line.quantity, 0),
              })}
            </div>
            <Button onClick={handleReviewOrder}>
              <ShoppingCart className="h-4 w-4" />
              {t('newOrder.reviewButton')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function NewOrderPage() {
  const { t } = useTranslation()

  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><p className="text-sm text-gray-500">{t('common.loading')}</p></div>}>
      <NewOrderContent />
    </Suspense>
  )
}
