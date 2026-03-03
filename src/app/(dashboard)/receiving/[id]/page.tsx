'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft,
  PackageCheck,
  Loader2,
  Upload,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import type { OrderStatusType, UnitType } from '@/types'
import { useTranslation } from '@/i18n/use-translation'
import { localeMap } from '@/i18n'
import Link from 'next/link'

interface OrderItem {
  id: string
  quantity: number
  unit: string
  quantityReceived: number | null
  receivedDate: string | null
  product: {
    id: string
    name: string
    articleCode: string
    unitsPerBox: number | null
    boxesPerPallet: number | null
  }
}

interface OrderDetail {
  id: string
  orderNumber: string
  orderDate: string
  status: string
  notes: string | null
  items: OrderItem[]
  supplier: { id: string; name: string; email: string }
  employee: { id: string; firstName: string; lastName: string }
}

interface Photo {
  id: string
  blobUrl: string
  fileName: string
  uploadedAt: string
}

interface FormItem {
  quantityReceived: number
  receivedDate: string
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PARTIALLY_RECEIVED: 'bg-blue-100 text-blue-800',
  RECEIVED: 'bg-green-100 text-green-800',
}

function getTodayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ReceivingDetailPage() {
  const { status } = useSession()
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string
  const { t, language } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, FormItem>>({})
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    async function fetchOrder() {
      setLoading(true)
      try {
        const res = await fetch(`/api/orders/${orderId}`)
        if (!res.ok) throw new Error('Failed to fetch order')
        const data: OrderDetail = await res.json()
        setOrder(data)

        const today = getTodayString()
        const form: Record<string, FormItem> = {}
        for (const item of data.items) {
          form[item.id] = {
            quantityReceived: item.quantityReceived ?? 0,
            receivedDate: item.receivedDate
              ? new Date(item.receivedDate).toISOString().split('T')[0]
              : today,
          }
        }
        setFormData(form)
      } catch (err) {
        setError(t('receiving.loadError'))
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (status === 'authenticated' && orderId) fetchOrder()
  }, [status, orderId, t])

  useEffect(() => {
    async function fetchPhotos() {
      try {
        const res = await fetch(`/api/orders/${orderId}/photos`)
        if (res.ok) setPhotos(await res.json())
      } catch (err) {
        console.error('Failed to fetch photos:', err)
      }
    }
    if (status === 'authenticated' && orderId) fetchPhotos()
  }, [status, orderId])

  function updateField(
    itemId: string,
    field: 'quantityReceived' | 'receivedDate',
    value: number | string,
  ) {
    setFormData((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }))
  }

  function getBreakdown(item: OrderItem, qty: number): string | null {
    const { unit } = item
    const { unitsPerBox, boxesPerPallet } = item.product
    if (unit === 'PALLET' && boxesPerPallet && unitsPerBox) {
      const boxes = qty * boxesPerPallet
      const pieces = boxes * unitsPerBox
      return `= ${boxes} ${t('labels.units.BOX').toLowerCase()} = ${pieces} ${t('labels.units.PIECE').toLowerCase()}`
    }
    if (unit === 'BOX' && unitsPerBox) {
      const pieces = qty * unitsPerBox
      return `= ${pieces} ${t('labels.units.PIECE').toLowerCase()}`
    }
    return null
  }

  async function handleSave() {
    if (!order) return
    setSaving(true)
    try {
      const items = order.items.map((item) => ({
        orderItemId: item.id,
        quantityReceived: formData[item.id]?.quantityReceived ?? 0,
        receivedDate: formData[item.id]?.receivedDate ?? getTodayString(),
      }))

      const res = await fetch(`/api/orders/${orderId}/receive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, notes: notes || undefined }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('receiving.failed'))
      }

      toast.success(
        t('receiving.success', { orderNumber: order.orderNumber }),
      )
      router.push('/receiving')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('receiving.failed')
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/orders/${orderId}/photos`, {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) throw new Error('Upload failed')
      const photo: Photo = await res.json()
      setPhotos((prev) => [...prev, photo])
      toast.success(t('receiving.photoUploaded'))
    } catch (err) {
      toast.error('Failed to upload photo')
      console.error(err)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleDeletePhoto(photoId: string) {
    try {
      const res = await fetch(
        `/api/orders/${orderId}/photos/${photoId}`,
        { method: 'DELETE' },
      )
      if (!res.ok) throw new Error('Delete failed')
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
      toast.success(t('receiving.photoDeleted'))
    } catch (err) {
      toast.error('Failed to delete photo')
      console.error(err)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (status === 'unauthenticated') return null

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/receiving">
            <ArrowLeft className="h-4 w-4" />
            {t('receiving.backToReceiving')}
          </Link>
        </Button>
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">
            {error || 'Order not found'}
          </p>
        </div>
      </div>
    )
  }

  const isReceived = order.status === 'RECEIVED'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2" asChild>
            <Link href="/receiving">
              <ArrowLeft className="h-4 w-4" />
              {t('receiving.backToReceiving')}
            </Link>
          </Button>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            {order.orderNumber}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {order.supplier.name} &middot;{' '}
            {new Date(order.orderDate).toLocaleDateString(
              localeMap[language] || 'en-US',
              { year: 'numeric', month: 'long', day: 'numeric' },
            )}{' '}
            &middot;{' '}
            {order.employee.firstName} {order.employee.lastName}
          </p>
        </div>
        <Badge
          className={
            statusColors[order.status] ?? 'bg-gray-100 text-gray-800'
          }
        >
          {t(`labels.orderStatus.${order.status as OrderStatusType}`)}
        </Badge>
      </div>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>{t('receiving.product')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {order.items.map((item) => {
              const form = formData[item.id]
              const receivedQty = form?.quantityReceived ?? 0
              const breakdown = getBreakdown(item, receivedQty)

              return (
                <div
                  key={item.id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  {/* Product info */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-xs font-mono text-gray-500">
                        {item.product.articleCode}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-gray-500">
                        {t('receiving.ordered')}: {item.quantity}{' '}
                        {t(`labels.units.${item.unit as UnitType}`)}
                      </p>
                    </div>
                  </div>

                  {/* Receive inputs */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        {t('receiving.receivedQty')} (
                        {t(`labels.units.${item.unit as UnitType}`)})
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={receivedQty}
                        onChange={(e) =>
                          updateField(
                            item.id,
                            'quantityReceived',
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="mt-1"
                        disabled={isReceived}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        {t('receiving.dateReceived')}
                      </label>
                      <Input
                        type="date"
                        value={form?.receivedDate ?? getTodayString()}
                        onChange={(e) =>
                          updateField(
                            item.id,
                            'receivedDate',
                            e.target.value,
                          )
                        }
                        className="mt-1"
                        disabled={isReceived}
                      />
                    </div>
                    {breakdown && (
                      <div>
                        <label className="text-sm font-medium text-gray-700">
                          {t('receiving.breakdown')}
                        </label>
                        <p className="mt-2 text-sm text-gray-600">
                          {breakdown}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {!isReceived && (
        <Card>
          <CardContent className="pt-6">
            <label className="text-sm font-medium text-gray-700">
              {t('receiving.notes')}
            </label>
            <Textarea
              className="mt-1"
              placeholder={t('receiving.notesPlaceholder')}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </CardContent>
        </Card>
      )}

      {/* Delivery Photos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            {t('receiving.photos')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {photos.length === 0 && (
            <p className="text-sm text-gray-500 mb-4">
              {t('receiving.noPhotos')}
            </p>
          )}

          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 mb-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative rounded-lg border overflow-hidden"
                >
                  <img
                    src={photo.blobUrl}
                    alt={photo.fileName}
                    className="h-32 w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeletePhoto(photo.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t('receiving.deletePhoto')}
                    </Button>
                  </div>
                  <p className="truncate px-2 py-1 text-xs text-gray-500">
                    {photo.fileName}
                  </p>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('receiving.uploadingPhoto')}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                {t('receiving.uploadPhoto')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Save button */}
      {!isReceived && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? (
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
      )}
    </div>
  )
}
