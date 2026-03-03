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

    // Find all order items for orders that are PENDING or PARTIALLY_RECEIVED
    const pendingItems = await prisma.orderItem.findMany({
      where: {
        order: {
          status: { in: ['PENDING', 'PARTIALLY_RECEIVED'] },
        },
      },
      select: {
        productId: true,
        order: {
          select: {
            orderNumber: true,
            employee: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    })

    // Group by productId
    const result: Record<string, Array<{ orderNumber: string; employeeName: string }>> = {}
    for (const item of pendingItems) {
      if (!result[item.productId]) {
        result[item.productId] = []
      }
      const name = `${item.order.employee.firstName} ${item.order.employee.lastName}`
      // Avoid duplicate entries for same order
      if (!result[item.productId].some((e) => e.orderNumber === item.order.orderNumber)) {
        result[item.productId].push({
          orderNumber: item.order.orderNumber,
          employeeName: name,
        })
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[GET /api/products/pending-orders]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
