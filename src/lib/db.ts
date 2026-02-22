import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient(): PrismaClient {
  const isLocal = process.env.LOCAL_DB === 'true'
  const url = isLocal
    ? process.env.LOCAL_DATABASE_URL
    : process.env.DATABASE_URL

  return new PrismaClient({
    datasourceUrl: url,
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
