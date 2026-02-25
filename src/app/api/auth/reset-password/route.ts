import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { resetPasswordSchema } from '@/lib/validations'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { token, ...passwordFields } = body

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Reset token is required.' },
        { status: 400 },
      )
    }

    const parsed = resetPasswordSchema.safeParse(passwordFields)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 },
      )
    }

    const { password } = parsed.data

    const user = await prisma.user.findFirst({
      where: {
        activationToken: token,
        isActive: true,
        activationExpiresAt: {
          gt: new Date(),
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token.' },
        { status: 400 },
      )
    }

    const passwordHash = await bcrypt.hash(password, 10)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        activationToken: null,
        activationExpiresAt: null,
      },
    })

    return NextResponse.json({ message: 'Password has been reset successfully.' })
  } catch (error) {
    console.error('[ResetPassword] Error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 },
    )
  }
}
