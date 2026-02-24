'use client'

import { Suspense, useEffect, useState } from 'react'
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
import { Plus, Eye, ShoppingCart } from 'lucide-react'
import { useTranslation } from '@/i18n/use-translation'

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

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PARTIALLY_RECEIVED: 'bg-blue-100 text-blue-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
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
  const statusFilter = searchParams.get('status')
  const { t, language } = useTranslation()

  const localeMap: Record<string, string> = { en: 'en-US', nl: 'nl-NL', pl: 'pl-PL' }

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    async function fetchOrders() {
      try {
        const url = statusFilter
          ? `/api/orders?status=${statusFilter}`
          : '/api/orders'
        const res = await fetch(url)
        if (!res.ok) throw new Error(t('orders.fetchError'))
        const data = await res.json()
        setOrders(data)
      } catch (err) {
        setError(t('orders.loadError'))
        console.error('Failed to fetch orders:', err)
      } finally {
        setLoading(false)
      }
    }

    if (status === 'authenticated') {
      fetchOrders()
    }
  }, [status, statusFilter, t])

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
          <Link href="/orders/new">
            <Plus className="h-4 w-4" />
            {t('orders.newOrder')}
          </Link>
        </Button>
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
          <p className="text-sm text-gray-500">{t('orders.loadingOrders')}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <ShoppingCart className="h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-sm font-medium text-gray-900">
            {t('orders.noOrders')}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {t('orders.noOrdersDesc')}
          </p>
          <Button className="mt-4" asChild>
            <Link href="/orders/new">
              <Plus className="h-4 w-4" />
              {t('orders.placeNewOrder')}
            </Link>
          </Button>
        </div>
      )}

      {/* Orders Table */}
      {!loading && !error && orders.length > 0 && (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('orders.orderNumber')}</TableHead>
                <TableHead>{t('orders.supplier')}</TableHead>
                <TableHead>{t('orders.date')}</TableHead>
                <TableHead>{t('orders.status')}</TableHead>
                <TableHead className="text-right">{t('orders.items')}</TableHead>
                <TableHead className="text-right">{t('orders.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/orders/${order.id}`)}
                >
                  <TableCell className="font-medium font-mono">
                    {order.orderNumber}
                  </TableCell>
                  <TableCell>{order.supplier.name}</TableCell>
                  <TableCell>
                    {new Date(order.orderDate).toLocaleDateString(localeMap[language] || 'en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        statusColors[order.status] ?? 'bg-gray-100 text-gray-800'
                      }
                    >
                      {t(`labels.orderStatus.${order.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {order._count.items}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/orders/${order.id}`}>
                        <Eye className="h-4 w-4" />
                        {t('orders.view')}
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
