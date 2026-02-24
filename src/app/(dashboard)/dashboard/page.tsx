import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ShoppingCart, Clock, Package, Truck, Mail, ExternalLink } from 'lucide-react'

const IS_TEST_MODE = process.env.NEXT_PUBLIC_TEST_MODE === 'true'
const ETHEREAL_USER = process.env.ETHEREAL_USER
const ETHEREAL_PASS = process.env.ETHEREAL_PASS

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const [totalOrders, pendingOrders, totalProducts, totalSuppliers] =
    await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.supplier.count({ where: { isActive: true } }),
    ])

  const stats = [
    {
      title: 'Total Orders',
      value: totalOrders,
      icon: ShoppingCart,
      description: 'All time orders placed',
    },
    {
      title: 'Pending Orders',
      value: pendingOrders,
      icon: Clock,
      description: 'Awaiting delivery',
    },
    {
      title: 'Products',
      value: totalProducts,
      icon: Package,
      description: 'Active products',
    },
    {
      title: 'Suppliers',
      value: totalSuppliers,
      icon: Truck,
      description: 'Active suppliers',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
          Welcome back, {session.user.firstName}!
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Here is an overview of your packaging materials inventory.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
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
        })}
      </div>

      {IS_TEST_MODE && ETHEREAL_USER && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">Test Email Inbox</CardTitle>
              <CardDescription>
                Ethereal captures all test emails. Log in to view sent messages.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid gap-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-20 font-medium text-gray-500">User:</span>
                  <code className="rounded bg-muted px-2 py-0.5 text-xs">{ETHEREAL_USER}</code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20 font-medium text-gray-500">Password:</span>
                  <code className="rounded bg-muted px-2 py-0.5 text-xs">{ETHEREAL_PASS}</code>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href="https://ethereal.email/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Open Inbox
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
