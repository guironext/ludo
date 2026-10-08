import Link from "next/link"

type GameId = "ludo" | "dames" | "echecs" | "awale"

const GAMES: Array<{ id: GameId; title: string; eyebrow: string; detail: string; price: string }> = [
  { id: "ludo", eyebrow: "Le classique", title: "Ludo", detail: "De 1 à 4 joueurs. Lance le dé et ramène tes quatre pions à la maison.", price: "Dès 50 poky" },
  { id: "dames", eyebrow: "10 × 10", title: "Dames", detail: "Règles internationales : prises obligatoires, rafles et dames volantes.", price: "Dès 50 poky" },
  { id: "echecs", eyebrow: "Stratégie", title: "Échecs", detail: "Le roi des jeux. Roque, prise en passant, promotion, mat.", price: "Dès 50 poky" },
  { id: "awale", eyebrow: "Tradition", title: "Awalé", detail: "Règles abapa. Sème, prends 2 ou 3 graines, atteins 25.", price: "Dès 50 poky" },
]

function MiniBoard({ id }: { id: GameId }) {
  if (id === "ludo") {
    return (
      <span className="mini-board mini-ludo" aria-hidden="true">
        <i className="green" />
        <i className="yellow" />
        <i className="blue" />
        <i className="red" />
      </span>
    )
  }
  if (id === "awale") {
    return (
      <span className="mini-board mini-awale" aria-hidden="true">
        {Array.from({ length: 12 }, (_, k) => (
          <i key={k} data-seeds={k % 3 === 0 ? 3 : 4} />
        ))}
      </span>
    )
  }
  const size = id === "dames" ? 6 : 4
  return (
    <span className={`mini-board mini-grid mini-${id}`} style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }} aria-hidden="true">
      {Array.from({ length: size * size }, (_, k) => {
        const r = Math.floor(k / size)
        const dark = (r + (k % size)) % 2 === 1
        let piece = ""
        if (id === "dames" && dark && r < 2) piece = "b"
        if (id === "dames" && dark && r > 3) piece = "w"
        if (id === "echecs") piece = k === 1 ? "♚" : k === 6 ? "♞" : k === 13 ? "♕" : k === 14 ? "♔" : ""
        return (
          <i key={k} className={dark ? "dark" : "light"}>
            {id === "dames" && piece ? <b className={piece} /> : piece}
          </i>
        )
      })}
    </span>
  )
}

/**
 * Sélecteur de jeux. Un joueur connecté va droit au jeu ; un visiteur est envoyé vers l'inscription.
 */
export function GameCards({
  loggedIn = true,
  withLudo = true,
  ludoHref = "/joueur",
}: {
  loggedIn?: boolean
  withLudo?: boolean
  ludoHref?: string
}) {
  const games = withLudo ? GAMES : GAMES.filter((game) => game.id !== "ludo")
  return (
    <section className="salon-grid game-cards" aria-label="Choisis ton jeu">
      {games.map((game) => {
        const href = !loggedIn ? "/inscription" : game.id === "ludo" ? ludoHref : `/joueur/jeux/${game.id}`
        return (
          <Link key={game.id} href={href} className="salon-card game-card" data-tone={game.id === "ludo" ? "ai" : "duo"} prefetch={false}>
            <MiniBoard id={game.id} />
            <span className="salon-copy">
              <span className="kicker">{game.eyebrow}</span>
              <strong>{game.title}</strong>
              <span>{game.detail}</span>
            </span>
            <span className="salon-foot">
              <span>{game.price}</span>
              <span>{loggedIn ? "Jouer" : "Créer un compte"}</span>
            </span>
          </Link>
        )
      })}
    </section>
  )
}
