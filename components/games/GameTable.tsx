"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ajouterOrdinateur, annuler, lancer } from "@/app/actions/game"
import { GAME_LABELS, SIDE_LABELS, isBoardGame, sideOf, type BoardInput } from "@/lib/games/match"
import type { snapshot } from "@/lib/play"
import { GameSurface } from "./GameSurface"

type View = Awaited<ReturnType<typeof snapshot>>

function money(amount: number, currency: string) {
  return `${amount} ${currency === "lion" ? "Lion" : "poky"}`
}

/** Table d'échecs, de dames ou d'awalé : même salle, mêmes mises et même caisse que le Ludo. */
export function GameTable({ initial, erreur }: { initial: View; erreur?: string }) {
  const router = useRouter()
  const [data, setData] = useState(initial)
  const [error, setError] = useState(erreur ?? "")
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let stop = false
    const pull = async () => {
      const response = await fetch(`/api/partie/${initial.code}`, { cache: "no-store" })
      if (!response.ok) return
      const json = (await response.json()) as View
      if (!stop) setData(json)
    }
    const timer = setInterval(pull, data.status === "playing" ? 800 : 1600)
    return () => {
      stop = true
      clearInterval(timer)
    }
  }, [initial.code, data.status])

  async function send(body: Record<string, unknown>) {
    setBusy(true)
    setError("")
    const response = await fetch(`/api/partie/${initial.code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = await response.json()
    setBusy(false)
    if (!response.ok) {
      setError(json.error ?? "Action impossible.")
      return
    }
    setData(json)
    router.refresh()
  }

  async function invite(userId: string) {
    setBusy(true)
    setError("")
    const response = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "invite", code: data.code, userId }),
    })
    const json = await response.json()
    setBusy(false)
    if (!response.ok) setError(json.error ?? "Invitation impossible.")
  }

  async function answerInvite(accept: boolean) {
    setBusy(true)
    setError("")
    const response = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        data.yourInvite
          ? { action: accept ? "accept" : "refuse", id: data.yourInvite.id }
          : { action: accept ? "accept-link" : "refuse-link", code: data.code },
      ),
    })
    const json = await response.json()
    setBusy(false)
    if (!response.ok) {
      setError(json.error ?? "Invitation impossible.")
      return
    }
    if (!accept) {
      router.push("/joueur")
      return
    }
    router.refresh()
  }

  const game = isBoardGame(data.gameType) ? data.gameType : "echecs"
  const m = data.board
  const mine = data.yourSeat
  const mySide = m && mine != null ? sideOf(m, mine) : mine != null ? (data.seats.indexOf(mine) === 1 ? 1 : 0) : null
  const over = m != null && (m.winner != null || m.draw)
  const myTurn = m != null && !over && mine != null && m.turn === mine
  const winner = data.players.find((p) => p.seat === m?.winner)
  const turnPlayer = data.players.find((p) => p.seat === m?.turn)
  const pot = data.pot || data.stake * data.seats.length
  const sides = SIDE_LABELS[game]
  const names: [string, string] = [0, 1].map((k) => data.players.find((p) => p.seat === data.seats[k])?.name ?? sides[k]) as [
    string,
    string,
  ]
  const isMember = mine != null
  const status =
    data.status === "waiting"
      ? `${data.players.length}/${data.seats.length} joueurs`
      : over
        ? "Partie terminée"
        : myTurn
          ? "À ton tour"
          : `Tour de ${turnPlayer?.name ?? "l'autre joueur"}`

  return (
    <section className="match">
      <div className="match-board">
        <div className="match-status">
          <span className={myTurn ? "pill live" : "pill"}>{status}</span>
          <span className="pill">{GAME_LABELS[game]}</span>
          <span className="status-log">{m?.log || (data.status === "waiting" ? "La salle se remplit." : "")}</span>
        </div>
        {m ? (
          <GameSurface
            data={m.data}
            mySide={mySide}
            canPlay={myTurn && !busy}
            last={m.last}
            names={names}
            onMove={(input: BoardInput) => void send({ action: "play", ...input })}
          />
        ) : (
          <div className="gboard-wrap game-waiting">
            <p className="kicker">{GAME_LABELS[game]}</p>
            <p>Le plateau s&apos;ouvre quand les deux joueurs ont payé leur mise.</p>
          </div>
        )}
      </div>

      <aside className="match-tools">
        <div className="sheet">
          <p className="kicker">
            {GAME_LABELS[game]} · {data.levelLabel}
          </p>
          <div className="code-row">
            <h1>{data.code}</h1>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                void navigator.clipboard.writeText(data.code)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1600)
              }}
            >
              {copied ? "Copié" : "Copier"}
            </button>
          </div>
          <div className="stakes">
            <div>
              <span>Mise</span>
              <strong>{money(data.stake, data.currency)}</strong>
            </div>
            <div>
              <span>Pot</span>
              <strong>{money(pot, data.currency)}</strong>
            </div>
            <div>
              <span>Au gagnant</span>
              <strong>{money(data.share.winner || Math.floor(pot * 0.8), data.currency)}</strong>
            </div>
          </div>
        </div>

        <ul className="seats">
          {data.seats.map((seat, k) => {
            const player = data.players.find((item) => item.seat === seat)
            const active = m?.turn === seat && !over
            const reserved = !player && k > 0 && k <= data.invites.length
            return (
              <li key={seat} className={active ? "seat on" : "seat"} style={{ borderColor: active ? "var(--gold)" : undefined }}>
                <i style={{ background: k === 0 ? "#f6f1e6" : "#1c1915", border: "1px solid var(--gold)" }} />
                <div>
                  <strong>{player ? player.name : reserved ? "Réservée" : "Libre"}</strong>
                  <em>
                    {sides[k]}
                    {player?.userId === data.you ? " · toi" : ""}
                    {player?.isAi ? " · ordinateur" : ""}
                  </em>
                </div>
              </li>
            )
          })}
        </ul>

        {data.invites.length ? <p className="hint">Invitations en attente : {data.invites.join(", ")}</p> : null}

        {!isMember && data.status === "waiting" ? (
          <div className="host-actions">
            <button type="button" disabled={busy} onClick={() => void answerInvite(true)}>
              Rejoindre la table · {money(data.stake, data.currency)}
            </button>
            <button type="button" className="ghost" disabled={busy} onClick={() => void answerInvite(false)}>
              Refuser
            </button>
          </div>
        ) : null}

        {data.online.length && data.status === "waiting" ? (
          <section className="invite-panel">
            <h2>Inviter un joueur</h2>
            <ul className="invite-list">
              {data.online.map((player) => (
                <li key={player.id}>
                  <span>{player.pseudo}</span>
                  {player.invited ? (
                    <em>En attente</em>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => void invite(player.id)}>
                      Inviter
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {data.status === "waiting" && data.creatorId === data.you ? (
          <div className="host-actions">
            <form action={lancer}>
              <input type="hidden" name="code" value={data.code} />
              <button type="submit">Lancer la partie</button>
            </form>
            <form action={ajouterOrdinateur}>
              <input type="hidden" name="code" value={data.code} />
              <button type="submit" className="ghost">Ajouter l&apos;ordinateur</button>
            </form>
            <form action={annuler}>
              <input type="hidden" name="code" value={data.code} />
              <button type="submit" className="ghost">Annuler la salle</button>
            </form>
          </div>
        ) : null}

        {over ? (
          <div className="replay-box">
            <p className="win">
              {winner
                ? `${winner.name} gagne et empoche 80 % du pot. Les gains sont versés.`
                : "Partie nulle : chaque mise est rendue."}
            </p>
            <Link href={`/joueur/jeux/${game}`} className="ghost">
              Retour aux tables
            </Link>
            {isMember ? (
              <button type="button" disabled={busy} onClick={() => void send({ action: "replay" })}>
                Nouvelle partie · {money(data.stake, data.currency)}
              </button>
            ) : null}
          </div>
        ) : null}
        {isMember && m && !over ? (
          <button type="button" className="forfeit" disabled={busy} onClick={() => void send({ action: "board-forfeit" })}>
            Abandonner la mise
          </button>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        <Link href="/joueur" className="ghost game-back">
          ← Retour aux salons
        </Link>
      </aside>
    </section>
  )
}
