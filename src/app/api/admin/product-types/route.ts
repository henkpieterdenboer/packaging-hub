import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createProductTypeSchema } from '@/lib/validations'

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

    const productTypes = await prisma.productType.findMany({
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(productTypes)
  } catch (error) {
    console.error('[GET /api/admin/product-types]', error)
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
    const parsed = createProductTypeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const { name } = parsed.data

    const existing = await prisma.productType.findUnique({
      where: { name },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A product type with this name already exists' },
        { status: 400 },
      )
    }

    const productType = await prisma.productType.create({
      data: { name },
    })

    return NextResponse.json(productType, { status: 201 })
  } catch (error) {
    console.error('[POST /api/admin/product-types]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
