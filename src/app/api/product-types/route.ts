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

    const productTypes = await prisma.productType.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(productTypes)
  } catch (error) {
    console.error('[GET /api/product-types]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
