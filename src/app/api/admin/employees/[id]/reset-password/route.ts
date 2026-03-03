import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/email'
import { v4 as uuidv4 } from 'uuid'

export async function POST(
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

    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 },
      )
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'User is not active. Use resend activation instead.' },
        { status: 400 },
      )
    }

    const resetToken = uuidv4()
    const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await prisma.user.update({
      where: { id },
      data: {
        activationToken: resetToken,
        activationExpiresAt: resetExpiresAt,
      },
    })

    const emailResult = await sendPasswordResetEmail(
      user.email,
      user.firstName,
      resetToken,
      session.user.id,
      user.preferredLanguage,
    )

    return NextResponse.json({
      success: true,
      etherealUrl: emailResult.etherealUrl,
    })
  } catch (error) {
    console.error('[POST /api/admin/employees/[id]/reset-password]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
