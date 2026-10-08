"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ajouterOrdinateur, annuler, lancer } from "@/app/actions/game"
import { Board } from "./Board"
import { COLOR_HEX, FINISH, PLAYER_COLORS, PLAYER_LABELS, type PlayerColor } from "@/lib/ludo/board"
import type { snapshot } from "@/lib/play"

type View = Awaited<ReturnType<typeof snapshot>>

const TUMBLE = [3, 5, 2, 6, 1, 4]

function facePips(value: number | null) {
  if (value === 1) return [5]
  if (value === 2) return [1, 9]
  if (value === 3) return [1, 5, 9]
  if (value === 4) return [1, 3, 7, 9]
  if (value === 5) return [1, 3, 5, 7, 9]
  if (value === 6) return [1, 3, 4, 6, 7, 9]
  return []
}

function Dice({
  value,
  tumbling,
  onRoll,
  enabled,
  label,
  color,
}: {
  value: number | null
  tumbling: number | null
  onRoll: () => void
  enabled: boolean
  label: string
  color: string
}) {
  const pips = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const rolling = tumbling != null
  const on = new Set(facePips(rolling ? tumbling : value))
  return (
    <button
      type="button"
      className={`dice ${rolling ? "rolling" : enabled ? "ready" : value ? "shown" : "quiet"}`}
      style={{ "--die": color } as CSSProperties}
      onClick={onRoll}
      disabled={!enabled || rolling}
      aria-label={rolling ? "Le dé tourne" : label}
    >
      {pips.map((pip) => (
        <span key={pip} className={on.has(pip) ? "pip on" : "pip"} />
      ))}
    </button>
  )
}

function money(amount: number, currency: string) {
  return `${amount} ${currency === "lion" ? "Lion" : "poky"}`
}

