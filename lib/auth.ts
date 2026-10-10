import { auth, currentUser as clerkCurrentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { prisma } from "./db"
import { ROLE_JOUEUR, ROLE_MAISON, ROLE_MANAGER } from "./rules"
import { ensurePlayerFromClerk, pickPrimaryEmail } from "./clerk-sync"

const TOUCH_MS = 20_000
/** Un compte est connecté s'il a été vu dans cette fenêtre. */
export const ONLINE_MS = 90_000

export function isOnline(lastSeen: Date | null, now = Date.now()) {
  return lastSeen != null && now - lastSeen.getTime() <= ONLINE_MS
}

/**
 * Joueur lié au compte Clerk connecté :
 * 1. par clerkId ; 2. sinon par e-mail (ancien compte, portefeuille conservé) ;
 * 3. sinon création avec le bonus de bienvenue.
 */
async function findOrLinkPlayer(clerkId: string) {
  const byId = await prisma.user.findUnique({ where: { clerkId } })
  if (byId) return byId
  const cu = await clerkCurrentUser()
  if (!cu || cu.id !== clerkId) return null
  const { email, emailVerified } = pickPrimaryEmail(
    cu.emailAddresses.map((e) => ({ id: e.id, address: e.emailAddress, verified: e.verification?.status === "verified" })),
    cu.primaryEmailAddressId,
  )
  return ensurePlayerFromClerk({ clerkId, email, emailVerified, username: cu.username ?? null })
}

export async function readUserId() {
  const { userId } = await auth()
  if (!userId) return null
  const user = await findOrLinkPlayer(userId)
  return user?.id ?? null
}

export async function currentUser() {
  const { userId } = await auth()
  if (!userId) return null
  const user = await findOrLinkPlayer(userId)
  if (!user) return null
  if (!user.lastSeen || Date.now() - user.lastSeen.getTime() > TOUCH_MS) {
    const lastSeen = new Date()
    await prisma.user.update({ where: { id: user.id }, data: { lastSeen } })
    return { ...user, lastSeen }
  }
  return user
}

/** Alias explicite. */
export const getCurrentPlayer = currentUser

export async function requireUser() {
  const user = await currentUser()
  if (!user) redirect("/connexion")
  return user
}

export function partiePath(code: string) {
  return `/joueur/partie/${code}`
}

export function homeForRole(role: string) {
  if (role === ROLE_MANAGER) return "/admin"
  if (role === ROLE_MAISON) return "/maison"
  if (role === ROLE_JOUEUR) return "/joueur"
  return "/"
}

export async function requireJoueur() {
  const user = await requireUser()
  if (user.role !== ROLE_JOUEUR) redirect(homeForRole(user.role))
  return user
}

export async function requireManager() {
  const user = await requireUser()
  if (user.role !== ROLE_MANAGER) redirect(homeForRole(user.role))
  return user
}

/** Tableau de bord de la maison : rôle maison (et manager en lecture). */
export async function requireMaison() {
  const user = await requireUser()
  if (user.role !== ROLE_MAISON && user.role !== ROLE_MANAGER) redirect(homeForRole(user.role))
  return user
}
