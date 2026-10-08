import type { Prisma } from "@prisma/client"
import { Filters, Pager } from "@/components/maison/Pager"
import { requireMaison } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { GAME_TYPES, PAGE_SIZE, PERIODS, STATUS_LABELS, fmt, fmtDate, gameLabel, levelLabel, pageOf, periodStart } from "@/lib/maison"
import { LEVELS } from "@/lib/rules"

export const dynamic = "force-dynamic"

type Params = { jeu?: string; niveau?: string; periode?: string; statut?: string; page?: string }
const STATUSES = Object.entries(STATUS_LABELS).map(([id, label]) => ({ id, label }))

export default async function MaisonParties({ searchParams }: { searchParams: Promise<Params> }) {
  await requireMaison()
  const params = await searchParams
  const page = pageOf(params.page)
  const where: Prisma.GameWhereInput = {}
  if (params.jeu && params.jeu !== "tout") where.gameType = params.jeu
  if (params.niveau && params.niveau !== "tout") where.level = params.niveau
  if (params.statut && params.statut !== "tout") where.status = params.statut
  const since = periodStart(params.periode)
  if (since) where.createdAt = { gte: since }

  const [total, games] = await Promise.all([
    prisma.game.count({ where }),
    prisma.game.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { players: { orderBy: { seat: "asc" } } },
    }),
  ])
  const winnerIds = games.map((g) => g.winnerId).filter((x): x is string => Boolean(x))
  const winners = await prisma.user.findMany({ where: { id: { in: winnerIds } }, select: { id: true, pseudo: true } })
  const levels = [...LEVELS.map((l) => ({ id: l.id as string, label: l.label })), ...(LEVELS.some((l) => l.id === "vip") ? [] : [{ id: "vip", label: "VIP" }])]

  return (
    <>
      <header className="maison-head">
        <h1>Parties</h1>
        <p>Toutes les parties, tous jeux confondus.</p>
      </header>
      <Filters
        base="/maison/parties"
        params={params}
        groups={[
          { key: "periode", label: "Période", options: PERIODS },
          { key: "jeu", label: "Jeu", options: GAME_TYPES },
          { key: "niveau", label: "Niveau", options: levels },
          { key: "statut", label: "Statut", options: STATUSES },
        ]}
      />
      {games.length === 0 ? (
        <p className="maison-empty">Aucune partie pour ces filtres.</p>
      ) : (
        <table className="maison-table">
          <thead>
            <tr><th>Date</th><th>Code</th><th>Jeu</th><th>Niveau</th><th>Statut</th><th className="num">Mise</th><th>Joueurs</th><th>Gagnant</th><th className="num">Pot</th></tr>
          </thead>
          <tbody>
            {games.map((g) => {
              const cur = g.stakeCurrency === "lion" ? "Lion" : "poky"
              const winner = g.winnerId ? winners.find((w) => w.id === g.winnerId)?.pseudo : g.status === "finished" ? "Ordinateur / nul" : "—"
              return (
                <tr key={g.id}>
                  <td data-label="Date">{fmtDate(g.createdAt)}</td>
                  <td data-label="Code"><code>{g.code}</code></td>
                  <td data-label="Jeu">{gameLabel(g.gameType)}</td>
                  <td data-label="Niveau">{levelLabel(g.level)}</td>
                  <td data-label="Statut"><span className={`maison-status s-${g.status}`}>{STATUS_LABELS[g.status] ?? g.status}</span></td>
                  <td data-label="Mise" className="num">{fmt(g.stakeAmount)} {cur}</td>
                  <td data-label="Joueurs">{g.players.map((p) => (p.isAi ? `🤖 ${p.name}` : p.name)).join(", ") || "—"}</td>
                  <td data-label="Gagnant">{winner}</td>
                  <td data-label="Pot" className="num">{fmt(g.pot)} {cur}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <Pager base="/maison/parties" params={params} page={page} total={total} size={PAGE_SIZE} />
    </>
  )
}
