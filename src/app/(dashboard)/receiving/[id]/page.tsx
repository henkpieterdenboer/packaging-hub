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
  Check,
  X,
  Pencil,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import type { OrderStatusType, UnitType } from '@/types'
import { useTranslation } from '@/i18n/use-translation'
import { localeMap } from '@/i18n'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface DeliveryItemData {
  id: string
  quantityReceived: number
  orderItem: {
    id: string
    quantity: number
    unit: string
    product: { name: string; articleCode: string }
  }
}

interface DeliveryPhoto {
  id: string
  blobUrl: string
  fileName: string
  uploadedAt: string
}

interface DeliveryData {
  id: string
  deliveryDate: string
  notes: string | null
  createdAt: string
  receivedBy: { firstName: string; lastName: string }
  items: DeliveryItemData[]
  photos: DeliveryPhoto[]
}

interface OrderDetail {
  id: string
  orderNumber: string
  orderDate: string
  status: string
  notes: string | null
  items: OrderItem[]
  deliveries: DeliveryData[]
  supplier: { id: string; name: string; email: string }
  employee: { id: string; firstName: string; lastName: string }
}

interface FormItem {
  quantityReceived: number
}

// Breakdown confirmation: pending (not yet confirmed), confirmed, or editing (override)
type BreakdownState = 'pending' | 'confirmed' | 'editing'

interface BreakdownOverride {
  state: BreakdownState
  actualBoxes: number | null
  actualUnits: number | null
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PARTIALLY_RECEIVED: 'bg-blue-100 text-blue-800',
  RECEIVED: 'bg-green-100 text-green-800',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTodayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function hasBreakdown(item: OrderItem): boolean {
  const { unit } = item
  const { unitsPerBox, boxesPerPallet } = item.product
  if (unit === 'PALLET' && boxesPerPallet) return true
  if (unit === 'BOX' && unitsPerBox) return true
  return false
}

function calcBreakdown(
  item: OrderItem,
  qty: number,
): { expectedBoxes: number | null; expectedUnits: number | null } {
  const { unit } = item
  const { unitsPerBox, boxesPerPallet } = item.product

  if (unit === 'PALLET' && boxesPerPallet) {
    const boxes = qty * boxesPerPallet
    const units = unitsPerBox ? boxes * unitsPerBox : null
    return { expectedBoxes: boxes, expectedUnits: units }
  }
  if (unit === 'BOX' && unitsPerBox) {
    return { expectedBoxes: null, expectedUnits: qty * unitsPerBox }
  }
  return { expectedBoxes: null, expectedUnits: null }
}

/** Total already received for an order item across all deliveries */
function totalDelivered(deliveries: DeliveryData[], orderItemId: string): number {
  let sum = 0
  for (const d of deliveries) {
    for (const di of d.items) {
      if (di.orderItem.id === orderItemId) {
        sum += di.quantityReceived
      }
    }
  }
  return sum
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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

  // New delivery form
  const [formData, setFormData] = useState<Record<string, FormItem>>({})
  const [deliveryDate, setDeliveryDate] = useState(getTodayString())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [breakdowns, setBreakdowns] = useState<Record<string, BreakdownOverride>>({})
  const [numEditing, setNumEditing] = useState<Record<string, string>>({})

  // Photos for latest delivery after save
  const [lastDeliveryId, setLastDeliveryId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // Expandable delivery history
  const [expandedDelivery, setExpandedDelivery] = useState<string | null>(null)

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

        // Initialize form with 0 for each item
        const form: Record<string, FormItem> = {}
        for (const item of data.items) {
          form[item.id] = { quantityReceived: 0 }
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

  // ---------------------------------------------------------------------------
  // Form helpers
  // ---------------------------------------------------------------------------

  function updateQty(itemId: string, value: number) {
    setFormData((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], quantityReceived: value },
    }))
    // Reset breakdown when qty changes
    setBreakdowns((prev) => {
      const cur = prev[itemId]
      if (!cur) return prev
      return { ...prev, [itemId]: { ...cur, state: 'pending' } }
    })
  }

  function confirmBreakdown(itemId: string) {
    setBreakdowns((prev) => ({
      ...prev,
      [itemId]: { state: 'confirmed', actualBoxes: null, actualUnits: null },
    }))
  }

  function startEditing(itemId: string, item: OrderItem, qty: number) {
    const { expectedBoxes, expectedUnits } = calcBreakdown(item, qty)
    setBreakdowns((prev) => ({
      ...prev,
      [itemId]: { state: 'editing', actualBoxes: expectedBoxes, actualUnits: expectedUnits },
    }))
  }

