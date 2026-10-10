"use server"

import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { requireManager } from "@/lib/auth"
import { TX_OPTIONS, prisma } from "@/lib/db"
import { HOUSE_PSEUDO, ROLE_JOUEUR, ROLE_MAISON, ROLE_MANAGER } from "@/lib/rules"

export type AdminActionResult = { error?: string }

const roles = [ROLE_JOUEUR, ROLE_MANAGER] as const

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim()
}

function emailOf(value: string) {
  return value.toLowerCase()
}

function pseudoError(pseudo: string) {
  if (!/^[A-Za-z0-9_]{3,20}$/.test(pseudo)) {
    return "Le pseudo doit faire 3 à 20 caractères : lettres, chiffres ou _."
  }
  if (pseudo.toLowerCase() === HOUSE_PSEUDO) return "Ce pseudo est réservé."
  return null
}

function emailError(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Adresse e-mail invalide."
  return null
}

function amountError(raw: string, label: string) {
  if (!/^\d+$/.test(raw)) return `${label} doit être un nombre entier positif ou nul.`
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value > 2_000_000_000) return `${label} est trop grand.`
  return null
}

function uniqueMessage(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return null
  const target = Array.isArray(error.meta?.target) ? error.meta.target.join(" ") : String(error.meta?.target ?? "")
  if (target.includes("email")) return "Cet e-mail est déjà utilisé."
  return "Ce pseudo est déjà utilisé."
}

async function taken(pseudo: string, email: string, exceptId?: string) {
  const existing = await prisma.user.findFirst({
    where: {
      id: exceptId ? { not: exceptId } : undefined,
      OR: [{ pseudo }, { email }],
    },
    select: { pseudo: true, email: true },
  })
  if (!existing) return null
  if (existing.email === email) return "Cet e-mail est déjà utilisé."
  return "Ce pseudo est déjà utilisé."
}

export async function ajouterUtilisateur(formData: FormData): Promise<AdminActionResult> {
  await requireManager()
  const pseudo = text(formData, "pseudo")
  const email = emailOf(text(formData, "email"))
  const password = String(formData.get("password") ?? "")
  const role = text(formData, "role")
  const pokyRaw = text(formData, "poky")
  const lionRaw = text(formData, "lion")
  const invalid =
    pseudoError(pseudo) ||
    emailError(email) ||
    (password.length < 8 ? "Le mot de passe doit contenir au moins 8 caractères." : null) ||
    (!roles.includes(role as (typeof roles)[number]) ? "Rôle invalide." : null) ||
    amountError(pokyRaw, "Le poky") ||
    amountError(lionRaw, "Le Lion")
  if (invalid) return { error: invalid }
  const conflict = await taken(pseudo, email)
  if (conflict) return { error: conflict }
  const poky = Number(pokyRaw)
  const lion = Number(lionRaw)
  try {
    const user = await prisma.user.create({
      data: {
        pseudo,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        poky,
        pokyBonus: role === ROLE_JOUEUR ? poky : 0,
        lion,
        adult: true,
        role,
      },
    })
    const txs = [
      poky > 0 ? { userId: user.id, currency: "poky", amount: poky, reason: "création admin" } : null,
      lion > 0 ? { userId: user.id, currency: "lion", amount: lion, reason: "création admin" } : null,
    ].filter((row) => row !== null)
    if (txs.length) await prisma.walletTx.createMany({ data: txs })
  } catch (error) {
    const message = uniqueMessage(error)
    if (message) return { error: message }
    throw error
  }
  revalidatePath("/admin")
  return {}
}

export async function modifierUtilisateur(formData: FormData): Promise<AdminActionResult> {
  const me = await requireManager()
  const id = text(formData, "id")
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) return { error: "Compte introuvable." }
  const house = user.role === ROLE_MAISON || user.pseudo === HOUSE_PSEUDO
  const pseudo = house ? user.pseudo : text(formData, "pseudo")
  const email = emailOf(text(formData, "email"))
  const password = String(formData.get("password") ?? "")
  const requestedRole = text(formData, "role")
  const role = house || user.id === me.id ? user.role : requestedRole
  const pokyRaw = text(formData, "poky")
  const lionRaw = text(formData, "lion")
  const invalid =
    (house ? null : pseudoError(pseudo)) ||
    emailError(email) ||
    (password.length > 0 && password.length < 8 ? "Le mot de passe doit contenir au moins 8 caractères." : null) ||
    (house || user.id === me.id
      ? null
      : !roles.includes(role as (typeof roles)[number])
        ? "Rôle invalide."
        : null) ||
    amountError(pokyRaw, "Le poky") ||
    amountError(lionRaw, "Le Lion")
  if (invalid) return { error: invalid }
  const conflict = await taken(pseudo, email, user.id)
  if (conflict) return { error: conflict }
  const poky = Number(pokyRaw)
  const lion = Number(lionRaw)
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          pseudo,
          email,
          role,
          poky,
          lion,
          ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
        },
      })
      const txs = [
        poky !== user.poky
          ? { userId: user.id, currency: "poky", amount: poky - user.poky, reason: "ajustement admin" }
          : null,
        lion !== user.lion
          ? { userId: user.id, currency: "lion", amount: lion - user.lion, reason: "ajustement admin" }
          : null,
      ].filter((row) => row !== null)
      if (txs.length) await tx.walletTx.createMany({ data: txs })
    }, TX_OPTIONS)
  } catch (error) {
    const message = uniqueMessage(error)
    if (message) return { error: message }
    throw error
  }
  revalidatePath("/admin")
  return {}
}

export async function supprimerUtilisateur(userId: string): Promise<AdminActionResult> {
  const me = await requireManager()
  if (userId === me.id) return { error: "Vous ne pouvez pas supprimer votre propre compte." }
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return { error: "Compte introuvable." }
  if (user.role === ROLE_MAISON || user.pseudo === HOUSE_PSEUDO) {
    return { error: "Le compte maison ne peut pas être supprimé." }
  }
  const house = await prisma.user.findUnique({ where: { pseudo: HOUSE_PSEUDO }, select: { id: true } })
  await prisma.$transaction(async (tx) => {
    if (house) {
      await tx.game.updateMany({ where: { creatorId: user.id }, data: { creatorId: house.id } })
    } else {
      const games = await tx.game.findMany({ where: { creatorId: user.id }, select: { id: true } })
      const ids = games.map((game) => game.id)
      if (ids.length) {
        await tx.invite.deleteMany({ where: { gameId: { in: ids } } })
        await tx.game.deleteMany({ where: { id: { in: ids } } })
      }
    }
    await tx.walletTx.deleteMany({ where: { userId: user.id } })
    await tx.gamePlayer.updateMany({ where: { userId: user.id }, data: { userId: null } })
    await tx.invite.updateMany({ where: { userId: user.id }, data: { userId: null } })
    await tx.user.delete({ where: { id: user.id } })
  }, TX_OPTIONS)
  revalidatePath("/admin")
  return {}
}
