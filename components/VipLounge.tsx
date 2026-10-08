"use client"

import Link from "next/link"
import { useState } from "react"
import { useFormStatus } from "react-dom"
import { defier, repondreDefi } from "@/app/actions/game"
import { BOARD_GAMES, GAME_LABELS } from "@/lib/games/match"
import { SalonCard } from "@/components/SalonCard"
import { VIP_TABLES } from "@/lib/vip-tables"
import { HOUSE_SHARE_BPS, VIP_CHALLENGE_MIN_LION, VIP_TABLE_MIN_LION, WINNER_SHARE_BPS } from "@/lib/rules"

export type VipChallengePending = {
  id: string
  stake: number
  createdAt: string
  incoming: boolean
  opponent: string
}

export type VipChallengeResult = {
  id: string
  stake: number
  challenger: string
  challenged: string
  winner: string
  date: string
}

export type VipOnlinePlayer = {
  id: string
  pseudo: string
  lion: number
}

export function VipLounge({
  pseudo,
  lion,
  erreur,
  pending,
  results,
  online,
}: {
  pseudo: string
  lion: number
  erreur?: string
  pending: VipChallengePending[]
  results: VipChallengeResult[]
  online: VipOnlinePlayer[]
}) {
  const [challengeStake, setChallengeStake] = useState(String(VIP_CHALLENGE_MIN_LION))
  const [target, setTarget] = useState("")
  const housePct = HOUSE_SHARE_BPS / 100
  const winPct = WINNER_SHARE_BPS / 100

  return (
    <div className="page vip-page">
      <section className="salons-hero">
        <p className="kicker">Salon VIP</p>
        <h1>Bienvenue, {pseudo}.</h1>
        <p>
          {lion.toLocaleString("fr-FR")} Lion · mise dès {VIP_TABLE_MIN_LION} Lion · gagnant {winPct} % · maison{" "}
          {housePct} %. Les défis VIP (mise libre dès {VIP_CHALLENGE_MIN_LION} Lion) sont distincts du salon Défi public
          à 20 Lion.
        </p>
        <p className="vip-back">
          <Link href="/joueur">← Retour aux salons gratuits</Link>
        </p>
      </section>

      {erreur ? (
        <p className="error" role="alert">
          {erreur}
        </p>
      ) : null}

      <section className="vip-section" aria-labelledby="vip-tables-title">
        <h2 id="vip-tables-title">Ouvrir une table VIP</h2>
        <div className="salon-grid" aria-label="Tables VIP">
          {VIP_TABLES.map((salon) => (
            <SalonCard
              key={salon.players}
              salon={salon}
              href={`/joueur/vip/partie?players=${salon.players}`}
            />
          ))}
        </div>
      </section>

      <section className="vip-section grid-2" aria-labelledby="vip-defis-title">
        <div>
          <h2 id="vip-defis-title">Défier un joueur</h2>
          <form action={defier} className="card form">
            <label>
              Jeu
              <select name="gameType" defaultValue="ludo">
                <option value="ludo">Ludo</option>
                {BOARD_GAMES.map((id) => (
                  <option key={id} value={id}>
                    {GAME_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Pseudo
              <input
                name="pseudo"
                list="vip-online"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder="pseudo du joueur"
                required
              />
            </label>
            <datalist id="vip-online">
              {online.map((player) => (
                <option key={player.id} value={player.pseudo} />
              ))}
            </datalist>
            <label>
              Mise (minimum {VIP_CHALLENGE_MIN_LION} Lion)
              <input
                name="stake"
                type="number"
                min={VIP_CHALLENGE_MIN_LION}
                value={challengeStake}
                onChange={(event) => setChallengeStake(event.target.value.replace(/[^\d]/g, ""))}
                required
              />
            </label>
            <p className="hint">
              À l&apos;acceptation, la mise est prise sur les deux soldes. Maison {housePct} %, gagnant {winPct} %.
            </p>
            <VipSubmit label="Envoyer le défi" />
          </form>
          {online.length > 0 ? (
            <ul className="vip-online">
              {online.map((player) => (
                <li key={player.id}>
                  <button type="button" className="ghost" onClick={() => setTarget(player.pseudo)}>
                    {player.pseudo}
                  </button>
                  <span>{player.lion.toLocaleString("fr-FR")} Lion</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">Aucun autre joueur connecté pour le moment.</p>
          )}
        </div>

        <div>
          <h2>Défis en cours</h2>
          {pending.length === 0 ? <p className="hint">Aucun défi en attente.</p> : null}
          <ul className="vip-pending">
            {pending.map((item) => (
              <li key={item.id} className="card">
                <p>
                  {item.incoming ? (
                    <>
                      <strong>{item.opponent}</strong> te défie pour {item.stake.toLocaleString("fr-FR")} Lion.
                    </>
                  ) : (
                    <>
                      Défi envoyé à <strong>{item.opponent}</strong> · {item.stake.toLocaleString("fr-FR")} Lion.
                    </>
                  )}
                </p>
                {item.incoming ? (
                  <div className="invite-actions">
                    <form action={repondreDefi}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="accept" value="oui" />
                      <VipSubmit label="Accepter" />
                    </form>
                    <form action={repondreDefi}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="accept" value="non" />
                      <button type="submit" className="ghost">
                        Refuser
                      </button>
                    </form>
                  </div>
                ) : (
                  <p className="hint">En attente de réponse.</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="vip-section" aria-labelledby="vip-results-title">
        <h2 id="vip-results-title">Résultats des défis (public)</h2>
        {results.length === 0 ? <p className="hint">Aucun défi terminé pour l&apos;instant.</p> : null}
        <div className="admin-table-wrap">
          <table className="admin-table vip-results">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Joueurs</th>
                <th scope="col" className="num">
                  Mise
                </th>
                <th scope="col">Gagnant</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={row.id}>
                  <td>{formatWhen(row.date)}</td>
                  <td>
                    {row.challenger} vs {row.challenged}
                  </td>
                  <td className="num">{row.stake.toLocaleString("fr-FR")} Lion</td>
                  <td>
                    <strong>{row.winner}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function VipSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}>
      {pending ? "…" : label}
    </button>
  )
}

function formatWhen(iso: string) {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ""
  return `${part("day")} ${part("month")} ${part("hour")}:${part("minute")}`
}
