import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const IS_TEST_MODE = process.env.NEXT_PUBLIC_TEST_MODE === 'true'

export async function GET() {
  if (!IS_TEST_MODE) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cookieStore = await cookies()
  const provider = cookieStore.get('email-provider')?.value || 'ethereal'
  const demoEmail = cookieStore.get('demo-email-target')?.value || null

  return NextResponse.json({ provider, demoEmail })
}

export async function POST(request: Request) {
  if (!IS_TEST_MODE) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { provider, demoEmail } = await request.json()

  if (!provider && demoEmail === undefined) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  }

  const cookieStore = await cookies()

  if (provider) {
    if (!['ethereal', 'resend'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
    }
    cookieStore.set('email-provider', provider, cookieOptions)
  }

  if (demoEmail !== undefined) {
    if (demoEmail) {
      cookieStore.set('demo-email-target', demoEmail, cookieOptions)
    } else {
      cookieStore.delete('demo-email-target')
    }
  }

  const currentProvider = cookieStore.get('email-provider')?.value || 'ethereal'
  const currentDemoEmail = cookieStore.get('demo-email-target')?.value || null

  return NextResponse.json({ provider: currentProvider, demoEmail: currentDemoEmail })
}
