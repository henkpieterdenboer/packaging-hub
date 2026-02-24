import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      )
    }

    const [totalOrders, pendingOrders, totalProducts, totalSuppliers] =
      await Promise.all([
        prisma.order.count(),
        prisma.order.count({ where: { status: 'PENDING' } }),
        prisma.product.count({ where: { isActive: true } }),
        prisma.supplier.count({ where: { isActive: true } }),
      ])

    return NextResponse.json({
      totalOrders,
      pendingOrders,
      totalProducts,
      totalSuppliers,
    })
  } catch (error) {
    console.error('[API] Dashboard stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
