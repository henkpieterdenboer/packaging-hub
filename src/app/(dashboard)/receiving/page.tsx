'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { PackageCheck } from 'lucide-react'
import type { OrderStatusType } from '@/types'
import { useTranslation } from '@/i18n/use-translation'
import { localeMap } from '@/i18n'

interface Order {
  id: string
  orderNumber: string
  orderDate: string
  status: string
  employee: { firstName: string; lastName: string }
  supplier: { name: string }
  _count: { items: number }
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PARTIALLY_RECEIVED: 'bg-blue-100 text-blue-800',
}

export default function ReceivingPage() {
  const { status } = useSession()
  const router = useRouter()
  const { t, language } = useTranslation()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true)
      try {
        const res = await fetch('/api/orders?receivable=true')
        if (!res.ok) throw new Error('Failed to fetch orders')
        setOrders(await res.json())
        setError(null)
      } catch (err) {
        setError('Failed to load orders. Please try again.')
        console.error('Failed to fetch orders:', err)
      } finally {
        setLoading(false)
      }
    }
    if (status === 'authenticated') fetchOrders()
  }, [status])

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
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
          {t('receiving.title')}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{t('receiving.subtitle')}</p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-gray-500">
            {t('receiving.loadingOrders')}
          </p>
        </div>
      )}

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

      {!loading && !error && orders.length > 0 && (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('receiving.orderNumber')}</TableHead>
                <TableHead>{t('receiving.orderDate')}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t('receiving.orderedBy')}
                </TableHead>
                <TableHead>{t('receiving.supplier')}</TableHead>
                <TableHead>{t('receiving.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/receiving/${order.id}`)}
                >
                  <TableCell className="font-mono font-medium">
                    {order.orderNumber}
                  </TableCell>
                  <TableCell>
                    {new Date(order.orderDate).toLocaleDateString(
                      localeMap[language] || 'en-US',
                      { year: 'numeric', month: 'short', day: 'numeric' },
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {order.employee.firstName} {order.employee.lastName}
                  </TableCell>
                  <TableCell>{order.supplier.name}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        statusColors[order.status] ??
                        'bg-gray-100 text-gray-800'
                      }
                    >
                      {t(
                        `labels.orderStatus.${order.status as OrderStatusType}`,
                      )}
                    </Badge>
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
