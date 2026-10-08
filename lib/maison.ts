import { prisma } from "./db"
import { HOUSE_PSEUDO, LEVELS, ROLE_MAISON } from "./rules"

export const PAGE_SIZE = 20

export const GAME_TYPES = [
  { id: "ludo", label: "Ludo" },
  { id: "dames", label: "Dames" },
  { id: "echecs", label: "Échecs" },
  { id: "awale", label: "Awalé" },
] as const

export const PERIODS = [
  { id: "tout", label: "Tout" },
  { id: "jour", label: "Aujourd'hui" },
  { id: "7j", label: "7 jours" },
  { id: "30j", label: "30 jours" },
] as const

export const STATUS_LABELS: Record<string, string> = {
  waiting: "En attente",
  playing: "En cours",
  finished: "Terminée",
  cancelled: "Annulée",
}

/** Raisons des transactions de mise (débits des joueurs ou de la maison pour l'ordinateur). */
export const STAKE_REASONS = ["mise", "nouvelle mise", "mise défi VIP"]

export function gameLabel(id: string) {
  return GAME_TYPES.find((g) => g.id === id)?.label ?? id
}
export function levelLabel(id: string) {
  return LEVELS.find((l) => l.id === id)?.label ?? (id === "vip" ? "VIP" : id)
}

export function startOfToday(now = new Date()) {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d
}
export function daysAgo(days: number, now = new Date()) {
  const d = startOfToday(now)
  d.setDate(d.getDate() - (days - 1))
  return d
}
export function periodStart(period: string | undefined): Date | undefined {
  if (period === "jour") return startOfToday()
  if (period === "7j") return daysAgo(7)
  if (period === "30j") return daysAgo(30)
  return undefined
}

export async function findHouse() {
  return (
    (await prisma.user.findFirst({ where: { role: ROLE_MAISON }, orderBy: { createdAt: "asc" } })) ??
    (await prisma.user.findUnique({ where: { pseudo: HOUSE_PSEUDO } }))
  )
}

export function pageOf(raw: string | undefined) {
  const n = Number.parseInt(raw ?? "1", 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}

export function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n)
}
export function fmtSigned(n: number) {
  return `${n > 0 ? "+" : ""}${fmt(n)}`
}
export function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Abidjan" }).format(d)
}

export type Sums = { poky: number; lion: number }
export function sumByCurrency(rows: { currency: string; _sum: { amount: number | null } }[]): Sums {
  const out = { poky: 0, lion: 0 }
  for (const r of rows) {
    if (r.currency === "lion") out.lion += r._sum.amount ?? 0
    else out.poky += r._sum.amount ?? 0
  }
  return out
}

/** Construit une URL de filtre en conservant les autres paramètres. */
export function withParams(base: string, params: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const merged = { ...params, ...patch }
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(merged)) if (v && v !== "tout" && !(k === "page" && v === "1")) qs.set(k, v)
  const s = qs.toString()
  return s ? `${base}?${s}` : base
}
