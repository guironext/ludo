import Link from "next/link"
import { GameCards } from "@/components/games/GameCards"
import { requireJoueur } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function JeuxPage() {
  const user = await requireJoueur()
  return (
    <div className="page salons-page">
      <section className="salons-hero">
        <p className="kicker">Autres jeux</p>
        <h1>Dames, échecs ou awalé, {user.pseudo} ?</h1>
        <p>Mêmes salons et mêmes mises que le Ludo. Le gagnant empoche 80 % du pot.</p>
        <p className="vip-back">
          <Link href="/joueur">← Retour aux salons</Link>
        </p>
      </section>
      <GameCards />
    </div>
  )
}
