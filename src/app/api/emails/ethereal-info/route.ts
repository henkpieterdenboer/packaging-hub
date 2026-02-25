import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (process.env.NEXT_PUBLIC_TEST_MODE !== 'true') {
      return NextResponse.json(null, { status: 204 })
    }

    const user = process.env.ETHEREAL_USER
    const pass = process.env.ETHEREAL_PASS

    if (!user || !pass) {
      return NextResponse.json(null, { status: 204 })
    }

    return NextResponse.json({ user, pass })
  } catch (error) {
    console.error('[GET /api/emails/ethereal-info]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
