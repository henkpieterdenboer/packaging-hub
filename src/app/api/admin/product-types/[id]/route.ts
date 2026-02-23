import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { updateProductTypeSchema } from '@/lib/validations'

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

    if (!session.user.roles.includes('ADMIN')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      )
    }

    const { id } = await params

    const body = await request.json()
    const parsed = updateProductTypeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const existing = await prisma.productType.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Product type not found' },
        { status: 404 },
      )
    }

    const data = parsed.data

    if (data.name && data.name !== existing.name) {
      const nameTaken = await prisma.productType.findUnique({
        where: { name: data.name },
      })

      if (nameTaken) {
        return NextResponse.json(
          { error: 'A product type with this name already exists' },
          { status: 400 },
        )
      }
    }

    const updated = await prisma.productType.update({
      where: { id },
      data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PATCH /api/admin/product-types/[id]]', error)
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

    if (!session.user.roles.includes('ADMIN')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      )
    }

    const { id } = await params

    const existing = await prisma.productType.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Product type not found' },
        { status: 404 },
      )
    }

    const updated = await prisma.productType.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[DELETE /api/admin/product-types/[id]]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
