import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createSupplierSchema } from '@/lib/validations'

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

    const suppliers = await prisma.supplier.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(suppliers)
  } catch (error) {
    console.error('[GET /api/admin/suppliers]', error)
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
    const parsed = createSupplierSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const { name, email, ccEmails, articleGroup, language } = parsed.data

    const supplier = await prisma.supplier.create({
      data: {
        name,
        email,
        ccEmails: ccEmails ?? [],
        articleGroup,
        language: language ?? 'en',
      },
    })

    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    console.error('[POST /api/admin/suppliers]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
