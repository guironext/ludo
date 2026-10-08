import type { Prisma } from "@prisma/client"
import { Filters, Pager } from "@/components/maison/Pager"
import { requireMaison } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { GAME_TYPES, PAGE_SIZE, PERIODS, findHouse, fmtDate, fmtSigned, gameLabel, levelLabel, pageOf, periodStart, sumByCurrency } from "@/lib/maison"
import { LEVELS } from "@/lib/rules"

export const dynamic = "force-dynamic"

const KINDS = [
  { id: "commission", label: "Commission 20 %", reasons: ["commission"] },
  { id: "ordinateur", label: "Pot ordinateur", reasons: ["gain ordinateur"] },
  { id: "mise", label: "Mise ordinateur", reasons: ["mise", "nouvelle mise"] },
  { id: "nulle", label: "Mise rendue", reasons: ["partie nulle · mise rendue"] },
] as const

type Params = { jeu?: string; niveau?: string; periode?: string; type?: string; page?: string }

export default async function MaisonGains({ searchParams }: { searchParams: Promise<Params> }) {
  await requireMaison()
  const params = await searchParams
  const page = pageOf(params.page)
  const house = await findHouse()
  if (!house) return <p className="maison-empty">Compte maison introuvable.</p>

  const where: Prisma.WalletTxWhereInput = { userId: house.id, gameId: { not: null } }
  const since = periodStart(params.periode)
  if (since) where.createdAt = { gte: since }
  const kind = KINDS.find((k) => k.id === params.type)
  if (kind) where.reason = { in: [...kind.reasons] }
  if ((params.jeu && params.jeu !== "tout") || (params.niveau && params.niveau !== "tout")) {
    const ids = await prisma.game.findMany({
      where: {
        ...(params.jeu && params.jeu !== "tout" ? { gameType: params.jeu } : {}),
        ...(params.niveau && params.niveau !== "tout" ? { level: params.niveau } : {}),
      },
      select: { id: true },
    })
    where.gameId = { in: ids.map((g) => g.id) }
  }

  const [total, sums, rows] = await Promise.all([
    prisma.walletTx.count({ where }),
    prisma.walletTx.groupBy({ by: ["currency"], where, _sum: { amount: true } }),
    prisma.walletTx.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ])
  const games = await prisma.game.findMany({ where: { id: { in: rows.map((r) => r.gameId!).filter(Boolean) } }, select: { id: true, code: true, gameType: true, level: true } })
  const gameOf = (id: string | null) => games.find((g) => g.id === id)
  const s = sumByCurrency(sums)
  const levels = [...LEVELS.map((l) => ({ id: l.id as string, label: l.label })), ...(LEVELS.some((l) => l.id === "vip") ? [] : [{ id: "vip", label: "VIP" }])]

  return (
    <>
      <header className="maison-head">
        <h1>Gains de la maison</h1>
        <p>Total filtré : <strong>{fmtSigned(s.poky)} poky</strong> · <strong>{fmtSigned(s.lion)} Lion</strong></p>
      </header>
      <Filters
        base="/maison/gains"
        params={params}
        groups={[
          { key: "periode", label: "Période", options: PERIODS },
          { key: "jeu", label: "Jeu", options: GAME_TYPES },
          { key: "niveau", label: "Niveau", options: levels },
          { key: "type", label: "Type", options: KINDS },
        ]}
      />
      {rows.length === 0 ? (
        <p className="maison-empty">Aucune transaction pour ces filtres.</p>
      ) : (
        <table className="maison-table">
          <thead>
            <tr><th>Date</th><th>Type</th><th>Jeu</th><th>Niveau</th><th>Partie</th><th className="num">Montant</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const g = gameOf(r.gameId)
              return (
                <tr key={r.id}>
                  <td data-label="Date">{fmtDate(r.createdAt)}</td>
                  <td data-label="Type">{KINDS.find((k) => (k.reasons as readonly string[]).includes(r.reason))?.label ?? r.reason}</td>
                  <td data-label="Jeu">{g ? gameLabel(g.gameType) : "—"}</td>
                  <td data-label="Niveau">{g ? levelLabel(g.level) : "—"}</td>
                  <td data-label="Partie"><code>{g?.code ?? "—"}</code></td>
                  <td data-label="Montant" className={`num ${r.amount < 0 ? "neg" : "pos"}`}>{fmtSigned(r.amount)} {r.currency === "lion" ? "Lion" : "poky"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <Pager base="/maison/gains" params={params} page={page} total={total} size={PAGE_SIZE} />
    </>
  )
}
