import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createUserSchema } from '@/lib/validations'
import { sendActivationEmail } from '@/lib/email'
import { v4 as uuidv4 } from 'uuid'

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

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        middleName: true,
        lastName: true,
        roles: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('[GET /api/admin/employees]', error)
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
    const parsed = createUserSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const { email, firstName, middleName, lastName, roles } = parsed.data

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email address already exists' },
        { status: 400 },
      )
    }

    const activationToken = uuidv4()
    const activationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        firstName,
        middleName: middleName ?? null,
        lastName,
        roles,
        isActive: false,
        activationToken,
        activationExpiresAt,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        middleName: true,
        lastName: true,
        roles: true,
        isActive: true,
        createdAt: true,
      },
    })

    const emailResult = await sendActivationEmail(user.email, user.firstName, activationToken, session.user.id, 'en')

    return NextResponse.json({ ...user, etherealUrl: emailResult.etherealUrl }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/admin/employees]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
