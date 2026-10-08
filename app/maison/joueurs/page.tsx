import { Pager } from "@/components/maison/Pager"
import { isOnline, requireMaison } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PAGE_SIZE, STAKE_REASONS, fmt, fmtDate, pageOf } from "@/lib/maison"
import { ROLE_JOUEUR } from "@/lib/rules"

export const dynamic = "force-dynamic"

export default async function MaisonJoueurs({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireMaison()
  const params = await searchParams
  const page = pageOf(params.page)
  const where = { role: ROLE_JOUEUR }
  const [total, totals, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.aggregate({ where, _sum: { poky: true, lion: true } }),
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ])
  const ids = users.map((u) => u.id)
  const [played, wins, staked, won] = await Promise.all([
    prisma.gamePlayer.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _count: { _all: true } }),
    prisma.game.groupBy({ by: ["winnerId"], where: { winnerId: { in: ids } }, _count: { _all: true } }),
    prisma.walletTx.groupBy({ by: ["userId", "currency"], where: { userId: { in: ids }, reason: { in: STAKE_REASONS } }, _sum: { amount: true } }),
    prisma.walletTx.groupBy({ by: ["userId", "currency"], where: { userId: { in: ids }, reason: "gain" }, _sum: { amount: true } }),
  ])
  const pick = (rows: typeof staked, id: string, cur: string) => Math.abs(rows.find((r) => r.userId === id && r.currency === cur)?._sum.amount ?? 0)
  const now = Date.now()

  return (
    <>
      <header className="maison-head">
        <h1>Joueurs</h1>
        <p>{total} joueurs · soldes cumulés : <strong>{fmt(totals._sum.poky ?? 0)} poky</strong> · <strong>{fmt(totals._sum.lion ?? 0)} Lion</strong></p>
      </header>
      {users.length === 0 ? (
        <p className="maison-empty">Aucun joueur.</p>
      ) : (
        <table className="maison-table">
          <thead>
            <tr><th>Joueur</th><th className="num">Solde</th><th className="num">Parties</th><th className="num">Victoires</th><th className="num">Misé</th><th className="num">Gagné</th><th>Vu</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td data-label="Joueur"><strong>{u.pseudo}</strong> {isOnline(u.lastSeen, now) ? <span className="maison-online">en ligne</span> : null}</td>
                <td data-label="Solde" className="num">{fmt(u.poky)} poky · {fmt(u.lion)} Lion</td>
                <td data-label="Parties" className="num">{played.find((p) => p.userId === u.id)?._count._all ?? 0}</td>
                <td data-label="Victoires" className="num">{wins.find((w) => w.winnerId === u.id)?._count._all ?? 0}</td>
                <td data-label="Misé" className="num">{fmt(pick(staked, u.id, "poky"))} poky · {fmt(pick(staked, u.id, "lion"))} Lion</td>
                <td data-label="Gagné" className="num pos">{fmt(pick(won, u.id, "poky"))} poky · {fmt(pick(won, u.id, "lion"))} Lion</td>
                <td data-label="Vu">{u.lastSeen ? fmtDate(u.lastSeen) : "jamais"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pager base="/maison/joueurs" params={params} page={page} total={total} size={PAGE_SIZE} />
    </>
  )
}
