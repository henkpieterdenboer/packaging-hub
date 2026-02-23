import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({
  datasourceUrl: process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL,
})

async function main() {
  console.log('Seeding database...')

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      passwordHash: adminPassword,
      roles: ['ADMIN', 'USER'],
      isActive: true,
    },
  })
  console.log(`Created admin: ${admin.email}`)

  // Create demo employee
  const employeePassword = await bcrypt.hash('employee123', 10)
  const employee = await prisma.user.upsert({
    where: { email: 'employee@example.com' },
    update: {},
    create: {
      email: 'employee@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      passwordHash: employeePassword,
      roles: ['USER'],
      isActive: true,
    },
  })
  console.log(`Created employee: ${employee.email}`)

  // Create suppliers
  const supplier1 = await prisma.supplier.upsert({
    where: { id: 'seed-supplier-1' },
    update: {},
    create: {
      id: 'seed-supplier-1',
      name: 'PackRight B.V.',
      email: 'orders@packright.nl',
      ccEmails: ['sales@packright.nl'],
      articleGroup: 'PACKAGING',
    },
  })

  const supplier2 = await prisma.supplier.upsert({
    where: { id: 'seed-supplier-2' },
    update: {},
    create: {
      id: 'seed-supplier-2',
      name: 'LabelPro International',
      email: 'info@labelpro.com',
      articleGroup: 'LABELS',
    },
  })

  const supplier3 = await prisma.supplier.upsert({
    where: { id: 'seed-supplier-3' },
    update: {},
    create: {
      id: 'seed-supplier-3',
      name: 'TapeMasters GmbH',
      email: 'bestellungen@tapemasters.de',
      articleGroup: 'TAPE',
    },
  })

  const supplier4 = await prisma.supplier.upsert({
    where: { id: 'seed-supplier-4' },
    update: {},
    create: {
      id: 'seed-supplier-4',
      name: 'Euro Pallets Co.',
      email: 'orders@europallets.eu',
      ccEmails: ['logistics@europallets.eu'],
      articleGroup: 'PALLETS',
    },
  })

  console.log(`Created ${4} suppliers`)

  // Create product types
  const typeLabel = await prisma.productType.upsert({
    where: { id: 'seed-type-label' },
    update: {},
    create: { id: 'seed-type-label', name: 'Label' },
  })
  await prisma.productType.upsert({
    where: { id: 'seed-type-sleeve' },
    update: {},
    create: { id: 'seed-type-sleeve', name: 'Sleeve' },
  })
  const typeBox = await prisma.productType.upsert({
    where: { id: 'seed-type-box' },
    update: {},
    create: { id: 'seed-type-box', name: 'Box' },
  })
  const typeTape = await prisma.productType.upsert({
    where: { id: 'seed-type-tape' },
    update: {},
    create: { id: 'seed-type-tape', name: 'Tape' },
  })
  const typePalletWrap = await prisma.productType.upsert({
    where: { id: 'seed-type-pallet-wrap' },
    update: {},
    create: { id: 'seed-type-pallet-wrap', name: 'Pallet wrap' },
  })
  await prisma.productType.upsert({
    where: { id: 'seed-type-other' },
    update: {},
    create: { id: 'seed-type-other', name: 'Other' },
  })
  console.log('Created 6 product types')

  // Create products
  const products = [
    { id: 'seed-product-1', name: 'Cardboard Box 40x30x20', articleCode: 'PKG-001', supplierId: supplier1.id, productTypeId: typeBox.id, unitsPerBox: 50, unitsPerPallet: 600, pricePerUnit: 1.25 },
    { id: 'seed-product-2', name: 'Cardboard Box 60x40x30', articleCode: 'PKG-002', supplierId: supplier1.id, productTypeId: typeBox.id, unitsPerBox: 25, unitsPerPallet: 300, pricePerUnit: 2.50 },
    { id: 'seed-product-3', name: 'Bubble Wrap Roll 100m', articleCode: 'PKG-003', supplierId: supplier1.id, productTypeId: typePalletWrap.id, unitsPerBox: 4, pricePerUnit: 15.00 },
    { id: 'seed-product-4', name: 'Shipping Label A6', articleCode: 'LBL-001', supplierId: supplier2.id, productTypeId: typeLabel.id, unitsPerBox: 1000, unitsPerPallet: 20000, pricePerUnit: 0.03 },
    { id: 'seed-product-5', name: 'Product Label 50x30mm', articleCode: 'LBL-002', supplierId: supplier2.id, productTypeId: typeLabel.id, unitsPerBox: 5000, pricePerUnit: 0.02 },
    { id: 'seed-product-6', name: 'Fragile Sticker', articleCode: 'LBL-003', supplierId: supplier2.id, productTypeId: typeLabel.id, unitsPerBox: 500, pricePerUnit: 0.05 },
    { id: 'seed-product-7', name: 'Packing Tape 50mm x 66m', articleCode: 'TPE-001', supplierId: supplier3.id, productTypeId: typeTape.id, unitsPerBox: 36, unitsPerPallet: 1440, pricePerUnit: 1.80 },
    { id: 'seed-product-8', name: 'Printed Tape "FRAGILE"', articleCode: 'TPE-002', supplierId: supplier3.id, productTypeId: typeTape.id, unitsPerBox: 36, pricePerUnit: 2.50 },
    { id: 'seed-product-9', name: 'Euro Pallet 120x80cm', articleCode: 'PLT-001', supplierId: supplier4.id, unitsPerPallet: 1, pricePerUnit: 12.00 },
    { id: 'seed-product-10', name: 'Quarter Pallet 60x40cm', articleCode: 'PLT-002', supplierId: supplier4.id, unitsPerPallet: 1, pricePerUnit: 6.50 },
  ]

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {},
      create: product,
    })
  }
  console.log(`Created ${products.length} products`)

  console.log('\nSeed completed!')
  console.log('\nDemo accounts:')
  console.log('  Admin:    admin@example.com / admin123')
  console.log('  Employee: employee@example.com / employee123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
