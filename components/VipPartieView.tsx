"use client"

import Link from "next/link"
import { useState } from "react"
import { useFormStatus } from "react-dom"
import { ouvrirSalonVip } from "@/app/actions/game"
import {
  HOUSE_SHARE_BPS,
  VIP_TABLE_MIN_LION,
  WINNER_SHARE_BPS,
  fcfaFromLion,
  splitPot,
} from "@/lib/rules"
import { VIP_TABLES } from "@/lib/vip-tables"
import { BOARD_GAMES, GAME_LABELS, parseGameType } from "@/lib/games/match"

export function VipPartieView({
  lion,
  players,
  erreur,
  jeu,
}: {
  lion: number
  players: 1 | 2 | 3 | 4
  erreur?: string
  jeu?: string
}) {
  const [gameType, setGameType] = useState<string>(players <= 2 ? parseGameType(jeu) : "ludo")
  const boardGame = gameType !== "ludo"
  const [stake, setStake] = useState(String(VIP_TABLE_MIN_LION))
  const chosen = VIP_TABLES.find((item) => item.players === players) ?? VIP_TABLES[1]
  const stakeNum = Math.max(VIP_TABLE_MIN_LION, Math.floor(Number(stake)) || VIP_TABLE_MIN_LION)
  const seats = players === 1 ? 2 : players
  const pot = stakeNum * seats
  const { winner, house } = splitPot(pot)
  const housePct = HOUSE_SHARE_BPS / 100
  const winPct = WINNER_SHARE_BPS / 100

  return (
    <div className="page vip-page">
      <section className="salons-hero">
        <p className="kicker">{chosen.eyebrow}</p>
        <h1>{chosen.title}</h1>
        <p>{chosen.detail}</p>
        <p className="vip-back">
          <Link href="/joueur/vip">← Retour au salon VIP</Link>
        </p>
      </section>

      {erreur ? (
        <p className="error" role="alert">
          {erreur}
        </p>
      ) : null}

      <section className="vip-section" aria-labelledby="vip-partie-title">
        <form action={ouvrirSalonVip} className="card form vip-form">
          <h2 id="vip-partie-title">Payer et ouvrir la table</h2>
          <input type="hidden" name="players" value={players} />
          <label>
            Jeu
            <select name="gameType" value={gameType} onChange={(event) => setGameType(event.target.value)}>
              <option value="ludo">Ludo</option>
              {players <= 2
                ? BOARD_GAMES.map((id) => (
                    <option key={id} value={id}>
                      {GAME_LABELS[id]}
                    </option>
                  ))
                : null}
            </select>
          </label>
          {players > 2 ? <p className="hint">Dames, échecs et awalé se jouent à 2 : choisis la table ordinateur ou 2 joueurs.</p> : null}
          {boardGame && players === 2 ? (
            <p className="hint">
              {GAME_LABELS[parseGameType(gameType)]} : un contre un. Sans pseudo, partage le code de la table.
            </p>
          ) : null}

          <p className="hint">
            Solde : <strong>{lion.toLocaleString("fr-FR")} Lion</strong>
            {" · "}
            environ {fcfaFromLion(lion).toLocaleString("fr-FR")} FCFA
          </p>

          <label>
            Mise en Lion (minimum {VIP_TABLE_MIN_LION})
            <input
              name="stake"
              type="number"
              min={VIP_TABLE_MIN_LION}
              value={stake}
              onChange={(event) => setStake(event.target.value.replace(/[^\d]/g, ""))}
              required
            />
          </label>

          {players > 1 ? (
            <>
              <label>
                Inviter des pseudos
                <input name="invites" placeholder="ama, koffi" />
              </label>
              <label className="check">
                <input type="checkbox" name="fillAi" value="oui" />
                Compléter avec l&apos;ordinateur et lancer tout de suite
              </label>
            </>
          ) : null}

          <div className="hint" aria-live="polite">
            <p>
              Mise : <strong>{stakeNum.toLocaleString("fr-FR")} Lion</strong>
              {" · "}
              {fcfaFromLion(stakeNum).toLocaleString("fr-FR")} FCFA
            </p>
            <p>
              Pot prévu ({seats} mise{seats > 1 ? "s" : ""}) :{" "}
              <strong>{pot.toLocaleString("fr-FR")} Lion</strong>
              {" · "}
              {fcfaFromLion(pot).toLocaleString("fr-FR")} FCFA
            </p>
            <p>
              Gagnant {winPct} % : {winner.toLocaleString("fr-FR")} Lion · maison {housePct} % :{" "}
              {house.toLocaleString("fr-FR")} Lion
            </p>
          </div>

          <VipPaySubmit label={players === 1 ? "Payer et lancer contre l'ordinateur" : "Payer et créer la table VIP"} />
        </form>
      </section>
    </div>
  )
}

function VipPaySubmit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="wallet-submit" disabled={pending}>
      {pending ? "Paiement…" : label}
    </button>
  )
}
