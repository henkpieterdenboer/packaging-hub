'use client'

import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, ShoppingCart, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useTranslation } from '@/i18n/use-translation'
import { localeMap } from '@/i18n'
import type { OrderStatusType, UnitType } from '@/types'

interface Order {
  id: string
  orderNumber: string
  orderDate: string
  status: string
  invoiceNumber: string | null
  invoiceReceivedAt: string | null
  employee: { firstName: string; lastName: string }
  supplier: { name: string }
  _count: { items: number }
}

interface ExpandedItem {
  id: string
  quantity: number
  unit: string
  quantityReceived: number | null
  product: { name: string; articleCode: string }
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PARTIALLY_RECEIVED: 'bg-blue-100 text-blue-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

type SortField = 'orderNumber' | 'supplier' | 'orderDate' | 'status' | 'daysOpen'
type SortDir = 'asc' | 'desc'

function getDaysOpen(orderDate: string): number {
  const now = new Date()
  const order = new Date(orderDate)
  return Math.floor((now.getTime() - order.getTime()) / (1000 * 60 * 60 * 24))
}

export default function OrdersPage() {
  const { t } = useTranslation()

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        </div>
      }
    >
      <OrdersContent />
    </Suspense>
  )
}

function OrdersContent() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialStatus = searchParams.get('status') || 'all'
  const { t, language } = useTranslation()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [sortField, setSortField] = useState<SortField>('orderDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Record<string, ExpandedItem[]>>({})
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    async function fetchOrders() {
      try {
        const res = await fetch('/api/orders')
        if (!res.ok) throw new Error('Failed to fetch')
        setOrders(await res.json())
      } catch (err) {
        setError(t('orders.loadError'))
        console.error('Failed to fetch orders:', err)
      } finally {
        setLoading(false)
      }
    }
    if (status === 'authenticated') fetchOrders()
  }, [status, t])

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDir(field === 'orderDate' || field === 'daysOpen' ? 'desc' : 'asc')
      return field
    })
  }, [])

  const filteredAndSorted = useMemo(() => {
    let result = orders

    if (statusFilter !== 'all') {
      result = result.filter((o) => o.status === statusFilter)
    }

    const sorted = [...result]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'orderNumber':
          cmp = a.orderNumber.localeCompare(b.orderNumber)
          break
        case 'supplier':
          cmp = a.supplier.name.localeCompare(b.supplier.name)
          break
        case 'orderDate':
          cmp = new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime()
          break
        case 'status':
          cmp = a.status.localeCompare(b.status)
          break
        case 'daysOpen':
          cmp = getDaysOpen(a.orderDate) - getDaysOpen(b.orderDate)
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return sorted
  }, [orders, statusFilter, sortField, sortDir])

  async function toggleExpand(orderId: string) {
    if (expandedId === orderId) {
      setExpandedId(null)
      return
    }
    setExpandedId(orderId)
    if (!expandedItems[orderId]) {
      try {
        const res = await fetch(`/api/orders/${orderId}`)
        if (res.ok) {
          const data = await res.json()
          setExpandedItems((prev) => ({ ...prev, [orderId]: data.items }))
        }
      } catch (err) {
        console.error('Failed to fetch order items:', err)
      }
    }
  }

  function handleRowClick(orderId: string) {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
      router.push(`/orders/${orderId}`)
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null
        toggleExpand(orderId)
      }, 300)
    }
  }

  function SortableHeader({ field, children }: { field: SortField; children: React.ReactNode }) {
    const isActive = sortField === field
    return (
      <TableHead
        className="cursor-pointer select-none hover:bg-gray-50"
        onClick={() => handleSort(field)}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          {isActive ? (
            sortDir === 'asc' ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" />
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 text-gray-300" />
          )}
        </span>
      </TableHead>
    )
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      </div>
    )
  }

  if (status === 'unauthenticated') return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            {t('orders.title')}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {t('orders.subtitle')}
          </p>
        </div>
        <Button asChild>
          <Link href="/products">
            <Plus className="h-4 w-4" />
            {t('orders.newOrder')}
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('orders.filterAll')}</SelectItem>
            <SelectItem value="PENDING">{t('labels.orderStatus.PENDING')}</SelectItem>
            <SelectItem value="PARTIALLY_RECEIVED">{t('labels.orderStatus.PARTIALLY_RECEIVED')}</SelectItem>
            <SelectItem value="RECEIVED">{t('labels.orderStatus.RECEIVED')}</SelectItem>
            <SelectItem value="CANCELLED">{t('labels.orderStatus.CANCELLED')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-gray-500">{t('orders.loadingOrders')}</p>
        </div>
      )}

      {!loading && !error && filteredAndSorted.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <ShoppingCart className="h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-sm font-medium text-gray-900">
            {t('orders.noOrders')}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {t('orders.noOrdersDesc')}
          </p>
          <Button className="mt-4" asChild>
            <Link href="/products">
              <Plus className="h-4 w-4" />
              {t('orders.placeNewOrder')}
            </Link>
          </Button>
        </div>
      )}

      {!loading && !error && filteredAndSorted.length > 0 && (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader field="orderNumber">{t('orders.orderNumber')}</SortableHeader>
                <SortableHeader field="supplier">{t('orders.supplier')}</SortableHeader>
                <SortableHeader field="orderDate">{t('orders.date')}</SortableHeader>
                <SortableHeader field="status">{t('orders.status')}</SortableHeader>
                <SortableHeader field="daysOpen">{t('orders.daysOpen')}</SortableHeader>
                <TableHead className="hidden md:table-cell">{t('orders.invoice')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.map((order) => {
                const daysOpen = getDaysOpen(order.orderDate)
                const isOverdue = daysOpen > 7 && order.status !== 'RECEIVED' && order.status !== 'CANCELLED'
                const isExpanded = expandedId === order.id
                const items = expandedItems[order.id]

                return (
                  <Fragment key={order.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleRowClick(order.id)}
                    >
                      <TableCell className="font-medium font-mono">
                        {order.orderNumber}
                      </TableCell>
                      <TableCell>{order.supplier.name}</TableCell>
                      <TableCell>
                        {new Date(order.orderDate).toLocaleDateString(
                          localeMap[language] || 'en-US',
                          { year: 'numeric', month: 'short', day: 'numeric' },
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={statusColors[order.status] ?? 'bg-gray-100 text-gray-800'}
                        >
                          {t(`labels.orderStatus.${order.status as OrderStatusType}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            isOverdue
                              ? 'font-bold text-red-600'
                              : 'text-gray-500'
                          }
                        >
                          {daysOpen}d
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {order.invoiceNumber ? (
                          <Badge className="bg-green-100 text-green-800">
                            {order.invoiceNumber}
                          </Badge>
                        ) : order.status === 'RECEIVED' || order.status === 'PARTIALLY_RECEIVED' ? (
                          <span className="text-sm text-amber-600">{t('orders.noInvoice')}</span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="bg-gray-50/50 px-6 py-2">
                          {items ? (
                            <div className="space-y-1">
                              {items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-sm"
                                >
                                  <span className="font-medium">
                                    {item.product.name}
                                  </span>
                                  <span className="text-xs font-mono text-gray-400">
                                    {item.product.articleCode}
                                  </span>
                                  <span className="text-gray-600">
                                    {item.quantity}{' '}
                                    {t(`labels.units.${item.unit as UnitType}`)}
                                  </span>
                                  {item.quantityReceived !== null && (
                                    <span className="text-gray-500">
                                      {item.quantityReceived}/{item.quantity}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400">{t('common.loading')}</p>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
