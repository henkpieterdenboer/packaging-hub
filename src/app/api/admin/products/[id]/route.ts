import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { updateProductSchema } from '@/lib/validations'

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
    const parsed = updateProductSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const data = parsed.data

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 },
      )
    }

    if (data.articleCode) {
      const articleCodeTaken = await prisma.product.findFirst({
        where: {
          articleCode: data.articleCode,
          id: { not: id },
        },
      })

      if (articleCodeTaken) {
        return NextResponse.json(
          { error: 'A product with this article code already exists' },
          { status: 400 },
        )
      }
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data,
      include: { supplier: { select: { id: true, name: true } } },
    })

    return NextResponse.json(updatedProduct)
  } catch (error) {
    console.error('[PATCH /api/admin/products/[id]]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
