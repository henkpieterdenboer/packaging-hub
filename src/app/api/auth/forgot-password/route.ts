import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '@/lib/db'
import { forgotPasswordSchema } from '@/lib/validations'
import { sendPasswordResetEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = forgotPasswordSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 },
      )
    }

    const { email } = parsed.data
    let etherealUrl: string | undefined

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (user && user.isActive) {
      const token = uuidv4()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

      await prisma.user.update({
        where: { id: user.id },
        data: {
          activationToken: token,
          activationExpiresAt: expiresAt,
        },
      })

      const emailResult = await sendPasswordResetEmail(user.email, user.firstName, token)
      etherealUrl = emailResult.etherealUrl
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
      etherealUrl,
    })
  } catch (error) {
    console.error('[ForgotPassword] Error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 },
    )
  }
}
