import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

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
    const { rows } = body

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: 'No data rows provided' },
        { status: 400 },
      )
    }

    if (rows.length > 1000) {
      return NextResponse.json(
        { error: 'Too many rows. Maximum is 1000 per import.' },
        { status: 400 },
      )
    }

    // Pre-fetch suppliers and product types for matching
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    })

    const productTypes = await prisma.productType.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    })

    const supplierMap = new Map(
      suppliers.map((s) => [s.name.toLowerCase(), s.id]),
    )
    const typeMap = new Map(
      productTypes.map((pt) => [pt.name.toLowerCase(), pt.id]),
    )

    const errors: Array<{ row: number; message: string }> = []
    const productsToCreate: Array<{
      name: string
      articleCode: string
      supplierId: string
      productTypeId: string | null
      unitsPerBox: number | null
      boxesPerPallet: number | null
      pricePerUnit: number | null
      remarks: string | null
      isCustom: boolean
      preferredOrderUnit: string | null
    }> = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // Excel row (header is row 1)

      const name = String(row.name || '').trim()
      const articleCode = String(row['article code'] || '').trim()
      const supplierName = String(row.supplier || '').trim()

      if (!name) {
        errors.push({ row: rowNum, message: 'Name is required' })
        continue
      }

      if (!articleCode) {
        errors.push({ row: rowNum, message: 'Article code is required' })
        continue
      }

      if (!supplierName) {
        errors.push({ row: rowNum, message: 'Supplier is required' })
        continue
      }

      const supplierId = supplierMap.get(supplierName.toLowerCase())
      if (!supplierId) {
        errors.push({ row: rowNum, message: `Supplier "${supplierName}" not found` })
        continue
      }

      const typeName = String(row.type || '').trim()
      let productTypeId: string | null = null
      if (typeName) {
        productTypeId = typeMap.get(typeName.toLowerCase()) || null
        if (!productTypeId) {
          errors.push({ row: rowNum, message: `Product type "${typeName}" not found` })
          continue
        }
      }

      const unitsPerBox = row['units/box'] != null ? Number(row['units/box']) : null
      const boxesPerPallet = row['boxes/pallet'] != null ? Number(row['boxes/pallet']) : null
      const pricePerUnit = row['price/unit'] != null ? Number(row['price/unit']) : null
      const remarks = row.remarks ? String(row.remarks).trim() : null
      const isCustomStr = String(row.custom || '').trim().toLowerCase()
      const isCustom = isCustomStr === 'yes' || isCustomStr === 'true' || isCustomStr === '1'
      const preferredUnit = String(row['preferred unit'] || '').trim().toUpperCase()
      const preferredOrderUnit = preferredUnit === 'BOX' || preferredUnit === 'PALLET' ? preferredUnit : null

      productsToCreate.push({
        name,
        articleCode,
        supplierId,
        productTypeId,
        unitsPerBox: unitsPerBox && !isNaN(unitsPerBox) ? unitsPerBox : null,
        boxesPerPallet: boxesPerPallet && !isNaN(boxesPerPallet) ? boxesPerPallet : null,
        pricePerUnit: pricePerUnit && !isNaN(pricePerUnit) ? pricePerUnit : null,
        remarks,
        isCustom,
        preferredOrderUnit,
      })
    }

    if (productsToCreate.length === 0) {
      return NextResponse.json(
        { imported: 0, errors },
        { status: 200 },
      )
    }

    // Check for duplicate article codes
    const articleCodes = productsToCreate.map((p) => p.articleCode)
    const existingProducts = await prisma.product.findMany({
      where: { articleCode: { in: articleCodes } },
      select: { articleCode: true },
    })
    const existingCodes = new Set(existingProducts.map((p) => p.articleCode))

    const validProducts = productsToCreate.filter((p) => {
      if (existingCodes.has(p.articleCode)) {
        errors.push({
          row: rows.findIndex((r: Record<string, unknown>) => String(r['article code'] || '').trim() === p.articleCode) + 2,
          message: `Article code "${p.articleCode}" already exists`,
        })
        return false
      }
      return true
    })

    // Also check for duplicates within the import itself
    const seenCodes = new Set<string>()
    const deduped = validProducts.filter((p) => {
      if (seenCodes.has(p.articleCode)) {
        errors.push({
          row: rows.findIndex((r: Record<string, unknown>) => String(r['article code'] || '').trim() === p.articleCode) + 2,
          message: `Duplicate article code "${p.articleCode}" in import`,
        })
        return false
      }
      seenCodes.add(p.articleCode)
      return true
    })

    // Create all valid products in a transaction
    let imported = 0
    if (deduped.length > 0) {
      await prisma.$transaction(
        deduped.map((p) => prisma.product.create({ data: p })),
      )
      imported = deduped.length
    }

    return NextResponse.json({ imported, errors })
  } catch (error) {
    console.error('[POST /api/admin/products/import]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
