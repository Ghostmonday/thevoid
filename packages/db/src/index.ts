import { PrismaClient } from '@prisma/client';

/**
 * Singleton PrismaClient instance for database operations.
 * Prevents connection pool exhaustion in development/hot-reload scenarios.
 */
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export type { PrismaClient };
