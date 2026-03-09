/**
 * One-time migration script: converts existing OrderItem receiving data
 * into Delivery + DeliveryItem records.
 *
 * Run with: npx tsx scripts/migrate-deliveries.ts
 *
 * Safe to run multiple times — skips orders that already have deliveries.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find all orders that have at least one received item but no deliveries yet
  const orders = await prisma.order.findMany({
    where: {
      items: {
        some: {
          quantityReceived: { gt: 0 },
        },
      },
      deliveries: {
        none: {},
      },
    },
    include: {
      items: {
        where: {
          quantityReceived: { gt: 0 },
        },
      },
      deliveryPhotos: true,
    },
  })

  console.log(`Found ${orders.length} orders to migrate`)

  for (const order of orders) {
    // Group items by receivedDate to create separate deliveries per date
    const byDate = new Map<string, typeof order.items>()
    for (const item of order.items) {
      const dateKey = item.receivedDate
        ? item.receivedDate.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
      const group = byDate.get(dateKey) ?? []
      group.push(item)
      byDate.set(dateKey, group)
    }

    for (const [dateStr, items] of byDate) {
      // Use the first item's receivedById (they're likely all the same)
      const receivedById = items[0].receivedById
      if (!receivedById) continue

      const delivery = await prisma.delivery.create({
        data: {
          orderId: order.id,
          receivedById,
          deliveryDate: new Date(dateStr),
          notes: null,
          items: {
            create: items.map((item) => ({
              orderItemId: item.id,
              quantityReceived: item.quantityReceived!,
            })),
          },
        },
      })

      console.log(
        `  Created delivery ${delivery.id} for order ${order.orderNumber} (${dateStr}, ${items.length} items)`,
      )

      // Link existing photos (orderId) to this delivery
      if (order.deliveryPhotos.length > 0) {
        await prisma.deliveryPhoto.updateMany({
          where: { orderId: order.id, deliveryId: null },
          data: { deliveryId: delivery.id },
        })
        console.log(`    Linked ${order.deliveryPhotos.length} photos to delivery`)
      }
    }
  }

  console.log('Migration complete')
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
