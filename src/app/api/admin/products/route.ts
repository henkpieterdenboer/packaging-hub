import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createProductSchema } from '@/lib/validations'

export async function GET() {
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

    const products = await prisma.product.findMany({
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(products)
  } catch (error) {
    console.error('[GET /api/admin/products]', error)
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

    if (!session.user.roles.includes('ADMIN')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const parsed = createProductSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const {
      name,
      articleCode,
      supplierId,
      unitsPerBox,
      unitsPerPallet,
      pricePerUnit,
      csrdRequirements,
    } = parsed.data

    const existingProduct = await prisma.product.findUnique({
      where: { articleCode },
    })

    if (existingProduct) {
      return NextResponse.json(
        { error: 'A product with this article code already exists' },
        { status: 400 },
      )
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    })

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 400 },
      )
    }

    const product = await prisma.product.create({
      data: {
        name,
        articleCode,
        supplierId,
        unitsPerBox: unitsPerBox ?? null,
        unitsPerPallet: unitsPerPallet ?? null,
        pricePerUnit: pricePerUnit ?? null,
        csrdRequirements: csrdRequirements ?? null,
      },
      include: { supplier: { select: { id: true, name: true } } },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('[POST /api/admin/products]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
