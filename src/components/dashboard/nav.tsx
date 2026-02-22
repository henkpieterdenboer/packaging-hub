'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  PlusCircle,
  Users,
  Truck,
  PackageOpen,
  LogOut,
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const mainNavItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Products', href: '/products', icon: Package },
  { label: 'Orders', href: '/orders', icon: ShoppingCart },
  { label: 'New Order', href: '/orders/new', icon: PlusCircle },
]

const adminNavItems = [
  { label: 'Employees', href: '/admin/employees', icon: Users },
  { label: 'Suppliers', href: '/admin/suppliers', icon: Truck },
  { label: 'Products', href: '/admin/products', icon: PackageOpen },
]

export default function Nav() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const isAdmin = session?.user?.roles?.includes('ADMIN')

  return (
    <aside className="flex w-64 flex-col bg-gray-900 text-white">
      {/* App title */}
      <div className="px-6 py-5">
        <h1 className="text-lg font-bold tracking-tight">
          Packaging Materials
        </h1>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 space-y-1 px-3">
        {mainNavItems.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          )
        })}

        {/* Admin section */}
        {isAdmin && (
          <>
            <Separator className="!my-4 bg-gray-700" />
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Admin
            </p>
            {adminNavItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User info and sign out */}
      <div className="border-t border-gray-700 px-4 py-4">
        {session?.user && (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {session.user.name}
              </p>
              <p className="truncate text-xs text-gray-400">
                {session.user.email}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="ml-2 shrink-0 rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
