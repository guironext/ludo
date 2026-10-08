import type { Prisma } from "@prisma/client"
import { Filters, Pager } from "@/components/maison/Pager"
import { requireMaison } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { GAME_TYPES, PAGE_SIZE, PERIODS, findHouse, fmt, fmtDate, gameLabel, levelLabel, pageOf, periodStart, sumByCurrency } from "@/lib/maison"

export const dynamic = "force-dynamic"

type Params = { jeu?: string; periode?: string; page?: string }

export default async function MaisonVersements({ searchParams }: { searchParams: Promise<Params> }) {
  await requireMaison()
  const params = await searchParams
  const page = pageOf(params.page)
  const house = await findHouse()
  const where: Prisma.WalletTxWhereInput = { reason: "gain", ...(house ? { userId: { not: house.id } } : {}) }
  const since = periodStart(params.periode)
  if (since) where.createdAt = { gte: since }
  if (params.jeu && params.jeu !== "tout") {
    const ids = await prisma.game.findMany({ where: { gameType: params.jeu }, select: { id: true } })
    where.gameId = { in: ids.map((g) => g.id) }
  }
  const [total, sums, rows] = await Promise.all([
    prisma.walletTx.count({ where }),
    prisma.walletTx.groupBy({ by: ["currency"], where, _sum: { amount: true } }),
    prisma.walletTx.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { user: { select: { pseudo: true } } } }),
  ])
  const games = await prisma.game.findMany({ where: { id: { in: rows.map((r) => r.gameId!).filter(Boolean) } }, select: { id: true, code: true, gameType: true, level: true, pot: true } })
  const s = sumByCurrency(sums)

  return (
    <>
      <header className="maison-head">
        <h1>Versements aux gagnants</h1>
        <p>Total versé : <strong>{fmt(s.poky)} poky</strong> · <strong>{fmt(s.lion)} Lion</strong> (80 % des pots)</p>
      </header>
      <Filters base="/maison/versements" params={params} groups={[{ key: "periode", label: "Période", options: PERIODS }, { key: "jeu", label: "Jeu", options: GAME_TYPES }]} />
      {rows.length === 0 ? (
        <p className="maison-empty">Aucun versement pour ces filtres.</p>
      ) : (
        <table className="maison-table">
          <thead>
            <tr><th>Date</th><th>Joueur</th><th>Jeu</th><th>Niveau</th><th>Partie</th><th className="num">Pot</th><th className="num">Versé</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const g = games.find((x) => x.id === r.gameId)
              const cur = r.currency === "lion" ? "Lion" : "poky"
              return (
                <tr key={r.id}>
                  <td data-label="Date">{fmtDate(r.createdAt)}</td>
                  <td data-label="Joueur"><strong>{r.user.pseudo}</strong></td>
                  <td data-label="Jeu">{g ? gameLabel(g.gameType) : "—"}</td>
                  <td data-label="Niveau">{g ? levelLabel(g.level) : "—"}</td>
                  <td data-label="Partie"><code>{g?.code ?? "—"}</code></td>
                  <td data-label="Pot" className="num">{g ? `${fmt(g.pot)} ${cur}` : "—"}</td>
                  <td data-label="Versé" className="num pos">{fmt(r.amount)} {cur}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <Pager base="/maison/versements" params={params} page={page} total={total} size={PAGE_SIZE} />
    </>
  )
}
