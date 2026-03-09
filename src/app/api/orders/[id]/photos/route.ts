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

    // Fetch photos linked directly to order OR via deliveries of this order
    const photos = await prisma.deliveryPhoto.findMany({
      where: {
        OR: [
          { orderId: id },
          { delivery: { orderId: id } },
        ],
      },
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
    const deliveryId = formData.get('deliveryId') as string | null
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 },
      )
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG and WebP are allowed.' },
        { status: 400 },
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 },
      )
    }

    // Sanitize filename
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')

    // Upload to Vercel Blob
    const blob = await put(
      `delivery-photos/${id}/${safeName}`,
      file,
      { access: 'public' },
    )

    // Create DB record — link to delivery if provided, otherwise to order
    const photo = await prisma.deliveryPhoto.create({
      data: {
        orderId: deliveryId ? null : id,
        deliveryId: deliveryId || null,
        blobUrl: blob.url,
        fileName: safeName,
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
