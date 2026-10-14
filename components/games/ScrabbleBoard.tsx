"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"
import { ALPHA, BLANK, CENTER, PREMIUM, RACK, SIZE, evaluatePlacement, tileValue, type Placement, type ScrabbleState } from "@/lib/games/scrabble"
import type { BoardInput } from "@/lib/games/match"

const ScrabbleBoard3D = dynamic(() => import("./ScrabbleBoard3D").then((mod) => mod.ScrabbleBoard3D), {
  ssr: false,
  loading: () => <div className="gboard3d-loading" aria-hidden="true">Chargement du plateau 3D…</div>,
})

const VIEW_KEY = "ba-scrabble-vue"
const PREMIUM_LABEL: Record<string, string> = { MT: "MT", MD: "MD", LT: "LT", LD: "LD" }

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas")
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"))
  } catch {
    return false
  }
}

export type PendingTile = Placement & { slot: number }

export function ScrabbleBoard({
  s,
  mySide,
  canPlay,
  last,
  names,
  onMove,
}: {
  s: ScrabbleState
  mySide: 0 | 1 | null
  canPlay: boolean
  last: number[]
  names: [string, string]
  onMove: (input: BoardInput) => void
}) {
  const side = mySide ?? s.turn
  const rack = s.racks[side] ?? []
  const rackKey = rack.join("")
  const [order, setOrder] = useState<number[]>(() => rack.map((_, k) => k))
  const [pending, setPending] = useState<PendingTile[]>([])
  const [selSlot, setSelSlot] = useState<number | null>(null)
  const [blankFor, setBlankFor] = useState<{ i: number; slot: number } | null>(null)
  const [exchange, setExchange] = useState<number[] | null>(null)
  const [webgl, setWebgl] = useState(false)
  const [view, setView] = useState<"2d" | "3d">("2d")
  const [lowPower, setLowPower] = useState(true)
  const [dragSlot, setDragSlot] = useState<number | null>(null)

  useEffect(() => {
    const ok = hasWebGL()
    setWebgl(ok)
    setLowPower(window.matchMedia("(max-width: 700px), (pointer: coarse)").matches)
    let saved: string | null = null
    try {
      saved = window.localStorage.getItem(VIEW_KEY)
    } catch {
      /* stockage indisponible */
    }
    if (ok && saved !== "2d") setView("3d")
  }, [])

  // nouveau chevalet ou nouveau coup sur le plateau : on repart de zéro
  const boardKey = s.board.map((c) => c?.l ?? ".").join("")
  useEffect(() => {
    setOrder(rack.map((_, k) => k))
    setPending([])
    setSelSlot(null)
    setExchange(null)
    setBlankFor(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rackKey, boardKey])

  function choose(next: "2d" | "3d") {
    setView(next)
    try {
      window.localStorage.setItem(VIEW_KEY, next)
    } catch {
      /* stockage indisponible */
    }
  }

  const used = new Set(pending.map((p) => p.slot))
  const tiles: Placement[] = pending.map(({ i, l, blank }) => ({ i, l, blank }))
  const preview = useMemo(() => (pending.length ? evaluatePlacement(s, tiles, null) : null), [s, pending]) // eslint-disable-line react-hooks/exhaustive-deps

  function place(i: number, slot: number) {
    if (!canPlay || exchange || s.board[i] || pending.some((p) => p.i === i) || used.has(slot)) return
    const letter = rack[slot]
    if (letter === undefined) return
    if (letter === BLANK) {
      setBlankFor({ i, slot })
      return
    }
    setPending((list) => [...list, { i, l: letter, slot }])
    setSelSlot(null)
  }

  function onSquare(i: number) {
    if (!canPlay) return
    const mine = pending.find((p) => p.i === i)
    if (mine) {
      setPending((list) => list.filter((p) => p.i !== i))
      return
    }
    if (selSlot != null) place(i, selSlot)
    else {
      const next = order.find((k) => !used.has(k))
      if (next != null && pending.length) place(i, next)
    }
  }

  function clickSlot(slot: number) {
    if (!canPlay) return
    if (exchange) {
      setExchange((list) => (list!.includes(slot) ? list!.filter((k) => k !== slot) : [...list!, slot]))
      return
    }
    if (used.has(slot)) {
      setPending((list) => list.filter((p) => p.slot !== slot))
      return
    }
    setSelSlot(selSlot === slot ? null : slot)
  }

  function shuffle() {
    setOrder((list) => {
      const a = list.slice()
      for (let k = a.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1))
        ;[a[k], a[j]] = [a[j], a[k]]
      }
      return a
    })
  }

  const myScore = s.scores[side]
  const otherSide = side === 0 ? 1 : 0
  const bag = s.bagCount ?? s.bag.length
  const show3d = webgl && view === "3d"
  const pendingCells = new Map(pending.map((p) => [p.i, p]))

  return (
    <div className="gboard-wrap scrabble-wrap">
      <div className="scrabble-scores" aria-label="Scores">
        <div className={s.turn === side && !s.over ? "sc-score on" : "sc-score"}>
          <span>{names[side]}</span>
          <strong>{myScore}</strong>
        </div>
        <div className="sc-bag" title="Jetons dans le sac">
          <span>Sac</span>
          <strong>{bag}</strong>
        </div>
        <div className={s.turn === otherSide && !s.over ? "sc-score on" : "sc-score"}>
          <span>{names[otherSide]}</span>
          <strong>{s.scores[otherSide]}</strong>
        </div>
      </div>

      {webgl ? (
        <div className="view-toggle" role="group" aria-label="Affichage du plateau">
          <button type="button" className={view === "2d" ? "is-on" : ""} aria-pressed={view === "2d"} onClick={() => choose("2d")}>
            2D
          </button>
          <button type="button" className={view === "3d" ? "is-on" : ""} aria-pressed={view === "3d"} onClick={() => choose("3d")}>
            3D
          </button>
        </div>
      ) : null}

      {show3d ? (
        <div className="gboard3d scrabble3d" aria-label="Plateau de Scrabble 3D">
          <ScrabbleBoard3D board={s.board} pending={tiles} last={last} onSquare={onSquare} lowPower={lowPower} />
        </div>
      ) : (
        <div className="gboard scrabble" role="grid" aria-label="Plateau de Scrabble">
          {Array.from({ length: SIZE * SIZE }, (_, i) => {
            const cell = s.board[i]
            const pend = pendingCells.get(i)
            const p = PREMIUM[i]
            const cls = ["sq", p ? `p-${p}` : "", i === CENTER ? "star" : "", last.includes(i) ? "last" : "", pend ? "pending" : ""].join(" ")
            const t = cell ?? pend ?? null
            return (
              <button
                key={i}
                type="button"
                className={cls}
                onClick={() => onSquare(i)}
                onDragOver={(e) => {
                  if (dragSlot != null && !cell) e.preventDefault()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragSlot != null) place(i, dragSlot)
                  setDragSlot(null)
                }}
                aria-label={`case ${String.fromCharCode(65 + (i % SIZE))}${Math.floor(i / SIZE) + 1}${t ? ` ${t.l}` : ""}`}
              >
                {t ? (
                  <span className={`sc-tile${t.blank ? " blank" : ""}`}>
                    {t.l}
                    <sub>{t.blank ? "" : tileValue(t.l)}</sub>
                  </span>
                ) : p ? (
                  <em>{i === CENTER ? "★" : PREMIUM_LABEL[p]}</em>
                ) : null}
              </button>
            )
          })}
        </div>
      )}

      {mySide != null ? (
        <>
          <div className="sc-rack" aria-label="Ton chevalet">
            {order.map((slot) => {
              const l = rack[slot]
              if (l === undefined) return null
              const cls = ["sc-tile", "rack-tile", used.has(slot) ? "used" : "", selSlot === slot ? "sel" : "", exchange?.includes(slot) ? "swap" : "", l === BLANK ? "blank" : ""].join(" ")
              return (
                <button
                  key={slot}
                  type="button"
                  className={cls}
                  draggable={canPlay && !used.has(slot) && !exchange}
                  onDragStart={() => setDragSlot(slot)}
                  onClick={() => clickSlot(slot)}
                  aria-label={l === BLANK ? "joker" : `lettre ${l}`}
                >
                  {l === BLANK ? "" : l}
                  <sub>{l === BLANK ? "" : tileValue(l)}</sub>
                </button>
              )
            })}
          </div>
          {preview ? (
            <p className={preview.ok ? "hint sc-preview" : "hint sc-preview bad"}>
              {preview.ok ? `${preview.words.map((w) => w.word).join(", ")} · ${preview.score} pts${pending.length === RACK ? " (scrabble !)" : ""}` : preview.error}
            </p>
          ) : null}
          <div className="sc-actions">
            {exchange ? (
              <>
                <button type="button" disabled={!canPlay || !exchange.length} onClick={() => onMove({ kind: "exchange", letters: exchange.map((k) => rack[k]) })}>
                  Échanger {exchange.length || ""}
                </button>
                <button type="button" className="ghost" onClick={() => setExchange(null)}>
                  Annuler
                </button>
              </>
            ) : (
              <>
                <button type="button" className="ghost" disabled={!canPlay} onClick={shuffle}>
                  Mélanger
                </button>
                <button type="button" className="ghost" disabled={!canPlay || !pending.length} onClick={() => setPending([])}>
                  Rappeler
                </button>
                <button type="button" className="ghost" disabled={!canPlay || bag < RACK} onClick={() => { setPending([]); setExchange([]) }}>
                  Échanger
                </button>
                <button type="button" className="ghost" disabled={!canPlay} onClick={() => onMove({ kind: "pass" })}>
                  Passer
                </button>
                <button type="button" className="sc-play" disabled={!canPlay || !pending.length || (preview != null && !preview.ok)} onClick={() => onMove({ kind: "place", tiles })}>
                  Jouer{preview?.ok ? ` · ${preview.score}` : ""}
                </button>
              </>
            )}
          </div>
        </>
      ) : null}

      {blankFor ? (
        <div className="promo-pick sc-blank" role="dialog" aria-label="Lettre du joker">
          <span>Joker :</span>
          <div>
            {ALPHA.split("").map((L) => (
              <button
                key={L}
                type="button"
                onClick={() => {
                  setPending((list) => [...list, { i: blankFor.i, l: L, blank: true, slot: blankFor.slot }])
                  setBlankFor(null)
                  setSelSlot(null)
                }}
              >
                {L}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
