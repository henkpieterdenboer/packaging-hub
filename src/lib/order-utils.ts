import type { Prisma } from '@prisma/client'

type TransactionClient = Prisma.TransactionClient

export async function generateOrderNumber(tx: TransactionClient): Promise<string> {
  const lastOrder = await tx.order.findFirst({
    orderBy: { orderNumber: 'desc' },
  })

  if (!lastOrder) return 'BEST-0001'

  const lastNum = parseInt(lastOrder.orderNumber.split('-')[1], 10)
  return `BEST-${String(lastNum + 1).padStart(4, '0')}`
}
