"use client"

import { useState } from "react"
import { damesMoves, isDark, type DamesState } from "@/lib/games/dames"
import type { BoardInput } from "@/lib/games/match"

export function DamesBoard({
  s,
  mySide,
  canPlay,
  last,
  onMove,
}: {
  s: DamesState
  mySide: 0 | 1 | null
  canPlay: boolean
  last: number[]
  onMove: (input: BoardInput) => void
}) {
  const [sel, setSel] = useState<number | null>(null)
  const moves = canPlay ? damesMoves(s) : []
  const mine = sel == null ? [] : moves.filter((m) => m.path[0] === sel)
  const targets = mine.map((m) => m.path[m.path.length - 1])
  const flip = mySide === 1
  const order = Array.from({ length: 100 }, (_, i) => (flip ? 99 - i : i))
  const forced = moves.length > 0 && moves[0].captured.length > 0

  function click(i: number) {
    if (!canPlay) return
    if (sel != null && targets.includes(i)) {
      onMove({ from: sel, to: i })
      setSel(null)
      return
    }
    setSel(moves.some((m) => m.path[0] === i) ? i : null)
  }

  return (
    <div className="gboard-wrap">
      <div className="gboard dames" role="grid" aria-label="Damier">
        {order.map((i) => {
          const p = s.board[i]
          const dark = isDark(i)
          const movable = canPlay && moves.some((m) => m.path[0] === i)
          const cls = [
            "gsq",
            dark ? "dark" : "light",
            sel === i ? "sel" : "",
            targets.includes(i) ? "target" : "",
            last.includes(i) ? "last" : "",
            movable && forced ? "must" : "",
          ].join(" ")
          return (
            <button key={i} type="button" className={cls} onClick={() => click(i)} disabled={!dark} aria-label={`case ${i}`}>
              {p ? <span className={`dame-piece ${p.c === "w" ? "white" : "black"} ${p.king ? "king" : ""}`}>{p.king ? "♛" : ""}</span> : null}
            </button>
          )
        })}
      </div>
      {forced && canPlay ? <p className="hint">Prise obligatoire (prise majoritaire).</p> : null}
    </div>
  )
}
