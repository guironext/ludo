import Link from "next/link"
import { SalonCard, type SalonChoice } from "@/components/SalonCard"
import { GameCards } from "@/components/games/GameCards"
import { requireJoueur } from "@/lib/auth"

export const dynamic = "force-dynamic"

const salons: SalonChoice[] = [
  {
    players: 1,
    eyebrow: "Solo",
    title: "Un contre un",
    detail: "Toi contre l'ordinateur. La partie démarre tout de suite.",
    tone: "ai",
    seats: ["green", "ai"],
  },
  {
    players: 2,
    eyebrow: "Salon",
    title: "2 joueurs",
    detail: "Toi et un autre joueur. Partage le code pour qu'il s'assoie.",
    tone: "duo",
    seats: ["green", "blue"],
  },
  {
    players: 3,
    eyebrow: "Salon",
    title: "3 joueurs",
    detail: "Toi et deux autres joueurs autour de la même table.",
    tone: "trio",
    seats: ["green", "yellow", "blue"],
  },
  {
    players: 4,
    eyebrow: "Table pleine",
    title: "4 joueurs",
    detail: "Toi et trois autres joueurs. Les quatre couleurs.",
    tone: "full",
    seats: ["green", "yellow", "blue", "red"],
  },
]

export default async function JoueurPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>
}) {
  const user = await requireJoueur()
  const { erreur } = await searchParams

  return (
    <div className="page salons-page">
      <section className="salons-hero">
        <p className="kicker">Bienvenue</p>
        <h1>Choisis ta table, {user.pseudo}.</h1>
        <p>
          {user.poky.toLocaleString("fr-FR")} poky. La mise est de 50 poky. Le gagnant empoche 80 % du pot.
        </p>
      </section>
      <section className="game-picker" aria-labelledby="choix-jeu">
        <div className="game-picker-head">
          <div>
            <p className="kicker">Choisis ton jeu</p>
            <h2 id="choix-jeu">Ludo, dames, échecs ou awalé ?</h2>
          </div>
          <p>Mêmes mises, même caisse. Le gagnant prend 80 % du pot.</p>
        </div>
        <GameCards ludoHref="#salons-ludo" />
      </section>
      {erreur ? <p className="error">{erreur}</p> : null}
      <div className="vip-dock">
        <Link href="/joueur/vip" className="vip-cta">
          <span>
            <strong>Aller au salon VIP</strong>
            <small>Tables Lion, ordinateur, défis entre joueurs dès 100 Lion.</small>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
      <h2 id="salons-ludo" className="ludo-salons-title">Salons Ludo</h2>
      <section className="salon-grid" aria-label="Choisir un salon Ludo">
        {salons.map((salon) => (
          <SalonCard key={salon.players} salon={salon} href={`/joueur/salon/${salon.players}`} />
        ))}
      </section>
      <div className="pro-dock">
        <Link href="/joueur/portefeuille" className="pro-cta">
          <span>
            <strong>Passer Pro</strong>
            <small>Retire tes gains en francs CFA ou en euros.</small>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  )
}