  function updateOverride(itemId: string, field: 'actualBoxes' | 'actualUnits', value: number) {
    setBreakdowns((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }))
  }

  function confirmOverride(itemId: string) {
    setBreakdowns((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], state: 'confirmed' },
    }))
  }

  // ---------------------------------------------------------------------------
  // Save delivery
  // ---------------------------------------------------------------------------

  async function handleSave() {
    if (!order) return
    setSaving(true)
    try {
      const items = order.items
        .map((item) => ({
          orderItemId: item.id,
          quantityReceived: formData[item.id]?.quantityReceived ?? 0,
        }))
        .filter((i) => i.quantityReceived > 0)

      if (items.length === 0) {
        toast.error(t('receiving.deliveryFailed'))
        setSaving(false)
        return
      }

      const res = await fetch(`/api/orders/${orderId}/deliveries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryDate,
          notes: notes || undefined,
          items,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('receiving.deliveryFailed'))
      }

      const delivery = await res.json()
      setLastDeliveryId(delivery.id)

      toast.success(t('receiving.deliverySaved', { orderNumber: order.orderNumber }))

      // Reload order to get updated data
      const orderRes = await fetch(`/api/orders/${orderId}`)
      if (orderRes.ok) {
        const updatedOrder: OrderDetail = await orderRes.json()
        setOrder(updatedOrder)
        // Reset form
        const form: Record<string, FormItem> = {}
        for (const item of updatedOrder.items) {
          form[item.id] = { quantityReceived: 0 }
        }
        setFormData(form)
        setNotes('')
        setBreakdowns({})
        setNumEditing({})
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('receiving.deliveryFailed')
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Photo upload (attached to last delivery)
  // ---------------------------------------------------------------------------

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !lastDeliveryId) return

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('deliveryId', lastDeliveryId)
      const res = await fetch(`/api/orders/${orderId}/photos`, {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) throw new Error('Upload failed')
      toast.success(t('receiving.photoUploaded'))

      // Reload order to show updated photos in delivery history
      const orderRes = await fetch(`/api/orders/${orderId}`)
      if (orderRes.ok) {
        const updatedOrder: OrderDetail = await orderRes.json()
        setOrder(updatedOrder)
      }
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
      const res = await fetch(`/api/orders/${orderId}/photos/${photoId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      toast.success(t('receiving.photoDeleted'))

      // Reload order
      const orderRes = await fetch(`/api/orders/${orderId}`)
      if (orderRes.ok) setOrder(await orderRes.json())
    } catch (err) {
      toast.error('Failed to delete photo')
      console.error(err)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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
          <p className="text-sm text-red-700">{error || 'Order not found'}</p>
        </div>
      </div>
    )
  }

  const isFullyReceived = order.status === 'RECEIVED'
  const deliveries = order.deliveries ?? []

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
            {new Date(order.orderDate).toLocaleDateString(localeMap[language] || 'en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}{' '}
            &middot; {order.employee.firstName} {order.employee.lastName}
          </p>
        </div>
        <Badge className={statusColors[order.status] ?? 'bg-gray-100 text-gray-800'}>
          {t(`labels.orderStatus.${order.status as OrderStatusType}`)}
        </Badge>
      </div>

      {/* Delivery History */}
      {deliveries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('receiving.deliveryHistory')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deliveries.map((delivery, index) => {
                const isExpanded = expandedDelivery === delivery.id
                const deliveryNum = deliveries.length - index

                return (
                  <div key={delivery.id} className="rounded-lg border">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between p-3 text-left hover:bg-gray-50"
                      onClick={() =>
                        setExpandedDelivery((prev) => (prev === delivery.id ? null : delivery.id))
                      }
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">
                          {t('receiving.deliveryNumber', { number: String(deliveryNum) })}
                          <span className="ml-2 text-xs font-normal text-gray-500">
                            {new Date(delivery.deliveryDate).toLocaleDateString(
                              localeMap[language] || 'en-US',
                              { year: 'numeric', month: 'short', day: 'numeric' },
                            )}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500">
                          {t('receiving.receivedBy')}: {delivery.receivedBy.firstName}{' '}
                          {delivery.receivedBy.lastName}
                          {delivery.items.length > 0 && (
                            <span className="ml-2">
                              &middot; {delivery.items.length}{' '}
                              {delivery.items.length === 1 ? 'item' : 'items'}
                            </span>
                          )}
                          {delivery.photos.length > 0 && (
                            <span className="ml-2">
                              &middot; {delivery.photos.length}{' '}
                              {delivery.photos.length === 1 ? 'photo' : 'photos'}
                            </span>
                          )}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t px-3 py-3 space-y-3">
                        {/* Items */}
                        <div className="space-y-1">
                          {delivery.items.map((di) => (
                            <div
                              key={di.id}
                              className="flex items-baseline justify-between text-sm"
                            >
                              <div>
                                <span className="font-medium">{di.orderItem.product.name}</span>
                                <span className="ml-2 text-xs text-gray-400 font-mono">
                                  {di.orderItem.product.articleCode}
                                </span>
                              </div>
                              <span className="text-gray-600">
                                {di.quantityReceived}{' '}
                                {t(`labels.units.${di.orderItem.unit as UnitType}`)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Notes */}
                        {delivery.notes && (
                          <p className="text-sm text-gray-600 italic">{delivery.notes}</p>
                        )}

                        {/* Photos */}
                        {delivery.photos.length > 0 && (
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                            {delivery.photos.map((photo) => (
                              <div key={photo.id} className="rounded-lg border overflow-hidden">
                                <img
                                  src={photo.blobUrl}
                                  alt={photo.fileName}
                                  className="h-24 w-full object-cover"
                                />
                                <div className="flex items-center justify-between gap-1 px-1.5 py-0.5">
                                  <p className="truncate text-xs text-gray-500">{photo.fileName}</p>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 w-5 p-0 shrink-0 text-red-400 hover:text-red-600"
                                    onClick={() => handleDeletePhoto(photo.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add photos to this delivery */}
                        {delivery.id === lastDeliveryId && (
                          <div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handlePhotoUpload}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploading}
                            >
                              {uploading ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  {t('receiving.uploadingPhoto')}
                                </>
                              ) : (
                                <>
                                  <Upload className="h-3.5 w-3.5" />
                                  {t('receiving.addPhotos')}
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Delivery Form */}
      {!isFullyReceived && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5" />
              {t('receiving.newDelivery')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {order.items.map((item) => {
                const alreadyRecv = totalDelivered(deliveries, item.id)
                const remaining = item.quantity - alreadyRecv
                const isItemDone = remaining <= 0
                const form = formData[item.id]
                const receivedQty = form?.quantityReceived ?? 0
                const showBreakdown = hasBreakdown(item) && receivedQty > 0
                const { expectedBoxes, expectedUnits } = calcBreakdown(item, receivedQty)
                const bd = breakdowns[item.id]
                const bdState = bd?.state ?? 'pending'

                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-4 space-y-3 ${isItemDone ? 'opacity-50' : ''}`}
                  >
                    {/* Product info */}
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{item.product.name}</p>
                        <p className="text-xs font-mono text-gray-500">
                          {item.product.articleCode}
                        </p>
                      </div>
                      <div className="text-right text-sm space-y-0.5">
                        <p className="text-gray-500">
                          {t('receiving.ordered')}: {item.quantity}{' '}
                          {t(`labels.units.${item.unit as UnitType}`)}
                        </p>
                        {alreadyRecv > 0 && (
                          <p className="text-blue-600 text-xs">
                            {t('receiving.alreadyReceived')}: {alreadyRecv}
                          </p>
                        )}
                        {isItemDone ? (
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            <Check className="h-3 w-3 mr-0.5" />
                            {t('receiving.fullyReceived')}
                          </Badge>
                        ) : (
                          <p className="text-xs text-gray-400">
                            {t('receiving.remaining')}: {remaining}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Receive inputs (only if not fully received) */}
                    {!isItemDone && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="text-sm font-medium text-gray-700">
                            {t('receiving.receiveThisDelivery')} (
                            {t(`labels.units.${item.unit as UnitType}`)})
                          </label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={numEditing[`qty-${item.id}`] ?? String(receivedQty)}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, '')
                              setNumEditing((prev) => ({ ...prev, [`qty-${item.id}`]: raw }))
                              const parsed = parseInt(raw, 10)
                              if (!isNaN(parsed)) updateQty(item.id, parsed)
                            }}
                            onBlur={() => {
                              const raw = numEditing[`qty-${item.id}`]
                              if (raw !== undefined) {
                                const parsed = parseInt(raw, 10)
                                if (isNaN(parsed)) updateQty(item.id, 0)
                                setNumEditing((prev) => {
                                  const next = { ...prev }
                                  delete next[`qty-${item.id}`]
                                  return next
                                })
                              }
                            }}
                            className="mt-1"
                          />

                          {/* Breakdown info */}
                          {showBreakdown && (
                            <div className="mt-2 rounded-md bg-gray-50 p-2.5 space-y-2">
                              {bdState !== 'editing' && (
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <p className="text-xs text-gray-500 mb-0.5">
                                      {t('receiving.receivedUnits')}
                                    </p>
                                    <p className="text-sm text-gray-700">
                                      <span className="font-medium">
                                        {t('receiving.breakdown')}:
                                      </span>{' '}
                                      {bd?.actualBoxes != null || bd?.actualUnits != null ? (
                                        <>
                                          {bd?.actualBoxes != null && (
                                            <>
                                              {bd.actualBoxes}{' '}
                                              {t('labels.units.BOX').toLowerCase()}
                                            </>
                                          )}
                                          {bd?.actualBoxes != null &&
                                            bd?.actualUnits != null &&
                                            ' = '}
                                          {bd?.actualUnits != null && (
                                            <>
                                              {bd.actualUnits}{' '}
                                              {t('labels.units.PIECE').toLowerCase()}
                                            </>
                                          )}
                                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs font-medium text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5">
                                            <Pencil className="h-2.5 w-2.5" />
                                            {t('receiving.adjusted')}
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          {expectedBoxes !== null && (
                                            <>
                                              {expectedBoxes}{' '}
                                              {t('labels.units.BOX').toLowerCase()}
                                            </>
                                          )}
                                          {expectedBoxes !== null &&
                                            expectedUnits !== null &&
                                            ' = '}
                                          {expectedUnits !== null && (
                                            <>
                                              {expectedUnits}{' '}
                                              {t('labels.units.PIECE').toLowerCase()}
                                            </>
                                          )}
                                        </>
                                      )}
                                    </p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
                                    onClick={() => startEditing(item.id, item, receivedQty)}
                                  >
                                    <Pencil className="h-3 w-3 mr-1" />
                                    {t('receiving.overrideBreakdown')}
                                  </Button>
                                </div>
                              )}

                              {/* Override inputs */}
                              {bdState === 'editing' && (
                                <div className="space-y-2">
                                  <p className="text-xs text-gray-500">
                                    {t('receiving.receivedUnits')}
                                  </p>
                                  <div className="flex items-end gap-2">
                                    {expectedBoxes !== null && (
                                      <div className="flex-1">
                                        <label className="text-xs font-medium text-gray-600">
                                          {t('receiving.actualBoxes')}
                                        </label>
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          value={
                                            numEditing[`boxes-${item.id}`] ??
                                            String(bd?.actualBoxes ?? expectedBoxes)
                                          }
                                          onChange={(e) => {
                                            const raw = e.target.value.replace(/[^0-9]/g, '')
                                            setNumEditing((prev) => ({
                                              ...prev,
                                              [`boxes-${item.id}`]: raw,
                                            }))
                                            const parsed = parseInt(raw, 10)
                                            if (!isNaN(parsed))
                                              updateOverride(item.id, 'actualBoxes', parsed)
                                          }}
                                          onBlur={() => {
                                            const raw = numEditing[`boxes-${item.id}`]
                                            if (raw !== undefined) {
                                              const parsed = parseInt(raw, 10)
                                              if (isNaN(parsed))
                                                updateOverride(item.id, 'actualBoxes', 0)
                                              setNumEditing((prev) => {
                                                const next = { ...prev }
                                                delete next[`boxes-${item.id}`]
                                                return next
                                              })
                                            }
                                          }}
                                          className="mt-1 h-9"
                                        />
                                      </div>
                                    )}
                                    {expectedUnits !== null && (
                                      <div className="flex-1">
                                        <label className="text-xs font-medium text-gray-600">
                                          {t('receiving.actualUnits')}
                                        </label>
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          value={
                                            numEditing[`units-${item.id}`] ??
                                            String(bd?.actualUnits ?? expectedUnits)
                                          }
                                          onChange={(e) => {
                                            const raw = e.target.value.replace(/[^0-9]/g, '')
                                            setNumEditing((prev) => ({
                                              ...prev,
                                              [`units-${item.id}`]: raw,
                                            }))
                                            const parsed = parseInt(raw, 10)
                                            if (!isNaN(parsed))
                                              updateOverride(item.id, 'actualUnits', parsed)
                                          }}
                                          onBlur={() => {
                                            const raw = numEditing[`units-${item.id}`]
                                            if (raw !== undefined) {
                                              const parsed = parseInt(raw, 10)
                                              if (isNaN(parsed))
                                                updateOverride(item.id, 'actualUnits', 0)
                                              setNumEditing((prev) => {
                                                const next = { ...prev }
                                                delete next[`units-${item.id}`]
                                                return next
                                              })
                                            }
                                          }}
                                          className="mt-1 h-9"
                                        />
                                      </div>
                                    )}
                                  </div>
                                  <Button
                                    size="sm"
                                    className="h-9 w-full"
                                    onClick={() => confirmOverride(item.id)}
                                  >
                                    <Check className="h-4 w-4" />
                                    {t('receiving.confirmBreakdown')}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div>
                          {/* Empty second column to maintain grid alignment */}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Delivery date + notes */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    {t('receiving.dateReceived')}
                  </label>
                  <Input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
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
              </div>

              {/* Save button */}
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} size="lg">
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('receiving.savingDelivery')}
                    </>
                  ) : (
                    <>
                      <PackageCheck className="h-4 w-4" />
                      {t('receiving.saveDelivery')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Photo upload prompt after saving */}
      {lastDeliveryId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              {t('receiving.photos')}
            </CardTitle>
          </CardHeader>
          <CardContent>
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
      )}
    </div>
  )
}
