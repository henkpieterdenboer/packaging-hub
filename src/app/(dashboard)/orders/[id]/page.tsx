'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft } from 'lucide-react'
import {
  OrderStatusLabels,
  UnitLabels,
  type OrderStatusType,
  type UnitType,
} from '@/types'

interface OrderDetail {
  id: string
  orderNumber: string
  orderDate: string
  status: string
  notes: string | null
  emailSentAt: string | null
  items: {
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
  }[]
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

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PARTIALLY_RECEIVED: 'bg-blue-100 text-blue-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

export default function OrderDetailPage() {
  const { status } = useSession()
  const router = useRouter()
  const params = useParams<{ id: string }>()

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    async function fetchOrder() {
      try {
        const res = await fetch(`/api/orders/${params.id}`)
        if (res.status === 404) {
          setError('Order not found.')
          return
        }
        if (res.status === 403) {
          setError('You do not have permission to view this order.')
          return
        }
        if (!res.ok) throw new Error('Failed to fetch order')
        const data = await res.json()
        setOrder(data)
      } catch (err) {
        setError('Failed to load order details. Please try again.')
        console.error('Failed to fetch order:', err)
      } finally {
        setLoading(false)
      }
    }

    if (status === 'authenticated' && params.id) {
      fetchOrder()
    }
  }, [status, params.id])

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/orders">
            <ArrowLeft className="h-4 w-4" />
            Back to Orders
          </Link>
        </Button>
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return null
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/orders">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 font-mono">
            {order.orderNumber}
          </h2>
          <Badge
            className={
              statusColors[order.status] ?? 'bg-gray-100 text-gray-800'
            }
          >
            {OrderStatusLabels[order.status as OrderStatusType] ?? order.status}
          </Badge>
        </div>
      </div>

      {/* Order Info */}
      <Card>
        <CardHeader>
          <CardTitle>Order Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="text-sm text-gray-500">Order Date</span>
              <p className="font-medium text-gray-900">
                {new Date(order.orderDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Supplier</span>
              <p className="font-medium text-gray-900">{order.supplier.name}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Ordered by</span>
              <p className="font-medium text-gray-900">
                {order.employee.firstName} {order.employee.lastName}
              </p>
            </div>
            {order.emailSentAt && (
              <div>
                <span className="text-sm text-gray-500">Email sent</span>
                <p className="font-medium text-gray-900">
                  {new Date(order.emailSentAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            )}
          </div>

          {order.notes && (
            <>
              <Separator className="my-4" />
              <div>
                <span className="text-sm text-gray-500">Notes</span>
                <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                  {order.notes}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Article Code</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead>Received Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => {
                const received = item.quantityReceived ?? 0
                const isFullyReceived = received >= item.quantity
                const isPartiallyReceived = received > 0 && received < item.quantity

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.product.name}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-gray-500">
                      {item.product.articleCode}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell>
                      {UnitLabels[item.unit as UnitType] ?? item.unit}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                          isFullyReceived
                            ? 'bg-green-100 text-green-800'
                            : isPartiallyReceived
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'text-gray-500'
                        }`}
                      >
                        {received} / {item.quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {item.receivedDate
                        ? new Date(item.receivedDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '-'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
