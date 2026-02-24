import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { receiveGoodsSchema } from '@/lib/validations'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      )
    }

    const { id } = await params
    const body = await request.json()
    const parsed = receiveGoodsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 },
      )
    }

    if (order.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot receive goods for a cancelled order' },
        { status: 400 },
      )
    }

    if (order.status === 'RECEIVED') {
      return NextResponse.json(
        { error: 'Order is already fully received' },
        { status: 400 },
      )
    }

    const { items, notes } = parsed.data

    // Validate all orderItemIds belong to this order
    const orderItemIds = order.items.map((i) => i.id)
    for (const item of items) {
      if (!orderItemIds.includes(item.orderItemId)) {
        return NextResponse.json(
          { error: `Item ${item.orderItemId} does not belong to this order` },
          { status: 400 },
        )
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update each order item
      for (const item of items) {
        if (item.quantityReceived > 0) {
          await tx.orderItem.update({
            where: { id: item.orderItemId },
            data: {
              quantityReceived: item.quantityReceived,
              receivedDate: new Date(item.receivedDate),
              receivedById: session.user.id,
            },
          })
        }
      }

      // Recalculate order status
      const updatedItems = await tx.orderItem.findMany({
        where: { orderId: id },
      })

      const allReceived = updatedItems.every(
        (i) => i.quantityReceived != null && i.quantityReceived >= i.quantity,
      )
      const someReceived = updatedItems.some(
        (i) => i.quantityReceived != null && i.quantityReceived > 0,
      )

      const newStatus = allReceived
        ? 'RECEIVED'
        : someReceived
          ? 'PARTIALLY_RECEIVED'
          : 'PENDING'

      const updatedOrder = await tx.order.update({
        where: { id },
        data: { status: newStatus },
      })

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'GOODS_RECEIVED',
          entityType: 'Order',
          entityId: id,
          details: notes || null,
        },
      })

      return updatedOrder
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[PATCH /api/orders/[id]/receive]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
