import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { EmailType } from '@/types'

const validEmailTypes: Set<string> = new Set(Object.values(EmailType))

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const orderId = searchParams.get('orderId')
    const isAdmin = session.user.roles.includes('ADMIN')

    const where: Record<string, unknown> = {}
    if (!isAdmin) where.sentById = session.user.id
    if (type && validEmailTypes.has(type)) where.type = type
    if (orderId) where.orderId = orderId

    const emails = await prisma.emailLog.findMany({
      where,
      include: {
        order: { select: { orderNumber: true } },
        sentBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { sentAt: 'desc' },
    })

    return NextResponse.json(emails)
  } catch (error) {
    console.error('[GET /api/emails]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
