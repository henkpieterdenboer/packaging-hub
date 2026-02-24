'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from '@/i18n/use-translation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ShoppingCart, Clock, Package, Truck, Mail, ExternalLink } from 'lucide-react'

const IS_TEST_MODE = process.env.NEXT_PUBLIC_TEST_MODE === 'true'

interface DashboardStats {
  totalOrders: number
  pendingOrders: number
  totalProducts: number
  totalSuppliers: number
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { t } = useTranslation()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [etherealCredentials, setEtherealCredentials] = useState<{ user: string; pass: string } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/dashboard')
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (error) {
        console.error('[Dashboard] Failed to fetch stats:', error)
      }
    }

    if (status === 'authenticated') {
      fetchStats()
    }
  }, [status])

  useEffect(() => {
    // Fetch Ethereal credentials from a dedicated endpoint or env
    // NEXT_PUBLIC_ env vars are available in client components
    if (IS_TEST_MODE) {
      // These are exposed via the build-time env, not runtime secrets
      // For the test email section, we fetch from a small API
      async function fetchCredentials() {
        try {
          const res = await fetch('/api/dashboard/ethereal')
          if (res.ok) {
            const data = await res.json()
            setEtherealCredentials(data)
          }
        } catch {
          // Silently fail - ethereal section just won't show
        }
      }
      fetchCredentials()
    }
  }, [])

  if (status === 'loading' || !session) {
    return null
  }

  const isAdmin = session.user.roles.includes('ADMIN')

  const statCards = [
    {
      title: t('dashboard.totalOrders'),
      value: stats?.totalOrders ?? '-',
      icon: ShoppingCart,
      description: t('dashboard.totalOrdersDesc'),
      href: '/orders',
    },
    {
      title: t('dashboard.pendingOrders'),
      value: stats?.pendingOrders ?? '-',
      icon: Clock,
      description: t('dashboard.pendingOrdersDesc'),
      href: '/orders?status=PENDING',
    },
    {
      title: t('dashboard.products'),
      value: stats?.totalProducts ?? '-',
      icon: Package,
      description: t('dashboard.productsDesc'),
      href: '/products',
    },
    {
      title: t('dashboard.suppliers'),
      value: stats?.totalSuppliers ?? '-',
      icon: Truck,
      description: t('dashboard.suppliersDesc'),
      href: isAdmin ? '/admin/suppliers' : undefined,
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
          {t('dashboard.welcome', { firstName: session.user.firstName })}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {t('dashboard.subtitle')}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          const card = (
            <Card className={stat.href ? 'hover:shadow-md transition-shadow' : ''}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  {stat.title}
                </CardTitle>
                <Icon className="h-5 w-5 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">
                  {stat.value}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          )

          if (stat.href) {
            return (
              <Link key={stat.title} href={stat.href} className="block">
                {card}
              </Link>
            )
          }

          return <div key={stat.title}>{card}</div>
        })}
      </div>

      {IS_TEST_MODE && etherealCredentials && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">{t('dashboard.testEmailInbox')}</CardTitle>
              <CardDescription>
                {t('dashboard.testEmailDesc')}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid gap-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-20 font-medium text-gray-500">{t('dashboard.user')}:</span>
                  <code className="rounded bg-muted px-2 py-0.5 text-xs">{etherealCredentials.user}</code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20 font-medium text-gray-500">{t('dashboard.password')}:</span>
                  <code className="rounded bg-muted px-2 py-0.5 text-xs">{etherealCredentials.pass}</code>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href="https://ethereal.email/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {t('dashboard.openInbox')}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
