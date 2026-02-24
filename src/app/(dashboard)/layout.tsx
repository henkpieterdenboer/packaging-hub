import Nav from '@/components/dashboard/nav'
import AuthSessionProvider from '@/components/providers/session-provider'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthSessionProvider>
      <div className="flex h-screen flex-col md:flex-row">
        <Nav />
        <main className="flex-1 overflow-auto bg-gray-50 p-4 md:p-6">
          {children}
        </main>
      </div>
    </AuthSessionProvider>
  )
}