export function Table({ initial, erreur }: { initial: View; erreur?: string }) {
  const router = useRouter()
  const [data, setData] = useState(initial)
  const [error, setError] = useState(erreur ?? "")
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [spinSeat, setSpinSeat] = useState<number | null>(null)
  const [tumble, setTumble] = useState(TUMBLE[0])
  const spinToken = useRef(0)
  const reduceMotion = useRef(false)
  const rollMark = useRef<string | null>(null)

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

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }, [])

  useEffect(() => {
    if (spinSeat == null) return
    let index = 0
    const timer = window.setInterval(() => {
      index = (index + 1) % TUMBLE.length
      setTumble(TUMBLE[index])
    }, 80)
    return () => window.clearInterval(timer)
  }, [spinSeat])

  async function send(action: "roll" | "move" | "forfeit" | "replay", pieceId?: string) {
    setBusy(true)
    setError("")
    const response = await fetch(`/api/partie/${initial.code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, pieceId }),
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

  function holdSpin(seat: number, ms: number) {
    const token = ++spinToken.current
    setSpinSeat(seat)
    setTumble(TUMBLE[0])
    window.setTimeout(() => {
      if (spinToken.current === token) setSpinSeat(null)
    }, ms)
  }

  async function rollDie() {
    if (mine == null) return
    if (reduceMotion.current) {
      await send("roll")
      return
    }
    const token = ++spinToken.current
    setSpinSeat(mine)
    setTumble(TUMBLE[0])
    const started = Date.now()
    try {
      await send("roll")
    } finally {
      const wait = Math.max(80, 720 - (Date.now() - started))
      window.setTimeout(() => {
        if (spinToken.current === token) setSpinSeat(null)
      }, wait)
    }
  }

  async function copyCode() {
    await navigator.clipboard.writeText(data.code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  async function copyLink() {
    const url = `${window.location.origin}/joueur/partie/${data.code}`
    await navigator.clipboard.writeText(url)
    setLinkCopied(true)
    window.setTimeout(() => setLinkCopied(false), 1600)
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
    if (!response.ok) {
      setError(json.error ?? "Invitation impossible.")
      return
    }
    const view = await fetch(`/api/partie/${data.code}`, { cache: "no-store" })
    if (view.ok) setData(await view.json())
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
    const view = await fetch(`/api/partie/${data.code}`, { cache: "no-store" })
    if (view.ok) setData(await view.json())
    router.refresh()
  }

  const state = data.state
  const mine = data.yourSeat
  const myTurn = state != null && mine != null && state.turn === mine && state.winner == null && !state.forfeited.includes(mine)
  const winner = data.players.find((player) => player.seat === state?.winner)
  const turnPlayer = data.players.find((player) => player.seat === state?.turn)
  const pot = data.pot || data.stake * data.seats.length
  const seconds = state && state.winner == null ? Math.max(0, Math.ceil((state.deadline - now) / 1000)) : null
  const rollKey = state ? `${state.turn}:${state.dice ?? ""}:${state.phase}` : ""

  useEffect(() => {
    if (!rollKey) return
    if (rollMark.current == null) {
      rollMark.current = rollKey
      return
    }
    if (rollMark.current === rollKey) return
    rollMark.current = rollKey
    if (!state?.dice || state.phase !== "move" || state.turn === mine || reduceMotion.current) return
    holdSpin(state.turn, 720)
  }, [rollKey, mine, state])

  const seated = data.players.length
  const status =
    data.status === "waiting"
      ? `${seated}/${data.seats.length} joueurs`
      : winner
        ? "Partie terminée"
        : myTurn
          ? "À ton tour"
          : `Tour de ${turnPlayer?.name ?? "l'autre joueur"}`

  return (
    <section className="match">
      <div className="match-board">
        <div className="match-status">
          <span className={myTurn ? "pill live" : "pill"}>{status}</span>
          {seconds != null && data.status === "playing" ? <span className="pill">{seconds}s</span> : null}
          {state?.log ? <span className="status-log">{state.log}</span> : <span className="status-log">La salle se remplit.</span>}
        </div>
        <Board
          pieces={state?.pieces ?? []}
          legal={myTurn && state?.phase === "move" ? state.legal : []}
          active={data.seats}
          onPick={(id) => void send("move", id)}
          onRoll={() => void rollDie()}
          dice={
            state
              ? data.seats.flatMap((seat) => {
                  const player = data.players.find((item) => item.seat === seat)
                  if (!player) return []
                  const color = PLAYER_COLORS[seat]
                  const theirTurn = state.turn === seat && state.winner == null && !state.forfeited.includes(seat)
                  const canRoll = theirTurn && seat === mine && state.phase === "roll" && !busy && !player.isAi
                  const showRoll = state.turn === seat && state.dice != null
                  return [
                    {
                      seat,
                      value: showRoll ? state.dice : null,
                      tumbling: spinSeat === seat ? tumble : null,
                      enabled: canRoll,
                      color: COLOR_HEX[color],
                      label: canRoll ? `Lancer le dé de ${player.name}` : `Dé de ${player.name}`,
                    },
                  ]
                })
              : []
          }
        />
      </div>

      <aside className="match-tools">
        <div className="sheet">
          <p className="kicker">{data.levelLabel}</p>
          <div className="code-row">
            <h1>{data.code}</h1>
            <button type="button" className="ghost" onClick={() => void copyCode()}>
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
          {data.seats.map((seat) => {
            const player = data.players.find((item) => item.seat === seat)
            const color = (player?.color ?? "green") as PlayerColor
            const active = state?.turn === seat && state.winner == null
            const seatIndex = data.seats.indexOf(seat)
            const reserved = !player && seatIndex > 0 && seatIndex <= data.invites.length
            const tokens = state?.pieces.filter((piece) => piece.player === seat) ?? []
            const arrived = tokens.filter((piece) => piece.pos >= FINISH).length
            const you = player?.userId === data.you
            return (
              <li key={seat} className={active ? "seat on" : "seat"} style={{ borderColor: active ? COLOR_HEX[color] : undefined }}>
                <i style={{ background: COLOR_HEX[color] }} />
                <div>
                  <strong>{player ? player.name : reserved ? "Réservée" : "Libre"}</strong>
                  <em>
                    {PLAYER_LABELS[seat]}
                    {you ? " · toi" : ""}
                    {player?.isAi ? " · ordinateur" : ""}
                    {tokens.length ? ` · ${arrived}/4 arrivés` : ""}
                  </em>
                </div>
              </li>
            )
          })}
        </ul>

        {data.invites.length ? <p className="hint">Invitations en attente : {data.invites.join(", ")}</p> : null}

        {state && mine != null ? (
          <div className={data.status === "playing" ? "play-box is-live" : "play-box"}>
            <Dice
              value={myTurn ? state.dice : null}
              tumbling={spinSeat === mine ? tumble : null}
              enabled={myTurn && state.phase === "roll" && !busy}
              color={COLOR_HEX[PLAYER_COLORS[mine]]}
              label="Lancer ton dé"
              onRoll={() => void rollDie()}
            />
            <div>
              <strong>
                {winner
                  ? `${winner.name} remporte la partie`
                  : spinSeat === mine
                    ? "Le dé tourne"
                    : myTurn && state.phase === "roll"
                      ? "Ton dé est prêt"
                      : myTurn
                        ? "Choisis un pion marqué"
                        : `Dé de ${turnPlayer?.name ?? "l'autre joueur"}`}
              </strong>
              <p>
                {spinSeat === mine
                  ? "Il retombe…"
                  : myTurn && state.dice
                    ? `Ton dé : ${state.dice}`
                    : "Seul le joueur dont c'est le tour peut lancer."}
              </p>
            </div>
          </div>
        ) : state ? (
          <p className="waiting-copy">Les dés sont au bord du plateau. Chacun lance le sien à son tour.</p>
        ) : (
          <p className="waiting-copy">Le créateur lance la partie quand chaque place est prise.</p>
        )}

        {data.status === "waiting" && data.yourSeat == null && data.yourInvite?.status !== "refused" ? (
          <div className="invite-actions">
            <button type="button" disabled={busy} onClick={() => void answerInvite(true)}>
              Accepter l&apos;invitation
            </button>
            <button type="button" className="ghost" disabled={busy} onClick={() => void answerInvite(false)}>
              Refuser
            </button>
          </div>
        ) : null}
        {data.status === "waiting" && data.yourSeat == null && data.yourInvite?.status === "refused" ? (
          <p className="hint">Tu as refusé cette invitation.</p>
        ) : null}

        {data.status === "waiting" && data.creatorId === data.you && data.seats.length >= 2 ? (
          <section className="invite-box" aria-label="Inviter un joueur">
            <h2>Inviter un joueur</h2>
            <button type="button" className="ghost" onClick={() => void copyLink()}>
              {linkCopied ? "Lien copié" : "Copier le lien du jeu"}
            </button>
            <p className="hint">Envoie ce lien à un ami connecté. Il pourra accepter ou refuser.</p>
            <ul className="invite-list">
              {data.online.length === 0 ? <li>Aucun autre joueur connecté.</li> : null}
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

        {winner ? (
          <div className="replay-box">
            <p className="win">{winner.name} empoche 80 % du pot. Les gains sont versés.</p>
            <Link href="/joueur/salon" className="ghost">
              Retour au salon
            </Link>
            {mine != null ? (
              <button type="button" disabled={busy} onClick={() => void send("replay")}>
                Nouvelle partie · {money(data.stake, data.currency)}
              </button>
            ) : null}
          </div>
        ) : null}
        {mine != null && state && state.winner == null ? (
          <button type="button" className="forfeit" disabled={busy} onClick={() => void send("forfeit")}>
            Abandonner la mise
          </button>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
      </aside>
    </section>
  )
}
