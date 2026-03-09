import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createDeliverySchema } from '@/lib/validations'

export async function GET(
  _request: Request,
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

    const deliveries = await prisma.delivery.findMany({
      where: { orderId: id },
      orderBy: { deliveryDate: 'desc' },
      include: {
        receivedBy: {
          select: { firstName: true, lastName: true },
        },
        items: {
          include: {
            orderItem: {
              select: {
                id: true,
                quantity: true,
                unit: true,
                product: {
                  select: { name: true, articleCode: true },
                },
              },
            },
          },
        },
        photos: {
          orderBy: { uploadedAt: 'asc' },
        },
      },
    })

    return NextResponse.json(deliveries)
  } catch (error) {
    console.error('[GET /api/orders/[id]/deliveries]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function POST(
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

    const canReceive =
      session.user.roles.includes('ADMIN') ||
      session.user.roles.includes('LOGISTICS')
    if (!canReceive) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      )
    }

    const { id } = await params
    const body = await request.json()
    const parsed = createDeliverySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const { deliveryDate, notes, items } = parsed.data

    // Filter out items with 0 quantity
    const itemsToReceive = items.filter((i) => i.quantityReceived > 0)
    if (itemsToReceive.length === 0) {
      return NextResponse.json(
        { error: 'At least one item must have a quantity greater than 0' },
        { status: 400 },
      )
    }

    // Fetch order with items and existing delivery items for cumulative validation
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            deliveryItems: true,
          },
        },
      },
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

    // Validate items belong to this order and cumulative qty doesn't exceed ordered
    const orderItemMap = new Map(order.items.map((i) => [i.id, i]))
    for (const item of itemsToReceive) {
      const orderItem = orderItemMap.get(item.orderItemId)
      if (!orderItem) {
        return NextResponse.json(
          { error: `Item ${item.orderItemId} does not belong to this order` },
          { status: 400 },
        )
      }
      const alreadyReceived = orderItem.deliveryItems.reduce(
        (sum, di) => sum + di.quantityReceived,
        0,
      )
      if (alreadyReceived + item.quantityReceived > orderItem.quantity) {
        return NextResponse.json(
          {
            error: `Total received (${alreadyReceived + item.quantityReceived}) would exceed ordered quantity (${orderItem.quantity}) for ${orderItem.id}`,
          },
          { status: 400 },
        )
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create delivery
      const delivery = await tx.delivery.create({
        data: {
          orderId: id,
          receivedById: session.user.id,
          deliveryDate: new Date(deliveryDate),
          notes: notes || null,
          items: {
            create: itemsToReceive.map((item) => ({
              orderItemId: item.orderItemId,
              quantityReceived: item.quantityReceived,
            })),
          },
        },
        include: {
          items: true,
          receivedBy: { select: { firstName: true, lastName: true } },
        },
      })

      // Update OrderItem cache fields (sum of all delivery items)
      for (const item of itemsToReceive) {
        const orderItem = orderItemMap.get(item.orderItemId)!
        const totalReceived =
          orderItem.deliveryItems.reduce((sum, di) => sum + di.quantityReceived, 0) +
          item.quantityReceived
        await tx.orderItem.update({
          where: { id: item.orderItemId },
          data: {
            quantityReceived: totalReceived,
            receivedDate: new Date(deliveryDate),
            receivedById: session.user.id,
          },
        })
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

      await tx.order.update({
        where: { id },
        data: { status: newStatus },
      })

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'GOODS_RECEIVED',
          entityType: 'Order',
          entityId: id,
          details: notes || null,
        },
      })

      return delivery
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('[POST /api/orders/[id]/deliveries]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
