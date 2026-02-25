'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ChevronDown, ChevronRight, PackageCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { OrderStatusType, UnitType } from '@/types'
import { useTranslation } from '@/i18n/use-translation'
import { localeMap } from '@/i18n'

interface Order {
  id: string
  orderNumber: string
  orderDate: string
  status: string
  notes: string | null
  employee: {
    firstName: string
    lastName: string
  }
  supplier: {
    name: string
  }
  _count: {
    items: number
  }
}

interface OrderDetailItem {
  id: string
  quantity: number
  unit: string
  quantityReceived: number | null
  receivedDate: string | null
  receivedBy: { firstName: string; lastName: string } | null
  product: {
    id: string
    name: string
    articleCode: string
  }
}

interface OrderDetail {
  id: string
  orderNumber: string
  orderDate: string
  status: string
  notes: string | null
  items: OrderDetailItem[]
  supplier: {
    id: string
    name: string
    email: string
  }
  employee: {
    id: string
    firstName: string
    lastName: string
  }
}

interface ReceiveFormData {
  [orderItemId: string]: {
    quantityReceived: number
    receivedDate: string
  }
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PARTIALLY_RECEIVED: 'bg-blue-100 text-blue-800',
}

function getTodayString(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function ReceivingPage() {
  const { status } = useSession()
  const router = useRouter()
  const { t, language } = useTranslation()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Expanded order state
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [orderDetails, setOrderDetails] = useState<Record<string, OrderDetail>>({})
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({})

  // Form state per order
  const [formData, setFormData] = useState<Record<string, ReceiveFormData>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/orders?receivable=true')
      if (!res.ok) throw new Error('Failed to fetch orders')
      const data = await res.json()
      setOrders(data)
      setError(null)
    } catch (err) {
      setError('Failed to load orders. Please try again.')
      console.error('Failed to fetch orders:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchOrders()
    }
  }, [status, fetchOrders])

  async function fetchOrderDetail(orderId: string) {
    if (orderDetails[orderId]) return // Already loaded

    setLoadingDetails((prev) => ({ ...prev, [orderId]: true }))
    try {
      const res = await fetch(`/api/orders/${orderId}`)
      if (!res.ok) throw new Error('Failed to fetch order details')
      const data: OrderDetail = await res.json()
      setOrderDetails((prev) => ({ ...prev, [orderId]: data }))

      // Initialize form data with existing values
      const today = getTodayString()
      const initialForm: ReceiveFormData = {}
      for (const item of data.items) {
        initialForm[item.id] = {
          quantityReceived: item.quantityReceived ?? 0,
          receivedDate: item.receivedDate
            ? new Date(item.receivedDate).toISOString().split('T')[0]
            : today,
        }
      }
      setFormData((prev) => ({ ...prev, [orderId]: initialForm }))
    } catch (err) {
      toast.error(t('receiving.loadError'))
      console.error('Failed to fetch order detail:', err)
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [orderId]: false }))
    }
  }

  function toggleOrder(orderId: string) {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null)
    } else {
      setExpandedOrderId(orderId)
      fetchOrderDetail(orderId)
    }
  }

  function updateItemField(
    orderId: string,
    orderItemId: string,
    field: 'quantityReceived' | 'receivedDate',
    value: number | string,
  ) {
    setFormData((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [orderItemId]: {
          ...prev[orderId]?.[orderItemId],
          [field]: value,
        },
      },
    }))
  }

  async function handleSave(orderId: string) {
    const detail = orderDetails[orderId]
    const form = formData[orderId]
    if (!detail || !form) return

    const items = detail.items.map((item) => ({
      orderItemId: item.id,
      quantityReceived: form[item.id]?.quantityReceived ?? 0,
      receivedDate: form[item.id]?.receivedDate ?? getTodayString(),
    }))

    setSaving((prev) => ({ ...prev, [orderId]: true }))
    try {
      const res = await fetch(`/api/orders/${orderId}/receive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          notes: notes[orderId] || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('receiving.failed'))
      }

      toast.success(t('receiving.success', { orderNumber: detail.orderNumber }))

      // Refresh data
      // Clear cached detail so it reloads
      setOrderDetails((prev) => {
        const updated = { ...prev }
        delete updated[orderId]
        return updated
      })
      setNotes((prev) => ({ ...prev, [orderId]: '' }))

      // Refetch orders list (order may have changed status)
      await fetchOrders()

      // If the order is still in the list, reload its details
      setExpandedOrderId(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('receiving.failed')
      toast.error(message)
      console.error('Failed to save receiving data:', err)
    } finally {
      setSaving((prev) => ({ ...prev, [orderId]: false }))
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
          {t('receiving.title')}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {t('receiving.subtitle')}
        </p>
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
          <p className="text-sm text-gray-500">{t('receiving.loadingOrders')}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <PackageCheck className="h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-sm font-medium text-gray-900">
            {t('receiving.noOrders')}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {t('receiving.noOrdersDesc')}
          </p>
        </div>
      )}

      {/* Orders List */}
      {!loading && !error && orders.length > 0 && (
        <div className="space-y-3">
          {orders.map((order) => {
            const isExpanded = expandedOrderId === order.id
            const detail = orderDetails[order.id]
            const isLoadingDetail = loadingDetails[order.id]
            const isSaving = saving[order.id]

            return (
              <Card key={order.id}>
                <CardHeader
                  className="cursor-pointer select-none"
                  onClick={() => toggleOrder(order.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      )}
                      <div>
                        <CardTitle className="text-base font-mono">
                          {order.orderNumber}
                        </CardTitle>
                        <p className="text-sm text-gray-500">
                          {order.supplier.name} &middot;{' '}
                          {new Date(order.orderDate).toLocaleDateString(localeMap[language] || 'en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          &middot; {order._count.items} item{order._count.items !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <Badge
                      className={
                        statusColors[order.status] ?? 'bg-gray-100 text-gray-800'
                      }
                    >
                      {t(`labels.orderStatus.${order.status as OrderStatusType}`)}
                    </Badge>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent>
                    {isLoadingDetail && (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                        <span className="ml-2 text-sm text-gray-500">
                          {t('receiving.loadingItems')}
                        </span>
                      </div>
                    )}

                    {!isLoadingDetail && detail && (
                      <div className="space-y-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t('receiving.product')}</TableHead>
                              <TableHead>{t('receiving.articleCode')}</TableHead>
                              <TableHead className="text-right">{t('receiving.ordered')}</TableHead>
                              <TableHead>{t('receiving.unit')}</TableHead>
                              <TableHead className="text-right">{t('receiving.receivedQty')}</TableHead>
                              <TableHead>{t('receiving.dateReceived')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detail.items.map((item) => {
                              const form = formData[order.id]?.[item.id]
                              return (
                                <TableRow key={item.id}>
                                  <TableCell className="font-medium">
                                    {item.product.name}
                                  </TableCell>
                                  <TableCell className="font-mono text-sm text-gray-500">
                                    {item.product.articleCode}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {item.quantity}
                                  </TableCell>
                                  <TableCell>
                                    {t(`labels.units.${item.unit as UnitType}`)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Input
                                      type="number"
                                      min={0}
                                      max={item.quantity * 10}
                                      className="w-24 text-right ml-auto"
                                      value={form?.quantityReceived ?? 0}
                                      onChange={(e) =>
                                        updateItemField(
                                          order.id,
                                          item.id,
                                          'quantityReceived',
                                          parseInt(e.target.value) || 0,
                                        )
                                      }
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="date"
                                      className="w-40"
                                      value={form?.receivedDate ?? getTodayString()}
                                      onChange={(e) =>
                                        updateItemField(
                                          order.id,
                                          item.id,
                                          'receivedDate',
                                          e.target.value,
                                        )
                                      }
                                    />
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>

                        <div>
                          <label className="text-sm font-medium text-gray-700">
                            {t('receiving.notes')}
                          </label>
                          <Textarea
                            className="mt-1"
                            placeholder={t('receiving.notesPlaceholder')}
                            rows={2}
                            value={notes[order.id] ?? ''}
                            onChange={(e) =>
                              setNotes((prev) => ({
                                ...prev,
                                [order.id]: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="flex justify-end">
                          <Button
                            onClick={() => handleSave(order.id)}
                            disabled={isSaving}
                          >
                            {isSaving ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t('receiving.saving')}
                              </>
                            ) : (
                              <>
                                <PackageCheck className="h-4 w-4" />
                                {t('receiving.save')}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
