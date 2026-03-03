import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { matchInvoiceSchema } from '@/lib/validations'

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

    // Only ADMIN and FINANCE can manage invoices
    const canManage =
      session.user.roles.includes('ADMIN') ||
      session.user.roles.includes('FINANCE')
    if (!canManage) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      )
    }

    const { id } = await params

    const order = await prisma.order.findUnique({ where: { id } })
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 },
      )
    }

    const body = await request.json()
    const parsed = matchInvoiceSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        invoiceNumber: parsed.data.invoiceNumber,
        invoiceReceivedAt: new Date(),
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'INVOICE_MATCHED',
        entityType: 'Order',
        entityId: id,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PATCH /api/orders/[id]/invoice]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function DELETE(
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

    const canManage =
      session.user.roles.includes('ADMIN') ||
      session.user.roles.includes('FINANCE')
    if (!canManage) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      )
    }

    const { id } = await params

    const updated = await prisma.order.update({
      where: { id },
      data: {
        invoiceNumber: null,
        invoiceReceivedAt: null,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[DELETE /api/orders/[id]/invoice]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
