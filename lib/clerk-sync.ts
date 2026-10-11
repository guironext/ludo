import { TX_OPTIONS, prisma } from "./db"
import { HOUSE_PSEUDO, MANAGER_PSEUDO, ROLE_JOUEUR, SIGNUP_POKY } from "./rules"
import { PRIVILEGED_ROLES, specialAccountFor } from "./special-accounts"

/** Données Clerk normalisées (venant de currentUser() ou d'un webhook). */
export type ClerkPlayerData = {
  clerkId: string
  email: string | null
  emailVerified: boolean
  username: string | null
  firstName?: string | null
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

  // 1. Comptes spéciaux (maison / admin) : jamais reliés ni créés sans e-mail vérifié.
  const special = specialAccountFor(email)
  if (special) {
    if (!d.emailVerified) {
      console.warn("[clerk-sync] compte spécial avec e-mail non vérifié : ni liaison ni création", d.clerkId)
      return null
    }
    const target = await prisma.user.findUnique({ where: { pseudo: special.pseudo } })
    if (!target || target.role !== special.role || (target.clerkId && target.clerkId !== d.clerkId)) {
      console.warn("[clerk-sync] compte spécial introuvable ou déjà relié", d.clerkId, special.pseudo)
      return null
    }
    try {
      return await prisma.user.update({ where: { id: target.id }, data: { clerkId: d.clerkId } })
    } catch {
      return prisma.user.findUnique({ where: { clerkId: d.clerkId } })
    }
  }

  // 2. Ancien joueur avec le même e-mail : liaison seulement si l'e-mail est vérifié,
  //    que le compte n'est relié à personne d'autre et n'est pas un compte protégé.
  let emailForNew = email
  const existing = email ? await prisma.user.findUnique({ where: { email } }) : null
  if (existing) {
    const canLink = d.emailVerified && !existing.clerkId && !isProtectedAccount(existing)
    if (canLink) {
      try {
        return await prisma.user.update({ where: { id: existing.id }, data: { clerkId: d.clerkId } })
      } catch {
        const again = await prisma.user.findUnique({ where: { clerkId: d.clerkId } })
        if (again) return again
      }
    }
    // Pas de liaison possible : on crée quand même un joueur, avec une adresse interne
    // (l'e-mail est unique en base). Le compte Clerk n'est jamais bloqué.
    console.warn("[clerk-sync] e-mail déjà pris, nouveau joueur avec adresse interne", d.clerkId, {
      verified: d.emailVerified,
      linkedElsewhere: Boolean(existing.clerkId),
    })
    emailForNew = null
  }

  // 3. Nouveau joueur + bonus de bienvenue, dans une transaction.
  //    clerkId est unique : une seconde tentative (webhook + connexion) ne peut pas
  //    créer un second joueur ni verser un second bonus.
  const finalEmail = emailForNew ?? internalEmail(d.clerkId)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const pseudo = await freePseudo(d.username || email?.split("@")[0] || d.firstName || "joueur")
      return await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            clerkId: d.clerkId,
            pseudo,
            email: finalEmail,
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
      }, TX_OPTIONS)
    } catch (error) {
      // Création concurrente : le joueur existe déjà avec ce clerkId.
      const again = await prisma.user.findUnique({ where: { clerkId: d.clerkId } })
      if (again) return again
      // Sinon (pseudo pris entre-temps, base lente…), on réessaie avec un autre pseudo.
      console.error("[clerk-sync] création du joueur impossible, essai", attempt + 1, d.clerkId, error)
    }
  }
  return null
}

/** Adresse interne unique pour un joueur sans e-mail utilisable. */
function internalEmail(clerkId: string) {
  return `${clerkId.toLowerCase()}@joueur.baobab-arena.invalid`
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
