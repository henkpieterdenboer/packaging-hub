'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/cart-context'
import { useTranslation } from '@/i18n/use-translation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { AlertTriangle, Loader2, ShoppingCart, Trash2, Package } from 'lucide-react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Currency formatter
// ---------------------------------------------------------------------------

const eurFormatter = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SupplierGroup {
  supplierId: string
  supplierName: string
  items: Array<{
    productId: string
    productName: string
    articleCode: string
    quantity: number
    unit: string
    unitsPerBox: number | null
    boxesPerPallet: number | null
    pricePerUnit: number | null
  }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcLineTotal(
  quantity: number,
  unit: string,
  pricePerUnit: number | null,
  unitsPerBox: number | null,
  boxesPerPallet: number | null,
): number | null {
  if (pricePerUnit === null) return null
  switch (unit) {
    case 'BOX':
      return quantity * (unitsPerBox ?? 1) * pricePerUnit
    case 'PALLET':
      return quantity * (boxesPerPallet ?? 1) * (unitsPerBox ?? 1) * pricePerUnit
    default:
      return quantity * pricePerUnit
  }
}

function buildUnitConversion(
  unitsPerBox: number | null,
  boxesPerPallet: number | null,
): string | null {
  if (!unitsPerBox && !boxesPerPallet) return null

  const parts: string[] = []

  if (boxesPerPallet && unitsPerBox) {
    const unitsPerPallet = unitsPerBox * boxesPerPallet
    parts.push(`1 pallet = ${boxesPerPallet} boxes = ${unitsPerPallet} units`)
  } else if (boxesPerPallet) {
    parts.push(`1 pallet = ${boxesPerPallet} boxes`)
  }

  if (unitsPerBox && !boxesPerPallet) {
    parts.push(`1 box = ${unitsPerBox} units`)
  } else if (unitsPerBox && parts.length > 0) {
    parts.push(`1 box = ${unitsPerBox} units`)
  }

  return parts.join(' | ')
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CartPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { items, updateItem, removeItem, clearSupplier } = useCart()
  const { t } = useTranslation()

  const [notes, setNotes] = useState<Record<string, string>>({})
  const [loadingSupplier, setLoadingSupplier] = useState<string | null>(null)
  const [loadingAll, setLoadingAll] = useState(false)
  const [pendingOrders, setPendingOrders] = useState<
    Record<string, Array<{ orderNumber: string; employeeName: string }>>
  >({})

  useEffect(() => {
    async function fetchPending() {
      try {
        const res = await fetch('/api/products/pending-orders')
        if (res.ok) setPendingOrders(await res.json())
      } catch (err) {
        console.error('Failed to fetch pending orders:', err)
      }
    }
    if (status === 'authenticated' && items.length > 0) fetchPending()
  }, [status, items.length])

  // Access control: only ADMIN and LOGISTICS can order
  const canOrder = useMemo(() => {
    if (!session?.user?.roles) return false
    return session.user.roles.includes('ADMIN') || session.user.roles.includes('LOGISTICS')
  }, [session?.user?.roles])

  // Group items by supplier
  const supplierGroups = useMemo<SupplierGroup[]>(() => {
    const groupMap = new Map<string, SupplierGroup>()

    for (const item of items) {
      let group = groupMap.get(item.supplierId)
      if (!group) {
        group = {
          supplierId: item.supplierId,
          supplierName: item.supplierName,
          items: [],
        }
        groupMap.set(item.supplierId, group)
      }
      group.items.push({
        productId: item.productId,
        productName: item.productName,
        articleCode: item.articleCode,
        quantity: item.quantity,
        unit: item.unit,
        unitsPerBox: item.unitsPerBox,
        boxesPerPallet: item.boxesPerPallet,
        pricePerUnit: item.pricePerUnit,
      })
    }

    return Array.from(groupMap.values())
  }, [items])

  // Local string state for quantity inputs so user can clear and retype
  const [qtyEditing, setQtyEditing] = useState<Record<string, string>>({})

  const handleQuantityInput = useCallback(
    (productId: string, value: string) => {
      const raw = value.replace(/[^0-9]/g, '')
      setQtyEditing((prev) => ({ ...prev, [productId]: raw }))
      const parsed = parseInt(raw, 10)
      if (!isNaN(parsed) && parsed >= 1) {
        // Sync valid values to cart immediately
        const item = items.find((i) => i.productId === productId)
        if (item) updateItem(productId, parsed, item.unit)
      }
    },
    [items, updateItem],
  )

  const handleQuantityBlur = useCallback(
    (productId: string) => {
      const raw = qtyEditing[productId]
      if (raw === undefined) return
      const parsed = parseInt(raw, 10)
      const item = items.find((i) => i.productId === productId)
      if (!item) return
      if (isNaN(parsed) || parsed < 1) {
        updateItem(productId, 1, item.unit)
      }
      setQtyEditing((prev) => {
        const next = { ...prev }
        delete next[productId]
        return next
      })
    },
    [qtyEditing, items, updateItem],
  )

  const handleUnitChange = useCallback(
    (productId: string, unit: string, currentQuantity: number) => {
      updateItem(productId, currentQuantity, unit)
    },
    [updateItem],
  )

  const handleNotesChange = useCallback((supplierId: string, value: string) => {
    setNotes((prev) => ({ ...prev, [supplierId]: value }))
  }, [])

  const placeOrderForSupplier = useCallback(
    async (group: SupplierGroup): Promise<boolean> => {
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplierId: group.supplierId,
            notes: notes[group.supplierId]?.trim() || undefined,
            items: group.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unit: item.unit,
            })),
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || t('cart.orderFailed'))
        }

        toast.success(
          `${t('cart.orderSuccess')} — ${group.supplierName}`,
          {
            duration: data.etherealUrl ? 15000 : 4000,
            action: data.etherealUrl
              ? {
                  label: t('newOrder.viewEmail'),
                  onClick: () => window.open(data.etherealUrl, '_blank'),
                }
              : undefined,
          },
        )

        clearSupplier(group.supplierId)
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : t('cart.orderFailed')
        toast.error(`${group.supplierName}: ${message}`)
        return false
      }
    },
    [notes, t, clearSupplier],
  )

  const handlePlaceOrder = useCallback(
    async (supplierId: string) => {
      const group = supplierGroups.find((g) => g.supplierId === supplierId)
      if (!group) return

      setLoadingSupplier(supplierId)
      const success = await placeOrderForSupplier(group)
      setLoadingSupplier(null)

      if (success && supplierGroups.length <= 1) {
        router.push('/orders')
      }
    },
    [supplierGroups, placeOrderForSupplier, router],
  )

  const handlePlaceAllOrders = useCallback(async () => {
    setLoadingAll(true)
    let allSuccess = true

    for (const group of supplierGroups) {
      const success = await placeOrderForSupplier(group)
      if (!success) {
        allSuccess = false
      }
    }

    setLoadingAll(false)

    if (allSuccess) {
      router.push('/orders')
    }
  }, [supplierGroups, placeOrderForSupplier, router])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  if (!canOrder) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
          {t('nav.cart')}
        </h2>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-gray-300" />
            <p className="mt-4 text-sm text-gray-500">
              You do not have permission to place orders.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
          {t('nav.cart')}
        </h2>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingCart className="h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {t('cart.empty')}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {t('cart.emptyDesc')}
            </p>
            <Button asChild className="mt-6">
              <Link href="/products">
                {t('cart.browseProducts')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isAnyLoading = loadingAll || loadingSupplier !== null

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            {t('nav.cart')}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {items.length} {items.length === 1 ? 'item' : 'items'} &middot;{' '}
            {supplierGroups.length} {supplierGroups.length === 1 ? 'supplier' : 'suppliers'}
          </p>
        </div>
      </div>

      {/* Supplier groups */}
      {supplierGroups.map((group) => {
        const isGroupLoading = loadingSupplier === group.supplierId || loadingAll

        return (
          <Card key={group.supplierId}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="flex items-center gap-2">
                {group.supplierName}
                <Badge variant="secondary">
                  {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Items table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('newOrder.product')}</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        {t('newOrder.articleCode')}
                      </TableHead>
                      <TableHead className="w-28">{t('newOrder.quantity')}</TableHead>
                      <TableHead className="w-36">{t('newOrder.unit')}</TableHead>
                      <TableHead className="hidden sm:table-cell text-right">
                        {t('cart.total')}
                      </TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.items.map((item) => {
                      const conversion = buildUnitConversion(
                        item.unitsPerBox,
                        item.boxesPerPallet,
                      )
                      const pending = pendingOrders[item.productId]

                      return (
                        <TableRow key={item.productId}>
                          <TableCell className={pending ? 'border-l-4 border-l-amber-400' : ''}>
                            <div>
                              <span className="font-medium">{item.productName}</span>
                              {/* Show article code on mobile under product name */}
                              <span className="block text-xs text-gray-500 sm:hidden">
                                {item.articleCode}
                              </span>
                              {conversion && (
                                <span className="block text-xs text-gray-400 mt-0.5">
                                  {t('cart.unitConversion')}: {conversion}
                                </span>
                              )}
                              {pending && (
                                <Link
                                  href="/orders?status=PENDING"
                                  className="mt-1 flex items-start gap-1 text-xs text-amber-700 hover:text-amber-900 max-w-xs truncate"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                                  <span className="truncate">
                                    {t('cart.pendingWarning')}{' '}
                                    {pending.map((p) => p.orderNumber).join(', ')}
                                  </span>
                                </Link>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell font-mono text-sm text-gray-500">
                            {item.articleCode}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={qtyEditing[item.productId] ?? String(item.quantity)}
                              onChange={(e) =>
                                handleQuantityInput(
                                  item.productId,
                                  e.target.value,
                                )
                              }
                              onBlur={() => handleQuantityBlur(item.productId)}
                              className="w-20"
                              disabled={isAnyLoading}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={item.unit}
                              onValueChange={(value) =>
                                handleUnitChange(
                                  item.productId,
                                  value,
                                  item.quantity,
                                )
                              }
                              disabled={isAnyLoading}
                            >
                              <SelectTrigger className="w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PIECE">
                                  {t('labels.units.PIECE')}
                                </SelectItem>
                                {item.unitsPerBox && (
                                  <SelectItem value="BOX">
                                    {t('labels.units.BOX')}
                                  </SelectItem>
                                )}
                                {item.boxesPerPallet && (
                                  <SelectItem value="PALLET">
                                    {t('labels.units.PALLET')}
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-right">
                            {(() => {
                              const total = calcLineTotal(
                                item.quantity,
                                item.unit,
                                item.pricePerUnit,
                                item.unitsPerBox,
                                item.boxesPerPallet,
                              )
                              return total !== null
                                ? eurFormatter.format(total)
                                : <span className="text-gray-400">--</span>
                            })()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(item.productId)}
                              disabled={isAnyLoading}
                              title={t('cart.remove')}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t('cart.notes')}
                </label>
                <Textarea
                  placeholder={t('cart.notesPlaceholder')}
                  value={notes[group.supplierId] ?? ''}
                  onChange={(e) => handleNotesChange(group.supplierId, e.target.value)}
                  rows={2}
                  className="mt-1"
                  disabled={isAnyLoading}
                />
              </div>

              {/* Place order for this supplier */}
              <div className="flex justify-end">
                <Button
                  onClick={() => handlePlaceOrder(group.supplierId)}
                  disabled={isAnyLoading}
                >
                  {isGroupLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('cart.placingOrder')}
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4" />
                      {t('cart.placeOrder')}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* Place all orders — only show when multiple suppliers */}
      {supplierGroups.length > 1 && (
        <div className="sticky bottom-4 rounded-lg border bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              {items.length} {items.length === 1 ? 'item' : 'items'} &middot;{' '}
              {supplierGroups.length} {supplierGroups.length === 1 ? 'supplier' : 'suppliers'}
            </div>
            <Button
              onClick={handlePlaceAllOrders}
              disabled={isAnyLoading}
              size="lg"
            >
              {loadingAll ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('cart.placingOrder')}
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4" />
                  {t('cart.placeAllOrders')}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
