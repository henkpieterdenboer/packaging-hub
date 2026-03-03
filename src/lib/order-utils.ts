import type { Prisma } from '@prisma/client'

type TransactionClient = Prisma.TransactionClient

const MAX_RETRIES = 3

export async function generateOrderNumber(tx: TransactionClient): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const latest = await tx.order.findFirst({
      select: { orderNumber: true },
      orderBy: { createdAt: 'desc' },
    })

    let nextNum = 1
    if (latest) {
      const match = latest.orderNumber.match(/-(\d+)$/)
      nextNum = match ? parseInt(match[1], 10) + 1 : 1
    }

    const orderNumber = `PO-${String(nextNum).padStart(4, '0')}`

    // Check if this number already exists (race condition guard)
    const exists = await tx.order.findUnique({
      where: { orderNumber },
      select: { id: true },
    })

    if (!exists) return orderNumber

    // If it exists, retry with a fresh query
  }

  // Fallback: use timestamp-based number to guarantee uniqueness
  return `PO-${Date.now()}`
}
