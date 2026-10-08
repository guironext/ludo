import { convertir } from "@/app/actions/game"
import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { CASHOUT_MIN_LION, POKY_PER_LION, eurFromLion, fcfaFromLion } from "@/lib/rules"

export const dynamic = "force-dynamic"

export default async function Portefeuille({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>
}) {
  const user = await requireUser()
  const { erreur } = await searchParams
  const txs = await prisma.walletTx.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 12,
  })
  const convertible = Math.max(0, user.poky - user.pokyBonus)

  return (
    <div className="page narrow">
      <section className="hero slim">
        <p className="kicker">Portefeuille</p>
        <h1>{user.lion} Lion</h1>
        <p>
          {user.poky} poky, dont {user.pokyBonus} de bonus non convertibles. {convertible} poky peuvent devenir des Lion, à raison de {POKY_PER_LION} pour 1.
        </p>
      </section>
      {erreur ? <p className="error">{erreur}</p> : null}
      <form action={convertir} className="card form">
        <h2>Convertir des poky gagnés</h2>
        <label>
          Nombre de Lion
          <input name="lions" type="number" min={1} defaultValue={1} />
        </label>
        <button type="submit">Convertir</button>
      </form>
      <section className="card">
        <h2>Retrait en argent réel</h2>
        <p>
          Fermé pour cette version. Quand il ouvrira, il faudra une pièce d&apos;identité et au moins {CASHOUT_MIN_LION.toLocaleString("fr-FR")} Lion, soit {fcfaFromLion(CASHOUT_MIN_LION).toLocaleString("fr-FR")} FCFA (environ {eurFromLion(CASHOUT_MIN_LION).toLocaleString("fr-FR")} €). Le bonus de bienvenue ne pourra pas être retiré.
        </p>
        <button type="button" disabled>
          Retirer vers une carte
        </button>
      </section>
      <section>
        <h2>Mouvements</h2>
        <ul className="rooms">
          {txs.map((tx) => (
            <li key={tx.id}>
              <strong>
                {tx.amount > 0 ? "+" : ""}
                {tx.amount} {tx.currency}
              </strong>
              <span>{tx.reason}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
