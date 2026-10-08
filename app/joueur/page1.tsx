import Link from "next/link"
import { partiePath, requireJoueur } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { LEVELS, POKY_PER_LION } from "@/lib/rules"

export const dynamic = "force-dynamic"

const statusLabel: Record<string, string> = {
  waiting: "En attente",
  playing: "En cours",
  finished: "Terminée",
}

function tone(id: string) {
  if (id === "gratuit") return "free"
  if (id === "platinium") return "platinum"
  return "rooms"
}

export default async function JoueurPage() {
  const user = await requireJoueur()
  const games = await prisma.game.findMany({
    where: { players: { some: { userId: user.id } } },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      code: true,
      level: true,
      status: true,
      stakeAmount: true,
      stakeCurrency: true,
      players: { select: { id: true } },
    },
  })
  const convertible = Math.max(0, user.poky - user.pokyBonus)

  return (
    <div className="page joueur-page">
      <section className="joueur-hero">
        <p className="kicker">Espace joueur</p>
        <h1>Bonjour {user.pseudo}</h1>
        <p>
          Tes soldes, tes parties, et l&apos;entrée des salons. {POKY_PER_LION} poky gagnés valent 1 Lion. Le bonus de bienvenue reste jouable en gratuit.
        </p>
        <div className="home-actions">
          <Link href="/salon" className="solid">
            Ouvrir un salon
          </Link>
          <Link href="/portefeuille" className="ghost">
            Portefeuille
          </Link>
        </div>
      </section>

      <section className="admin-gains joueur-balances" aria-label="Soldes">
        <article className="admin-gain">
          <span>Poky</span>
          <strong>{user.poky.toLocaleString("fr-FR")}</strong>
        </article>
        <article className="admin-gain admin-gain-lion">
          <span>Lion</span>
          <strong>{user.lion.toLocaleString("fr-FR")}</strong>
        </article>
        <article className="admin-gain">
          <span>Bonus</span>
          <strong>{user.pokyBonus.toLocaleString("fr-FR")}</strong>
        </article>
        <article className="admin-gain admin-gain-eur">
          <span>Convertibles</span>
          <strong>{convertible.toLocaleString("fr-FR")}</strong>
        </article>
      </section>

      <section className="home-rooms" aria-labelledby="joueur-salons">
        <div className="home-section-head">
          <p className="kicker">Salons</p>
          <h2 id="joueur-salons">Choisis une table.</h2>
        </div>
        {LEVELS.map((level) => (
          <Link key={level.id} href="/salon" className="home-card" data-tone={tone(level.id)}>
            <p className="home-stake">
              {level.custom ? `dès ${level.stake} Lion` : level.currency === "poky" ? `${level.stake} poky` : `${level.stake} Lion`}
            </p>
            <h3>{level.label}</h3>
            <p>{level.blurb}</p>
          </Link>
        ))}
      </section>

      <section>
        <h2>Mes parties</h2>
        {games.length === 0 ? <p>Aucune partie pour l&apos;instant. Ouvre un salon pour t&apos;asseoir.</p> : null}
        <ul className="rooms">
          {games.map((game) => {
            const label = LEVELS.find((level) => level.id === game.level)?.label ?? game.level
            return (
              <li key={game.id}>
                <Link href={partiePath(game.code)}>
                  <strong>{game.code}</strong>
                  <span>
                    {label} · {game.stakeAmount} {game.stakeCurrency} · {game.players.length} assis · {statusLabel[game.status] ?? game.status}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
