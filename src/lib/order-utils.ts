import { prisma } from './db'

export async function generateOrderNumber(): Promise<string> {
  const lastOrder = await prisma.order.findFirst({
    orderBy: { orderNumber: 'desc' },
  })

  if (!lastOrder) return 'BEST-001'

  const lastNum = parseInt(lastOrder.orderNumber.split('-')[1], 10)
  return `BEST-${String(lastNum + 1).padStart(3, '0')}`
}
