import { prisma } from "./db"
import { HOUSE_PSEUDO, MANAGER_PSEUDO, ROLE_JOUEUR, SIGNUP_POKY } from "./rules"
import { PRIVILEGED_ROLES, specialAccountFor } from "./special-accounts"

/** Données Clerk normalisées (venant de currentUser() ou d'un webhook). */
export type ClerkPlayerData = {
  clerkId: string
  email: string | null
  emailVerified: boolean
  username: string | null
}

type EmailLike = { id: string; address?: string | null; verified: boolean }

export function pickPrimaryEmail(emails: EmailLike[], primaryId: string | null | undefined) {
  const primary = emails.find((e) => e.id === primaryId) ?? emails[0]
  const email = primary?.address?.trim().toLowerCase() || null
  return { email, emailVerified: !!primary?.verified }
}

async function freePseudo(base: string) {
  let root = base.replace(/[^A-Za-z0-9_]/g, "").slice(0, 16)
  if (root.length < 3) root = `joueur${root}`
  if ([HOUSE_PSEUDO, MANAGER_PSEUDO].includes(root.toLowerCase())) root = `${root}_j`
  let pseudo = root
  for (let i = 0; await prisma.user.findUnique({ where: { pseudo } }); i++) {
    pseudo = `${root.slice(0, 15)}${Math.floor(1000 + Math.random() * 9000)}`
    if (i > 20) pseudo = `joueur${Date.now().toString(36)}`
  }
  return pseudo
}

function isProtectedAccount(u: { pseudo: string; role: string }) {
  return u.pseudo.toLowerCase() === HOUSE_PSEUDO.toLowerCase() || PRIVILEGED_ROLES.includes(u.role)
}

/**
 * Idempotent : 1. par clerkId ; 2. par e-mail vérifié (ancien compte) ;
 * 3. création + bonus dans une transaction. clerkId unique => pas de double bonus.
 */
export async function ensurePlayerFromClerk(d: ClerkPlayerData) {
  const byId = await prisma.user.findUnique({ where: { clerkId: d.clerkId } })
  if (byId) return byId
  const email = d.email
  if (!email) return null
  // Comptes spéciaux : e-mail vérifié => relié au User maison/manager existant.
  const special = specialAccountFor(email)
  if (special) {
    if (!d.emailVerified) return null
    const target = await prisma.user.findUnique({ where: { pseudo: special.pseudo } })
    if (!target || target.role !== special.role) return null
    if (target.clerkId && target.clerkId !== d.clerkId) return null
    try {
      return await prisma.user.update({ where: { id: target.id }, data: { clerkId: d.clerkId } })
    } catch {
      return prisma.user.findUnique({ where: { clerkId: d.clerkId } })
    }
  }
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    if (existing.clerkId && existing.clerkId !== d.clerkId) return null
    if (!d.emailVerified || isProtectedAccount(existing)) return null
    try {
      return await prisma.user.update({ where: { id: existing.id }, data: { clerkId: d.clerkId } })
    } catch {
      return prisma.user.findUnique({ where: { clerkId: d.clerkId } })
    }
  }
  try {
    const pseudo = await freePseudo(d.username ?? email.split("@")[0])
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          clerkId: d.clerkId,
          pseudo,
          email,
          poky: SIGNUP_POKY,
          pokyBonus: SIGNUP_POKY,
          lion: 0,
          adult: true,
          role: ROLE_JOUEUR,
        },
      })
      await tx.walletTx.create({
        data: { userId: user.id, currency: "poky", amount: SIGNUP_POKY, reason: "bonus de bienvenue" },
      })
      return user
    })
  } catch {
    // Création concurrente (webhook + connexion) : on relit.
    return prisma.user.findUnique({ where: { clerkId: d.clerkId } })
  }
}

/** user.updated : synchronise seulement l'e-mail (vérifié et libre). Rien sur l'argent. */
export async function syncPlayerEmail(d: ClerkPlayerData) {
  const user = await prisma.user.findUnique({ where: { clerkId: d.clerkId } })
  if (!user || !d.email || !d.emailVerified || user.email === d.email) return
  const taken = await prisma.user.findUnique({ where: { email: d.email } })
  if (taken && taken.id !== user.id) return
  try {
    await prisma.user.update({ where: { id: user.id }, data: { email: d.email } })
  } catch {
    /* conflit concurrent : on ignore */
  }
}

/** user.deleted : délie le compte, conserve portefeuille et historique. */
export async function unlinkClerkUser(clerkId: string) {
  await prisma.user.updateMany({ where: { clerkId }, data: { clerkId: null } })
}
