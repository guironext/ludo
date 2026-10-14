import Link from "next/link"
import { GameCards } from "@/components/games/GameCards"
import { currentUser, homeForRole } from "@/lib/auth"
import {
  FREE_STAKE_POKY,
  LEVEL_STAKE_LION,
  PLATINUM_MIN_LION,
  ROLE_JOUEUR,
  SIGNUP_POKY,
  VIP_TABLE_MIN_LION,
  WINNER_SHARE_BPS,
} from "@/lib/rules"

export const dynamic = "force-dynamic"

const WIN_PCT = WINNER_SHARE_BPS / 100

const LEVELS = [
  { id: "gratuit", icon: "🎲", name: "Gratuit", stake: `${FREE_STAKE_POKY} poky` },
  { id: "defi", icon: "⚔️", name: "Défi", stake: `${LEVEL_STAKE_LION} Lion` },
  { id: "argent", icon: "🥈", name: "Argent", stake: `${LEVEL_STAKE_LION} Lion` },
  { id: "or", icon: "🥇", name: "Or", stake: `${LEVEL_STAKE_LION} Lion` },
  { id: "platinium", icon: "💎", name: "Platinium", stake: `Dès ${PLATINUM_MIN_LION} Lion` },
  { id: "vip", icon: "👑", name: "VIP", stake: `Dès ${VIP_TABLE_MIN_LION} Lion` },
]

export default async function Home() {
  const user = await currentUser()
  const joueur = user?.role === ROLE_JOUEUR
  const primary = user ? { href: user ? homeForRole(user.role) : "/joueur", label: "Jouer" } : { href: "/inscription", label: `Recevoir ${SIGNUP_POKY} poky` }
  const secondary = user ? { href: "#jeux", label: "Voir les jeux" } : { href: "/connexion", label: "J'ai déjà un compte" }

  return (
    <div className="ba-home">
      <section className="ba-hero" aria-labelledby="ba-title">
        <div className="ba-hero-copy">
          <p className="ba-eyebrow">Ludo · Dames · Échecs · Awalé · Scrabble</p>
          <h1 id="ba-title">
            Bienvenue sur <span>Baobab Arena</span>
          </h1>
          <p className="ba-lede">
            Quatre jeux, un seul compte. Joue contre l&apos;ordinateur ou défie tes amis en ligne, avec des mises en poky et en Lion. Le gagnant empoche {WIN_PCT} % du pot.
          </p>
          <div className="ba-actions">
            <Link href={primary.href} className="ba-btn ba-btn-gold">
              {primary.label}
            </Link>
            <Link href={secondary.href} className="ba-btn ba-btn-ghost">
              {secondary.label}
            </Link>
          </div>
          <ul className="ba-facts" aria-label="En bref">
            <li><strong>{SIGNUP_POKY}</strong> poky offerts</li>
            <li><strong>4</strong> jeux</li>
            <li><strong>{WIN_PCT} %</strong> au gagnant</li>
          </ul>
        </div>
        <div className="ba-hero-art" aria-hidden="true">
          <svg viewBox="0 0 200 200" className="ba-tree">
            <defs>
              <linearGradient id="baGold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#f6dc8e" />
                <stop offset="1" stopColor="#b98d2c" />
              </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="92" fill="none" stroke="url(#baGold)" strokeOpacity=".35" strokeWidth="2" strokeDasharray="4 8" />
            <path d="M88 170 C90 140 86 120 74 104 M112 170 C110 140 114 120 126 104 M92 120 C80 96 60 90 46 92 M108 120 C120 96 140 90 154 92 M100 112 L100 72" stroke="url(#baGold)" strokeWidth="7" strokeLinecap="round" fill="none" />
            <path d="M84 172 H116 L110 128 H90 Z" fill="url(#baGold)" />
            <ellipse cx="100" cy="64" rx="58" ry="26" fill="url(#baGold)" opacity=".9" />
            <ellipse cx="54" cy="86" rx="22" ry="12" fill="url(#baGold)" opacity=".75" />
            <ellipse cx="146" cy="86" rx="22" ry="12" fill="url(#baGold)" opacity=".75" />
          </svg>
          <div className="ba-pot">
            <span>Le gagnant empoche</span>
            <strong>{WIN_PCT} %</strong>
            <span>des mises</span>
          </div>
        </div>
      </section>

      <section id="jeux" className="ba-section ba-games" aria-labelledby="choix-jeu">
        <div className="ba-head">
          <p className="ba-eyebrow">Un compte, une caisse</p>
          <h2 id="choix-jeu">Choisis ton jeu</h2>
          <p>Ton solde poky et Lion te suit dans les quatre jeux.</p>
        </div>
        <GameCards loggedIn={joueur} />
      </section>

      <section className="ba-section" aria-labelledby="ba-how">
        <div className="ba-head">
          <p className="ba-eyebrow">Simple et rapide</p>
          <h2 id="ba-how">Comment ça marche</h2>
        </div>
        <ol className="ba-steps">
          <li>
            <span className="ba-step-n">1</span>
            <h3>Inscris-toi</h3>
            <p>Un seul compte pour Ludo, Dames, Échecs, Awalé et Scrabble.</p>
          </li>
          <li>
            <span className="ba-step-n">2</span>
            <h3>Reçois {SIGNUP_POKY} poky</h3>
            <p>Offerts à l&apos;inscription pour commencer à jouer tout de suite.</p>
          </li>
          <li>
            <span className="ba-step-n">3</span>
            <h3>Choisis ta table et gagne</h3>
            <p>Le gagnant empoche {WIN_PCT} % du pot.</p>
          </li>
        </ol>
      </section>

     

      <footer className="ba-footer">
        <span className="ba-footer-brand">Baobab Arena</span>
        <nav aria-label="Pied de page">
          {user ? <Link href={homeForRole(user.role)}>Jouer</Link> : <Link href="/inscription">Créer un compte</Link>}
          {user ? null : <Link href="/connexion">Connexion</Link>}
          <a href="#jeux">Les jeux</a>
        </nav>
        <small>© {new Date().getFullYear()} Baobab Arena · Ludo, Dames, Échecs, Awalé, Scrabble</small>
      </footer>
    </div>
  )
}
