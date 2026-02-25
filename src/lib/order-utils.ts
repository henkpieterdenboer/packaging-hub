import type { Prisma } from '@prisma/client'

type TransactionClient = Prisma.TransactionClient

export async function generateOrderNumber(tx: TransactionClient): Promise<string> {
  const orders = await tx.order.findMany({
    select: { orderNumber: true },
  })

  if (orders.length === 0) return 'BEST-0001'

  const maxNum = orders.reduce((max, o) => {
    const num = parseInt(o.orderNumber.split('-')[1], 10)
    return num > max ? num : max
  }, 0)

  return `BEST-${String(maxNum + 1).padStart(4, '0')}`
}
