'use client'

import { useState, useCallback } from 'react'
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
  PackageCheck,
  Mail,
  Settings,
  LogOut,
  Menu,
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/i18n/use-translation'
import { LanguageSwitcher } from '@/i18n/language-switcher'

function NavContent({ pathname, session, isAdmin, onNavigate }: {
  pathname: string
  session: ReturnType<typeof useSession>['data']
  isAdmin: boolean
  onNavigate?: () => void
}) {
  const { t } = useTranslation()

  const mainNavItems = [
    { label: t('nav.dashboard'), href: '/dashboard', icon: LayoutDashboard },
    { label: t('nav.products'), href: '/products', icon: Package },
    { label: t('nav.orders'), href: '/orders', icon: ShoppingCart },
    { label: t('nav.newOrder'), href: '/orders/new', icon: PlusCircle },
    { label: t('nav.goodsReceipt'), href: '/receiving', icon: PackageCheck },
    { label: t('nav.emails'), href: '/emails', icon: Mail },
  ]

  const adminNavItems = [
    { label: t('nav.employees'), href: '/admin/employees', icon: Users },
    { label: t('nav.suppliers'), href: '/admin/suppliers', icon: Truck },
    { label: t('nav.products'), href: '/admin/products', icon: PackageOpen },
  ]

  return (
    <>
      {/* App title */}
      <div className="px-6 py-5">
        <h1 className="text-lg font-bold tracking-tight">
          {t('nav.appTitle')}
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
              onClick={onNavigate}
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
              {t('nav.admin')}
            </p>
            {adminNavItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
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

      {/* Language switcher + User info and sign out */}
      <div className="border-t border-gray-700 px-4 py-4">
        <div className="mb-3">
          <LanguageSwitcher />
        </div>
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
            <div className="ml-2 flex shrink-0 gap-1">
              <Link
                href="/settings"
                onClick={onNavigate}
                className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
                title={t('nav.settings')}
              >
                <Settings className="h-4 w-4" />
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
                title={t('nav.signOut')}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default function Nav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()

  const isAdmin = session?.user?.roles?.includes('ADMIN')

  const handleOpenChange = useCallback((value: boolean) => {
    setOpen(value)
  }, [])

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-gray-900 text-white">
        <NavContent pathname={pathname} session={session} isAdmin={!!isAdmin} />
      </aside>

      {/* Mobile top bar + sheet */}
      <div className="flex md:hidden items-center justify-between bg-gray-900 px-4 py-3">
        <h1 className="text-lg font-bold tracking-tight text-white">
          {t('nav.appTitle')}
        </h1>
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <SheetTrigger asChild>
            <button
              className="rounded-md p-2 text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
          </SheetTrigger>
          <SheetContent
            side="left"
            showCloseButton={false}
            className="w-64 border-r-0 bg-gray-900 p-0 text-white"
          >
            <NavContent pathname={pathname} session={session} isAdmin={!!isAdmin} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
