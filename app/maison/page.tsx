import Link from "next/link"
import { requireMaison } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { STAKE_REASONS, daysAgo, findHouse, fmt, fmtSigned, startOfToday, sumByCurrency, type Sums } from "@/lib/maison"

export const dynamic = "force-dynamic"

const CHART_DAYS = 14

function Kpi({ label, value, hint, tone }: { label: string; value: Sums; hint?: string; tone?: string }) {
  return (
    <article className="maison-kpi" data-tone={tone}>
      <span>{label}</span>
      <strong>{fmtSigned(value.poky)} <small>poky</small></strong>
      <strong>{fmtSigned(value.lion)} <small>Lion</small></strong>
      {hint ? <em>{hint}</em> : null}
    </article>
  )
}

export default async function MaisonOverview({ searchParams }: { searchParams: Promise<{ devise?: string }> }) {
  await requireMaison()
  const { devise } = await searchParams
  const currency = devise === "lion" ? "lion" : "poky"
  const house = await findHouse()
  if (!house) return <p className="maison-empty">Compte maison introuvable.</p>

  const houseGame = { userId: house.id, gameId: { not: null } }
  const net = (since?: Date) =>
    prisma.walletTx.groupBy({ by: ["currency"], where: { ...houseGame, ...(since ? { createdAt: { gte: since } } : {}) }, _sum: { amount: true } })

  const [today, d7, d30, all, commission, games, byStatus, stakes, payouts, chartRows] = await Promise.all([
    net(startOfToday()),
    net(daysAgo(7)),
    net(daysAgo(30)),
    net(),
    prisma.walletTx.groupBy({ by: ["currency"], where: { userId: house.id, reason: "commission" }, _sum: { amount: true } }),
    prisma.game.count(),
    prisma.game.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.walletTx.groupBy({ by: ["currency"], where: { reason: { in: STAKE_REASONS } }, _sum: { amount: true } }),
    prisma.walletTx.groupBy({ by: ["currency"], where: { reason: "gain", userId: { not: house.id } }, _sum: { amount: true } }),
    prisma.walletTx.findMany({ where: { ...houseGame, currency, createdAt: { gte: daysAgo(CHART_DAYS) } }, select: { amount: true, createdAt: true } }),
  ])

  const stakeSums = sumByCurrency(stakes)
  const days: { key: string; label: string; value: number }[] = []
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const d = startOfToday()
    d.setDate(d.getDate() - i)
    days.push({ key: d.toDateString(), label: `${d.getDate()}/${d.getMonth() + 1}`, value: 0 })
  }
  for (const r of chartRows) {
    const day = days.find((d) => d.key === new Date(r.createdAt).toDateString())
    if (day) day.value += r.amount
  }
  const max = Math.max(1, ...days.map((d) => Math.abs(d.value)))
  const statusCount = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0

  return (
    <>
      <header className="maison-head">
        <h1>Vue d&apos;ensemble</h1>
        <p>Résultat de la maison calculé sur les vraies transactions des parties.</p>
      </header>

      <section className="maison-kpis">
        <article className="maison-kpi" data-tone="gold">
          <span>Solde de la maison</span>
          <strong>{fmt(house.poky)} <small>poky</small></strong>
          <strong>{fmt(house.lion)} <small>Lion</small></strong>
        </article>
        <Kpi label="Gains aujourd'hui" value={sumByCurrency(today)} />
        <Kpi label="Gains 7 jours" value={sumByCurrency(d7)} />
        <Kpi label="Gains 30 jours" value={sumByCurrency(d30)} />
        <Kpi label="Gains au total" value={sumByCurrency(all)} hint="Résultat net des parties" tone="gold" />
        <Kpi label="Commissions 20 %" value={sumByCurrency(commission)} hint="Prélevées sur les pots gagnés par des joueurs" />
        <article className="maison-kpi">
          <span>Parties</span>
          <strong>{fmt(games)}</strong>
          <em>{statusCount("finished")} terminées · {statusCount("playing")} en cours · {statusCount("waiting")} en attente</em>
        </article>
        <Kpi label="Mises engagées" value={{ poky: -stakeSums.poky, lion: -stakeSums.lion }} hint="Toutes les mises débitées" />
        <Kpi label="Versé aux gagnants" value={sumByCurrency(payouts)} hint="80 % des pots gagnés" />
      </section>

      <section className="maison-panel">
        <div className="maison-panel-head">
          <h2>Gains quotidiens · {CHART_DAYS} jours</h2>
          <div className="maison-toggle">
            <Link href="/maison" className={currency === "poky" ? "active" : undefined}>poky</Link>
            <Link href="/maison?devise=lion" className={currency === "lion" ? "active" : undefined}>Lion</Link>
          </div>
        </div>
        <div className="maison-chart" role="img" aria-label={`Gains quotidiens de la maison en ${currency}`}>
          {days.map((d) => (
            <div key={d.key} className="maison-chart-col" title={`${d.label} : ${fmtSigned(d.value)} ${currency}`}>
              <span className="maison-chart-val">{d.value ? fmtSigned(d.value) : ""}</span>
              <div className="maison-chart-track">
                <div className={`maison-chart-bar${d.value < 0 ? " neg" : ""}`} style={{ height: `${(Math.abs(d.value) / max) * 100}%` }} />
              </div>
              <span className="maison-chart-day">{d.label}</span>
            </div>
          ))}
        </div>
      </section>

      <p className="maison-note">
        Gains = somme des mouvements du portefeuille maison liés aux parties : commissions, pots gagnés par l&apos;ordinateur et mises rendues,
        moins les mises que la maison paie pour l&apos;ordinateur.
      </p>
    </>
  )
}
