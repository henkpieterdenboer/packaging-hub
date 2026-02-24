import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createOrderSchema } from '@/lib/validations'
import { generateOrderNumber } from '@/lib/order-utils'
import { sendOrderEmail } from '@/lib/email'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      )
    }

    const isAdmin = session.user.roles.includes('ADMIN')

    const orders = await prisma.order.findMany({
      where: isAdmin ? {} : { employeeId: session.user.id },
      include: {
        employee: {
          select: { firstName: true, lastName: true },
        },
        supplier: {
          select: { name: true },
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: { orderDate: 'desc' },
    })

    return NextResponse.json(orders)
  } catch (error) {
    console.error('[GET /api/orders]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      )
    }

    const body = await request.json()
    const parsed = createOrderSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const { supplierId, notes, items } = parsed.data

    // Verify supplier exists and is active
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    })

    if (!supplier || !supplier.isActive) {
      return NextResponse.json(
        { error: 'Supplier not found or inactive' },
        { status: 400 },
      )
    }

    // Verify all products exist, are active, and belong to the supplier
    const productIds = items.map((item) => item.productId)
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
        supplierId,
      },
    })

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: 'One or more products are invalid, inactive, or do not belong to the selected supplier' },
        { status: 400 },
      )
    }

    const orderNumber = await generateOrderNumber()

    // Create order with items in a transaction
    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          employeeId: session.user.id,
          supplierId,
          notes: notes ?? null,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unit: item.unit,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: { name: true, articleCode: true },
              },
            },
          },
          supplier: true,
          employee: {
            select: { firstName: true, lastName: true },
          },
        },
      })

      return createdOrder
    })

    // Send order email
    let etherealUrl: string | undefined
    try {
      const emailResult = await sendOrderEmail(
        { orderNumber: order.orderNumber, notes: order.notes },
        order.items.map((item) => ({
          quantity: item.quantity,
          unit: item.unit,
          product: {
            name: item.product.name,
            articleCode: item.product.articleCode,
          },
        })),
        {
          name: order.supplier.name,
          email: order.supplier.email,
          ccEmails: order.supplier.ccEmails,
        },
        {
          firstName: order.employee.firstName,
          lastName: order.employee.lastName,
        },
      )
      etherealUrl = emailResult.etherealUrl

      // Update emailSentAt on success
      await prisma.order.update({
        where: { id: order.id },
        data: { emailSentAt: new Date() },
      })
    } catch (emailError) {
      console.error('[POST /api/orders] Failed to send order email:', emailError)
      // Order is still created, just email failed
    }

    return NextResponse.json({ ...order, etherealUrl }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/orders]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
