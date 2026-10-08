import { AdminUsers, type AdminGain, type AdminSalon, type AdminSalonUser } from "@/components/AdminUsers"
import { isOnline, requireManager } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  EUR_FOR_100_FCFA,
  FCFA_PER_LION,
  HOUSE_PSEUDO,
  LEVELS,
  POKY_PER_LION,
  ROLE_JOUEUR,
  ROLE_MAISON,
  ROLE_MANAGER,
  eurFromLion,
  fcfaFromLion,
} from "@/lib/rules"

export const dynamic = "force-dynamic"

const playReasons = ["mise", "nouvelle mise", "mise défi VIP", "gain", "commission", "gain ordinateur"]

function gainFrom(poky: number, lion: number): AdminGain {
  const lionEquivalent = lion + poky / POKY_PER_LION
  return { poky, lion, fcfa: fcfaFromLion(lionEquivalent), eur: eurFromLion(lionEquivalent) }
}

const roleOrder = [
  { role: ROLE_MANAGER, label: "Admin" },
  { role: ROLE_JOUEUR, label: "Joueurs" },
  { role: ROLE_MAISON, label: "Maison" },
] as const

export default async function AdminPage() {
  const me = await requireManager()
  const [users, house, seats] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, pseudo: true, email: true, role: true, poky: true, lion: true, welcomeBonusRepaid: true, lastSeen: true },
      orderBy: { pseudo: "asc" },
    }),
    prisma.user.findUnique({ where: { pseudo: HOUSE_PSEUDO }, select: { id: true } }),
    prisma.gamePlayer.findMany({
      where: { isAi: false, userId: { not: null } },
      select: {
        game: { select: { level: true } },
        user: { select: { id: true, pseudo: true, email: true, poky: true, lion: true } },
      },
    }),
  ])
  const [totals, play] = await Promise.all([
    house
      ? prisma.walletTx.groupBy({
          by: ["currency"],
          where: { userId: house.id },
          _sum: { amount: true },
        })
      : Promise.resolve([]),
    prisma.walletTx.findMany({
      where: { reason: { in: playReasons } },
      select: { userId: true, currency: true, amount: true, gameId: true },
    }),
  ])
  const gameIds = [...new Set(play.flatMap((tx) => (tx.gameId ? [tx.gameId] : [])))]
  const games = gameIds.length
    ? await prisma.game.findMany({ where: { id: { in: gameIds } }, select: { id: true, level: true } })
    : []
  const levelByGame = new Map(games.map((game) => [game.id, game.level]))
  const byUser = new Map<string, { poky: number; lion: number }>()
  const byUserLevel = new Map<string, { poky: number; lion: number }>()
  for (const tx of play) {
    const total = byUser.get(tx.userId) ?? { poky: 0, lion: 0 }
    const salonLevel = tx.gameId ? levelByGame.get(tx.gameId) : undefined
    const salon = salonLevel ? (byUserLevel.get(`${tx.userId}:${salonLevel}`) ?? { poky: 0, lion: 0 }) : null
    if (tx.currency === "lion") {
      total.lion += tx.amount
      if (salon) salon.lion += tx.amount
    } else if (tx.currency === "poky") {
      total.poky += tx.amount
      if (salon) salon.poky += tx.amount
    }
    byUser.set(tx.userId, total)
    if (salon && salonLevel) byUserLevel.set(`${tx.userId}:${salonLevel}`, salon)
  }
  const poky = totals.find((row) => row.currency === "poky")?._sum.amount ?? 0
  const lion = totals.find((row) => row.currency === "lion")?._sum.amount ?? 0
  const lionEquivalent = lion + poky / POKY_PER_LION
  const now = Date.now()
  const withGain = users.map((user) => {
    const purse = byUser.get(user.id)
    return {
      id: user.id,
      pseudo: user.pseudo,
      email: user.email,
      role: user.role,
      poky: user.poky,
      lion: user.lion,
      welcomeBonusRepaid: user.welcomeBonusRepaid,
      online: isOnline(user.lastSeen, now),
      gain: gainFrom(purse?.poky ?? 0, purse?.lion ?? 0),
    }
  })
  const known = new Set<string>(roleOrder.map((group) => group.role))
  const groups = [
    ...roleOrder.map((group) => ({
      ...group,
      users: withGain.filter((user) => user.role === group.role),
    })),
    ...Array.from(new Set(withGain.map((user) => user.role).filter((role) => !known.has(role)))).map((role) => ({
      role,
      label: role,
      users: withGain.filter((user) => user.role === role),
    })),
  ]
  const bySalon = new Map<string, Map<string, AdminSalonUser>>()
  for (const seat of seats) {
    if (!seat.user) continue
    const bucket = bySalon.get(seat.game.level) ?? new Map<string, AdminSalonUser>()
    const current = bucket.get(seat.user.id)
    if (current) current.games += 1
    else {
      const purse = byUserLevel.get(`${seat.user.id}:${seat.game.level}`)
      bucket.set(seat.user.id, { ...seat.user, games: 1, gain: gainFrom(purse?.poky ?? 0, purse?.lion ?? 0) })
    }
    bySalon.set(seat.game.level, bucket)
  }
  const knownLevels = new Set<string>(LEVELS.map((level) => level.id))
  const salons: AdminSalon[] = [
    ...LEVELS.map((level) => ({
      id: level.id,
      label: level.label,
      stake: level.currency === "poky" ? `${level.stake} poky` : level.custom ? `dès ${level.stake} Lion` : `${level.stake} Lion`,
      users: [...(bySalon.get(level.id)?.values() ?? [])].sort((a, b) => a.pseudo.localeCompare(b.pseudo, "fr")),
    })),
    ...[...bySalon.keys()]
      .filter((level) => !knownLevels.has(level))
      .map((level) => ({
        id: level,
        label: level,
        stake: "",
        users: [...(bySalon.get(level)?.values() ?? [])].sort((a, b) => a.pseudo.localeCompare(b.pseudo, "fr")),
      })),
  ]

  return (
    <AdminUsers
      groups={groups}
      meId={me.id}
      earnings={{
        poky,
        lion,
        fcfa: fcfaFromLion(lionEquivalent),
        eur: eurFromLion(lionEquivalent),
        rate: `${POKY_PER_LION} poky = 1 Lion · 1 Lion = ${FCFA_PER_LION.toLocaleString("fr-FR")} FCFA · 100 FCFA ≈ ${EUR_FOR_100_FCFA.toLocaleString("fr-FR")} €`,
      }}
      salons={salons}
    />
  )
}
