'use client'

import { Fragment, useEffect, useState, useMemo } from 'react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileText, Loader2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/i18n/use-translation'
import { localeMap } from '@/i18n'
import type { UnitType } from '@/types'

interface OrderItem {
  id: string
  quantity: number
  unit: string
  quantityReceived: number | null
  product: {
    name: string
    articleCode: string
    pricePerUnit: number | null
    unitsPerBox: number | null
    boxesPerPallet: number | null
  }
}

interface InvoiceOrder {
  id: string
  orderNumber: string
  orderDate: string
  status: string
  invoiceNumber: string | null
  invoiceReceivedAt: string | null
  supplier: { name: string }
  employee: { firstName: string; lastName: string }
  items: OrderItem[]
}

type InvoiceFilter = 'all' | 'pending' | 'invoiced'

export default function InvoicesPage() {
  const { status } = useSession()
  const router = useRouter()
  const { t, language } = useTranslation()

  const [orders, setOrders] = useState<InvoiceOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<InvoiceFilter>('pending')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [invoiceInput, setInvoiceInput] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const eurFormatter = useMemo(
    () => new Intl.NumberFormat(localeMap[language] || 'en-US', { style: 'currency', currency: 'EUR' }),
    [language],
  )

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true)
      try {
        const res = await fetch('/api/orders?invoiceable=true')
        if (!res.ok) throw new Error('Failed to fetch orders')
        setOrders(await res.json())
        setError(null)
      } catch (err) {
        setError(t('invoices.loadError'))
        console.error('Failed to fetch orders:', err)
      } finally {
        setLoading(false)
      }
    }
    if (status === 'authenticated') fetchOrders()
  }, [status, t])

  const suppliers = useMemo(() => {
    const names = new Set(orders.map((o) => o.supplier.name))
    return Array.from(names).sort()
  }, [orders])

  const filteredOrders = useMemo(() => {
    let result = orders

    if (filter === 'pending') {
      result = result.filter((o) => !o.invoiceNumber)
    } else if (filter === 'invoiced') {
      result = result.filter((o) => !!o.invoiceNumber)
    }

    if (supplierFilter !== 'all') {
      result = result.filter((o) => o.supplier.name === supplierFilter)
    }

    return result
  }, [orders, filter, supplierFilter])

  function calcLineTotal(item: OrderItem): number {
    const qty = item.quantityReceived ?? item.quantity
    const price = item.product.pricePerUnit
    if (price === null) return 0
    switch (item.unit) {
      case 'BOX':
        return qty * (item.product.unitsPerBox ?? 1) * price
      case 'PALLET':
        return qty * (item.product.boxesPerPallet ?? 1) * (item.product.unitsPerBox ?? 1) * price
      default:
        return qty * price
    }
  }

  function calculateTotal(items: OrderItem[]): number {
    return items.reduce((sum, item) => sum + calcLineTotal(item), 0)
  }

  function getReceivedSummary(items: OrderItem[]): string {
    const received = items.filter((i) => i.quantityReceived !== null && i.quantityReceived > 0).length
    return `${received}/${items.length}`
  }

  async function handleSaveInvoice(orderId: string) {
    if (!invoiceInput.trim()) return

    setSaving(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}/invoice`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceNumber: invoiceInput.trim() }),
      })
      if (!res.ok) throw new Error('Failed to save invoice')

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, invoiceNumber: invoiceInput.trim(), invoiceReceivedAt: new Date().toISOString() }
            : o,
        ),
      )
      setEditingId(null)
      setInvoiceInput('')
      toast.success(t('invoices.saved'))
    } catch (err) {
      toast.error(t('invoices.saveFailed'))
      console.error(err)
    } finally {
      setSaving(null)
    }
  }

  async function handleRemoveInvoice(orderId: string) {
    setSaving(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}/invoice`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to remove invoice')

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, invoiceNumber: null, invoiceReceivedAt: null }
            : o,
        ),
      )
      toast.success(t('invoices.removed'))
    } catch (err) {
      toast.error(t('invoices.removeFailed'))
      console.error(err)
    } finally {
      setSaving(null)
    }
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
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
          {t('invoices.title')}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {t('invoices.subtitle')}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={filter}
          onValueChange={(v) => setFilter(v as InvoiceFilter)}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('invoices.filterAll')}</SelectItem>
            <SelectItem value="pending">{t('invoices.filterPending')}</SelectItem>
            <SelectItem value="invoiced">{t('invoices.filterInvoiced')}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={supplierFilter}
          onValueChange={setSupplierFilter}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('invoices.allSuppliers')}</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
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
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {!loading && !error && filteredOrders.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <FileText className="h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-sm font-medium text-gray-900">
            {t('invoices.noOrders')}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {t('invoices.noOrdersDesc')}
          </p>
        </div>
      )}

      {!loading && !error && filteredOrders.length > 0 && (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('invoices.supplier')}</TableHead>
                <TableHead>{t('invoices.orderNumber')}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t('invoices.orderDate')}
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  {t('invoices.receivedItems')}
                </TableHead>
                <TableHead className="hidden md:table-cell text-right">
                  {t('invoices.totalAmount')}
                </TableHead>
                <TableHead>{t('invoices.invoiceNumber')}</TableHead>
                <TableHead className="w-[100px]">{t('invoices.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => {
                const total = calculateTotal(order.items)
                const isEditing = editingId === order.id
                const isSaving = saving === order.id
                const isExpanded = expandedId === order.id

                return (
                  <Fragment key={order.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setExpandedId((prev) =>
                          prev === order.id ? null : order.id,
                        )
                      }
                    >
                      <TableCell className="font-medium">
                        {order.supplier.name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {order.orderNumber}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {new Date(order.orderDate).toLocaleDateString(
                          localeMap[language] || 'en-US',
                          { year: 'numeric', month: 'short', day: 'numeric' },
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {getReceivedSummary(order.items)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right font-mono">
                        {total > 0
                          ? eurFormatter.format(total)
                          : '-'}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {isEditing ? (
                          <Input
                            value={invoiceInput}
                            onChange={(e) => setInvoiceInput(e.target.value)}
                            placeholder={t('invoices.enterInvoiceNumber')}
                            className="h-8 w-[160px]"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveInvoice(order.id)
                              if (e.key === 'Escape') {
                                setEditingId(null)
                                setInvoiceInput('')
                              }
                            }}
                          />
                        ) : order.invoiceNumber ? (
                          <Badge className="bg-green-100 text-green-800">
                            {order.invoiceNumber}
                          </Badge>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSaveInvoice(order.id)}
                                disabled={isSaving || !invoiceInput.trim()}
                              >
                                {isSaving ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5 text-green-600" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingId(null)
                                  setInvoiceInput('')
                                }}
                              >
                                <X className="h-3.5 w-3.5 text-gray-400" />
                              </Button>
                            </>
                          ) : order.invoiceNumber ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveInvoice(order.id)}
                              disabled={isSaving}
                            >
                              {isSaving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <X className="h-3.5 w-3.5 text-red-500" />
                              )}
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingId(order.id)
                                setInvoiceInput('')
                              }}
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} className="bg-gray-50/50 px-6 py-2">
                          <div className="space-y-1">
                            {order.items.map((item) => {
                              const lineTotal = calcLineTotal(item)
                              return (
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
                                  <span className="text-gray-500">
                                    {item.quantityReceived ?? 0}/{item.quantity}
                                  </span>
                                  {lineTotal > 0 && (
                                    <span className="font-mono text-gray-600">
                                      {eurFormatter.format(lineTotal)}
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
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
