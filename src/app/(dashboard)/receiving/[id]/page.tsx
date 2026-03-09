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

function getTodayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Does this item have a breakdown at all?
function hasBreakdown(item: OrderItem): boolean {
  const { unit } = item
  const { unitsPerBox, boxesPerPallet } = item.product
  if (unit === 'PALLET' && boxesPerPallet) return true
  if (unit === 'BOX' && unitsPerBox) return true
  return false
}

// Calculate expected boxes and units from the received quantity
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
  const [breakdowns, setBreakdowns] = useState<Record<string, BreakdownOverride>>({})
  // Local string state for number inputs so user can clear and retype on mobile
  const [numEditing, setNumEditing] = useState<Record<string, string>>({})

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
    // Reset breakdown confirmation when quantity changes
    if (field === 'quantityReceived') {
      setBreakdowns((prev) => {
        const cur = prev[itemId]
        if (!cur) return prev
        return { ...prev, [itemId]: { ...cur, state: 'pending' } }
      })
    }
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
      [itemId]: {
        state: 'editing',
        actualBoxes: expectedBoxes,
        actualUnits: expectedUnits,
      },
    }))
  }

  function updateOverride(
    itemId: string,
    field: 'actualBoxes' | 'actualUnits',
    value: number,
  ) {
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
              const showBreakdown = hasBreakdown(item) && receivedQty > 0
              const { expectedBoxes, expectedUnits } = calcBreakdown(item, receivedQty)
              const bd = breakdowns[item.id]
              const bdState = bd?.state ?? 'pending'

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
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        {t('receiving.receivedQty')} (
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
                          if (!isNaN(parsed)) {
                            updateField(item.id, 'quantityReceived', parsed)
                          }
                        }}
                        onBlur={() => {
                          const raw = numEditing[`qty-${item.id}`]
                          if (raw !== undefined) {
                            const parsed = parseInt(raw, 10)
                            if (isNaN(parsed)) updateField(item.id, 'quantityReceived', 0)
                            setNumEditing((prev) => {
                              const next = { ...prev }
                              delete next[`qty-${item.id}`]
                              return next
                            })
                          }
                        }}
                        className="mt-1"
                        disabled={isReceived}
                      />

                      {/* Breakdown confirmation — inline below qty */}
                      {showBreakdown && !isReceived && (
                        <div className="mt-2 rounded-md bg-gray-50 p-2.5 space-y-2">
                          <p className="text-xs text-gray-500">
                            {t('receiving.confirmBreakdownHint')}
                          </p>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm text-gray-700">
                              <span className="font-medium">{t('receiving.breakdown')}:</span>{' '}
                              {expectedBoxes !== null && (
                                <>
                                  {expectedBoxes} {t('labels.units.BOX').toLowerCase()}
                                </>
                              )}
                              {expectedBoxes !== null && expectedUnits !== null && ' = '}
                              {expectedUnits !== null && (
                                <>
                                  {expectedUnits} {t('labels.units.PIECE').toLowerCase()}
                                </>
                              )}
                            </p>

                            {bdState === 'pending' && (
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0 border-green-300 text-green-600 hover:bg-green-50 hover:text-green-700"
                                  onClick={() => confirmBreakdown(item.id)}
                                  title={t('receiving.confirmBreakdown')}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0 border-red-300 text-red-500 hover:bg-red-50 hover:text-red-700"
                                  onClick={() => startEditing(item.id, item, receivedQty)}
                                  title={t('receiving.overrideBreakdown')}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}

                            {bdState === 'confirmed' && !bd?.actualBoxes && !bd?.actualUnits && (
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 rounded-full px-2 py-0.5">
                                  <Check className="h-3 w-3" />
                                  {t('receiving.confirmed')}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                                  onClick={() => startEditing(item.id, item, receivedQty)}
                                  title={t('receiving.overrideBreakdown')}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                            )}

                            {bdState === 'confirmed' && (bd?.actualBoxes !== null || bd?.actualUnits !== null) && (
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                                  <Pencil className="h-3 w-3" />
                                  {t('receiving.adjusted')}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                                  onClick={() => startEditing(item.id, item, receivedQty)}
                                  title={t('receiving.overrideBreakdown')}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Override inputs */}
                          {bdState === 'editing' && (
                            <div className="space-y-2 pt-1">
                              <div className="flex items-end gap-2">
                                {expectedBoxes !== null && (
                                  <div className="flex-1">
                                    <label className="text-xs font-medium text-gray-600">
                                      {t('receiving.actualBoxes')}
                                    </label>
                                    <Input
                                      type="text"
                                      inputMode="numeric"
                                      value={numEditing[`boxes-${item.id}`] ?? String(bd?.actualBoxes ?? 0)}
                                      onChange={(e) => {
                                        const raw = e.target.value.replace(/[^0-9]/g, '')
                                        setNumEditing((prev) => ({ ...prev, [`boxes-${item.id}`]: raw }))
                                        const parsed = parseInt(raw, 10)
                                        if (!isNaN(parsed)) updateOverride(item.id, 'actualBoxes', parsed)
                                      }}
                                      onBlur={() => {
                                        const raw = numEditing[`boxes-${item.id}`]
                                        if (raw !== undefined) {
                                          const parsed = parseInt(raw, 10)
                                          if (isNaN(parsed)) updateOverride(item.id, 'actualBoxes', 0)
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
                                      value={numEditing[`units-${item.id}`] ?? String(bd?.actualUnits ?? 0)}
                                      onChange={(e) => {
                                        const raw = e.target.value.replace(/[^0-9]/g, '')
                                        setNumEditing((prev) => ({ ...prev, [`units-${item.id}`]: raw }))
                                        const parsed = parseInt(raw, 10)
                                        if (!isNaN(parsed)) updateOverride(item.id, 'actualUnits', parsed)
                                      }}
                                      onBlur={() => {
                                        const raw = numEditing[`units-${item.id}`]
                                        if (raw !== undefined) {
                                          const parsed = parseInt(raw, 10)
                                          if (isNaN(parsed)) updateOverride(item.id, 'actualUnits', 0)
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

                          {/* Show actual values when confirmed with override */}
                          {bdState === 'confirmed' && (bd?.actualBoxes !== null || bd?.actualUnits !== null) && (
                            <p className="text-sm font-medium text-amber-800">
                              {t('receiving.actual')}:{' '}
                              {bd?.actualBoxes !== null && (
                                <>
                                  {bd.actualBoxes} {t('labels.units.BOX').toLowerCase()}
                                </>
                              )}
                              {bd?.actualBoxes !== null && bd?.actualUnits !== null && ' = '}
                              {bd?.actualUnits !== null && (
                                <>
                                  {bd.actualUnits} {t('labels.units.PIECE').toLowerCase()}
                                </>
                              )}
                            </p>
                          )}
                        </div>
                      )}
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
                  </div>

                  {/* Read-only breakdown for received orders */}
                  {showBreakdown && isReceived && (
                    <p className="text-sm text-gray-500">
                      {t('receiving.breakdown')}:{' '}
                      {expectedBoxes !== null && (
                        <>
                          {expectedBoxes} {t('labels.units.BOX').toLowerCase()}
                        </>
                      )}
                      {expectedBoxes !== null && expectedUnits !== null && ' = '}
                      {expectedUnits !== null && (
                        <>
                          {expectedUnits} {t('labels.units.PIECE').toLowerCase()}
                        </>
                      )}
                    </p>
                  )}
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
                  className="rounded-lg border overflow-hidden"
                >
                  <img
                    src={photo.blobUrl}
                    alt={photo.fileName}
                    className="h-32 w-full object-cover"
                  />
                  <div className="flex items-center justify-between gap-1 px-2 py-1">
                    <p className="truncate text-xs text-gray-500">
                      {photo.fileName}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 shrink-0 text-red-400 hover:text-red-600"
                      onClick={() => handleDeletePhoto(photo.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
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
