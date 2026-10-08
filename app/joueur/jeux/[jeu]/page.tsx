import Link from "next/link"
import { notFound } from "next/navigation"
import { ouvrirJeu, rejoindre } from "@/app/actions/game"
import { LocalGame } from "@/components/games/LocalGame"
import { requireJoueur } from "@/lib/auth"
import { GAME_LABELS, isBoardGame } from "@/lib/games/match"
import { FREE_STAKE_POKY, LEVEL_STAKE_LION, PLATINUM_MIN_LION } from "@/lib/rules"

export const dynamic = "force-dynamic"

const RULES: Record<string, string> = {
  echecs: "Règles officielles : échec, mat, pat, roque, prise en passant et promotion.",
  dames: "Dames internationales 10 × 10 : prise obligatoire et majoritaire, rafles, dames volantes.",
  awale: "Awalé abapa : semis sans la case de départ, prises de 2 ou 3, il faut nourrir l'adversaire. 25 graines gagnent.",
}

const ICONS: Record<string, string> = { gratuit: "🎲", defi: "⚔️", argent: "🥈", or: "🥇", platinium: "💎" }

function Table({
  jeu,
  level,
  players,
  title,
  detail,
  price,
  custom,
  invites,
}: {
  jeu: string
  level: string
  players: 1 | 2
  title: string
  detail: string
  price: string
  custom?: number
  invites?: boolean
}) {
  return (
    <form action={ouvrirJeu} className={`card form game-offer offer-${level}`} data-level={level}>
      <input type="hidden" name="gameType" value={jeu} />
      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="players" value={players} />
      <div className="offer-top">
        <span className="offer-badge"><span className="offer-icon" aria-hidden="true">{ICONS[level] ?? "★"}</span>{title}</span>
        <span className="offer-mode">{players === 1 ? "vs ordinateur" : "1 contre 1"}</span>
      </div>
      <p className="kicker sr-only">{players === 1 ? "Contre l'ordinateur" : "Un contre un"}</p>
      <h2>{title}</h2>
      <p className="hint">{detail}</p>
      <p className="offer-price">{price}</p>
      {custom ? (
        <label className="offer-stake">
          Mise en Lion (minimum {custom})
          <input name="stake" type="number" min={custom} defaultValue={custom} required />
        </label>
      ) : null}
      {invites ? (
        <label>
          Inviter un pseudo (facultatif)
          <input name="invites" placeholder="pseudo" />
        </label>
      ) : null}
      <button type="submit" className="offer-cta">
        {players === 1 ? "Payer et jouer" : "Payer et ouvrir la table"} · {price}
      </button>
    </form>
  )
}

export default async function JeuPage({
  params,
  searchParams,
}: {
  params: Promise<{ jeu: string }>
  searchParams: Promise<{ erreur?: string }>
}) {
  const user = await requireJoueur()
  const { jeu } = await params
  const { erreur } = await searchParams
  if (!isBoardGame(jeu)) notFound()
  const label = GAME_LABELS[jeu]

  return (
    <div className={`page salons-page jeu-page jeu-${jeu}`}>
      <section className="salons-hero jeu-hero">
        <p className="kicker">{label}</p>
        <h1>Une table de {label.toLowerCase()}, {user.pseudo} ?</h1>
        <p className="jeu-rules">{RULES[jeu]}</p>
        <p className="jeu-wallet">
          {user.poky.toLocaleString("fr-FR")} poky · {user.lion.toLocaleString("fr-FR")} Lion. Gagnant 80 % du pot.
          Partie nulle : mises rendues.
        </p>
        <p className="vip-back">
          <Link href="/joueur">← Retour aux salons</Link>
        </p>
      </section>
      {erreur ? <p className="error">{erreur}</p> : null}

      <section className="game-offers" aria-label="Choisir une table">
        <h3 className="offer-group">Gratuit</h3>
        <Table jeu={jeu} level="gratuit" players={1} title="Gratuit" detail="Toi contre l'ordinateur." price={`${FREE_STAKE_POKY} poky`} />
        <Table jeu={jeu} level="gratuit" players={2} title="Gratuit" detail="Toi et un autre joueur. Partage le code." price={`${FREE_STAKE_POKY} poky`} invites />
        <h3 className="offer-group">Mises en Lion</h3>
        <Table jeu={jeu} level="defi" players={2} title="Défi" detail="Mise fixe, un contre un." price={`${LEVEL_STAKE_LION} Lion`} invites />
        <Table jeu={jeu} level="argent" players={2} title="Argent" detail="Mise fixe, un contre un." price={`${LEVEL_STAKE_LION} Lion`} invites />
        <Table jeu={jeu} level="or" players={2} title="Or" detail="Mise fixe, un contre un." price={`${LEVEL_STAKE_LION} Lion`} invites />
        <Table jeu={jeu} level="platinium" players={2} title="Platinium" detail="Tu fixes la mise." price="mise libre" custom={PLATINUM_MIN_LION} invites />
      </section>

      <div className="vip-dock">
        <Link href={`/joueur/vip/partie?players=1&jeu=${jeu}`} className="vip-cta">
          <span>
            <strong>{label} au salon VIP</strong>
            <small>Contre l&apos;ordinateur ou un contre un, mise libre dès 5 Lion.</small>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>

      

      <section className="game-extra jeu-join">
        <form action={rejoindre} className="card form">
          <h2>Rejoindre avec un code</h2>
          <input name="code" placeholder="CODE" required />
          <button type="submit">Rejoindre</button>
        </form>
      </section>
    </div>
  )
}
