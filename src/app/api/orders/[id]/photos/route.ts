import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { put } from '@vercel/blob'

export async function GET(
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

    const { id } = await params

    const photos = await prisma.deliveryPhoto.findMany({
      where: { orderId: id },
      orderBy: { uploadedAt: 'desc' },
    })

    return NextResponse.json(photos)
  } catch (error) {
    console.error('[GET /api/orders/[id]/photos]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function POST(
  request: Request,
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

    // Only ADMIN and LOGISTICS can upload photos
    const canReceive =
      session.user.roles.includes('ADMIN') ||
      session.user.roles.includes('LOGISTICS')
    if (!canReceive) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      )
    }

    const { id } = await params

    // Verify order exists
    const order = await prisma.order.findUnique({ where: { id } })
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 },
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 },
      )
    }

    // Upload to Vercel Blob
    const blob = await put(
      `delivery-photos/${id}/${file.name}`,
      file,
      { access: 'public' },
    )

    // Create DB record
    const photo = await prisma.deliveryPhoto.create({
      data: {
        orderId: id,
        blobUrl: blob.url,
        fileName: file.name,
        uploadedById: session.user.id,
      },
    })

    return NextResponse.json(photo, { status: 201 })
  } catch (error) {
    console.error('[POST /api/orders/[id]/photos]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
