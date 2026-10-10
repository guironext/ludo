import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

/**
 * Options des transactions interactives. Sur Vercel, chaque requête fait l'aller-retour
 * jusqu'à Neon : les 5 s par défaut de Prisma (et 2 s d'attente de connexion) sont trop
 * justes pour une mise + lancement de partie, surtout quand la base Neon se réveille.
 */
export const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const
