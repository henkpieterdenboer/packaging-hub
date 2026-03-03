'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  PackageCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
} from 'lucide-react'
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

type SortField = 'orderNumber' | 'orderDate' | 'employee' | 'supplier' | 'status'
type SortDir = 'asc' | 'desc'

export default function ReceivingPage() {
  const { status } = useSession()
  const router = useRouter()
  const { t, language } = useTranslation()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [sortField, setSortField] = useState<SortField>('orderDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

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

  const employees = useMemo(() => {
    const names = new Set(
      orders.map((o) => `${o.employee.firstName} ${o.employee.lastName}`),
    )
    return Array.from(names).sort()
  }, [orders])

  const suppliers = useMemo(() => {
    const names = new Set(orders.map((o) => o.supplier.name))
    return Array.from(names).sort()
  }, [orders])

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDir(field === 'orderDate' ? 'desc' : 'asc')
      return field
    })
  }, [])

  const filteredAndSorted = useMemo(() => {
    let result = orders

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.supplier.name.toLowerCase().includes(q) ||
          `${o.employee.firstName} ${o.employee.lastName}`
            .toLowerCase()
            .includes(q),
      )
    }

    if (employeeFilter !== 'all') {
      result = result.filter(
        (o) =>
          `${o.employee.firstName} ${o.employee.lastName}` === employeeFilter,
      )
    }

    if (supplierFilter !== 'all') {
      result = result.filter((o) => o.supplier.name === supplierFilter)
    }

    const sorted = [...result]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'orderNumber':
          cmp = a.orderNumber.localeCompare(b.orderNumber)
          break
        case 'orderDate':
          cmp =
            new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime()
          break
        case 'employee':
          cmp = `${a.employee.firstName} ${a.employee.lastName}`.localeCompare(
            `${b.employee.firstName} ${b.employee.lastName}`,
          )
          break
        case 'supplier':
          cmp = a.supplier.name.localeCompare(b.supplier.name)
          break
        case 'status':
          cmp = a.status.localeCompare(b.status)
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return sorted
  }, [orders, searchQuery, employeeFilter, supplierFilter, sortField, sortDir])

  function SortableHeader({
    field,
    children,
    className,
  }: {
    field: SortField
    children: React.ReactNode
    className?: string
  }) {
    const isActive = sortField === field
    return (
      <TableHead
        className={`cursor-pointer select-none hover:bg-gray-50 ${className ?? ''}`}
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
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
          {t('receiving.title')}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {t('receiving.subtitle')}
        </p>
      </div>

      {/* Filters */}
      {!loading && orders.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder={t('receiving.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('receiving.allEmployees')}
              </SelectItem>
              {employees.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('receiving.allSuppliers')}
              </SelectItem>
              {suppliers.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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
                <SortableHeader field="orderNumber">
                  {t('receiving.orderNumber')}
                </SortableHeader>
                <SortableHeader field="orderDate">
                  {t('receiving.orderDate')}
                </SortableHeader>
                <SortableHeader
                  field="employee"
                  className="hidden sm:table-cell"
                >
                  {t('receiving.orderedBy')}
                </SortableHeader>
                <SortableHeader field="supplier">
                  {t('receiving.supplier')}
                </SortableHeader>
                <SortableHeader field="status">
                  {t('receiving.status')}
                </SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-sm text-gray-500"
                  >
                    {t('receiving.noResults')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSorted.map((order) => (
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
                        {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        },
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
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
