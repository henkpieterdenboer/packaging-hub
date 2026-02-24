import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { language } = body

    if (!language || !['en', 'nl', 'pl'].includes(language)) {
      return NextResponse.json({ error: 'Invalid language' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { preferredLanguage: language },
    })

    const response = NextResponse.json({ success: true })
    response.cookies.set('preferred-language', language, {
      path: '/',
      maxAge: 365 * 24 * 60 * 60,
      sameSite: 'lax',
    })

    return response
  } catch (error) {
    console.error('[API] Language update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
