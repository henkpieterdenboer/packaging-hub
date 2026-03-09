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
import { ArrowLeft, X } from 'lucide-react'
import { useTranslation } from '@/i18n/use-translation'
import { localeMap } from '@/i18n'

interface DeliveryItemInfo {
  id: string
  quantityReceived: number
  orderItem: {
    id: string
    quantity: number
    unit: string
    product: { name: string; articleCode: string }
  }
}

interface DeliveryPhotoInfo {
  id: string
  blobUrl: string
  fileName: string
}

interface DeliveryInfo {
  id: string
  deliveryDate: string
  notes: string | null
  receivedBy: { firstName: string; lastName: string }
  items: DeliveryItemInfo[]
  photos: DeliveryPhotoInfo[]
}

interface OrderDetail {
  id: string
  orderNumber: string
  orderDate: string
  status: string
  notes: string | null
  emailSentAt: string | null
  invoiceNumber: string | null
  invoiceReceivedAt: string | null
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
  deliveries: DeliveryInfo[]
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
  const { t, language } = useTranslation()

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

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
          setError(t('orderDetail.notFound'))
          return
        }
        if (res.status === 403) {
          setError(t('orderDetail.noPermission'))
          return
        }
        if (!res.ok) throw new Error(t('orderDetail.fetchError'))
        const data = await res.json()
        setOrder(data)
      } catch (err) {
        setError(t('orderDetail.loadError'))
        console.error('Failed to fetch order:', err)
      } finally {
        setLoading(false)
      }
    }

    if (status === 'authenticated' && params.id) {
      fetchOrder()
    }
  }, [status, params.id, t])

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
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
            {t('orderDetail.backToOrders')}
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
            {t('common.back')}
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
            {t(`labels.orderStatus.${order.status}`)}
          </Badge>
        </div>
      </div>

      {/* Order Info */}
      <Card>
        <CardHeader>
          <CardTitle>{t('orderDetail.orderInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="text-sm text-gray-500">{t('orderDetail.orderDate')}</span>
              <p className="font-medium text-gray-900">
                {new Date(order.orderDate).toLocaleDateString(localeMap[language] || 'en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500">{t('orderDetail.supplier')}</span>
              <p className="font-medium text-gray-900">{order.supplier.name}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">{t('orderDetail.orderedBy')}</span>
              <p className="font-medium text-gray-900">
                {order.employee.firstName} {order.employee.lastName}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500">{t('orderDetail.daysOpen')}</span>
              {(() => {
                const daysOpen = Math.floor(
                  (Date.now() - new Date(order.orderDate).getTime()) / (1000 * 60 * 60 * 24),
                )
                const isOverdue =
                  daysOpen > 7 && order.status !== 'RECEIVED' && order.status !== 'CANCELLED'
                return (
                  <p className={`font-medium ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-900'}`}>
                    {daysOpen} {t('orderDetail.days')}
                  </p>
                )
              })()}
            </div>
            {order.emailSentAt && (
              <div>
                <span className="text-sm text-gray-500">{t('orderDetail.emailSent')}</span>
                <p className="font-medium text-gray-900">
                  {new Date(order.emailSentAt).toLocaleDateString(localeMap[language] || 'en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-500">{t('orderDetail.invoice')}</span>
              {order.invoiceNumber ? (
                <p className="font-medium text-green-700">
                  {order.invoiceNumber}
                  {order.invoiceReceivedAt && (
                    <span className="ml-2 text-xs text-gray-500 font-normal">
                      ({new Date(order.invoiceReceivedAt).toLocaleDateString(
                        localeMap[language] || 'en-US',
                        { year: 'numeric', month: 'short', day: 'numeric' },
                      )})
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-gray-400">{t('orderDetail.noInvoice')}</p>
              )}
            </div>
          </div>

          {order.notes && (
            <>
              <Separator className="my-4" />
              <div>
                <span className="text-sm text-gray-500">{t('orderDetail.notes')}</span>
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
          <CardTitle>{t('orderDetail.orderItems')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('orderDetail.product')}</TableHead>
                <TableHead>{t('orderDetail.articleCode')}</TableHead>
                <TableHead className="text-right">{t('orderDetail.quantity')}</TableHead>
                <TableHead>{t('orderDetail.unit')}</TableHead>
                <TableHead className="text-right">{t('orderDetail.received')}</TableHead>
                <TableHead>{t('orderDetail.receivedDate')}</TableHead>
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
                      {t(`labels.units.${item.unit}`)}
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
                        ? new Date(item.receivedDate).toLocaleDateString(localeMap[language] || 'en-US', {
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

      {/* Deliveries */}
      {order.deliveries && order.deliveries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('orderDetail.deliveries')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.deliveries.map((delivery, index) => (
                <div key={delivery.id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {t('orderDetail.deliveryDate')}:{' '}
                      {new Date(delivery.deliveryDate).toLocaleDateString(
                        localeMap[language] || 'en-US',
                        { year: 'numeric', month: 'short', day: 'numeric' },
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t('orderDetail.deliveryReceivedBy')}: {delivery.receivedBy.firstName}{' '}
                      {delivery.receivedBy.lastName}
                    </p>
                  </div>

                  {/* Items in this delivery */}
                  <div className="space-y-1">
                    {delivery.items.map((di) => (
                      <div key={di.id} className="flex items-baseline justify-between text-sm">
                        <div>
                          <span className="font-medium">{di.orderItem.product.name}</span>
                          <span className="ml-2 text-xs text-gray-400 font-mono">
                            {di.orderItem.product.articleCode}
                          </span>
                        </div>
                        <span className="text-gray-600">
                          {di.quantityReceived} {t(`labels.units.${di.orderItem.unit}`)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {delivery.notes && (
                    <p className="text-sm text-gray-500 italic">{delivery.notes}</p>
                  )}

                  {/* Photos */}
                  {delivery.photos.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {delivery.photos.map((photo) => (
                        <img
                          key={photo.id}
                          src={photo.blobUrl}
                          alt={photo.fileName}
                          className="h-16 w-full rounded object-cover border cursor-pointer"
                          onClick={() => setLightboxUrl(photo.blobUrl)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {/* Photo lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={lightboxUrl}
            alt=""
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
