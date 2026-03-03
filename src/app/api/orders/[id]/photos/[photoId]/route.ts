import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { del } from '@vercel/blob'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      )
    }

    // Only ADMIN and LOGISTICS can delete photos
    const canReceive =
      session.user.roles.includes('ADMIN') ||
      session.user.roles.includes('LOGISTICS')
    if (!canReceive) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      )
    }

    const { id, photoId } = await params

    // Find the photo
    const photo = await prisma.deliveryPhoto.findFirst({
      where: { id: photoId, orderId: id },
    })

    if (!photo) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 },
      )
    }

    // Delete from Vercel Blob
    try {
      await del(photo.blobUrl)
    } catch (blobError) {
      console.error('[DELETE photo] Failed to delete blob:', blobError)
      // Continue with DB deletion even if blob delete fails
    }

    // Delete from DB
    await prisma.deliveryPhoto.delete({ where: { id: photoId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/orders/[id]/photos/[photoId]]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
