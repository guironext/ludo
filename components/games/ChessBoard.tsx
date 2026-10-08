"use client"

import { useState } from "react"
import { GLYPH, inCheck, kingSquare, legalMoves, type ChessState, type PieceType } from "@/lib/games/chess"
import type { BoardInput } from "@/lib/games/match"

export function ChessBoard({
  s,
  mySide,
  canPlay,
  last,
  onMove,
}: {
  s: ChessState
  mySide: 0 | 1 | null
  canPlay: boolean
  last: number[]
  onMove: (input: BoardInput) => void
}) {
  const [sel, setSel] = useState<number | null>(null)
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null)
  const moves = canPlay ? legalMoves(s) : []
  const targets = sel == null ? [] : moves.filter((m) => m.from === sel).map((m) => m.to)
  const flip = mySide === 1
  const order = Array.from({ length: 64 }, (_, i) => (flip ? 63 - i : i))
  const checkSq = inCheck(s) ? kingSquare(s.board, s.turn) : -1

  function click(i: number) {
    if (!canPlay) return
    if (sel != null && targets.includes(i)) {
      const mv = moves.find((m) => m.from === sel && m.to === i)
      if (mv?.promo) setPromo({ from: sel, to: i })
      else onMove({ from: sel, to: i })
      setSel(null)
      return
    }
    setSel(moves.some((m) => m.from === i) ? i : null)
  }

  return (
    <div className="gboard-wrap">
      <div className="gboard chess" role="grid" aria-label="Échiquier">
        {order.map((i) => {
          const p = s.board[i]
          const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1
          const cls = [
            "gsq",
            dark ? "dark" : "light",
            sel === i ? "sel" : "",
            targets.includes(i) ? (p ? "target capture" : "target") : "",
            last.includes(i) ? "last" : "",
            checkSq === i ? "check" : "",
          ].join(" ")
          return (
            <button key={i} type="button" className={cls} onClick={() => click(i)} aria-label={`case ${"abcdefgh"[i % 8]}${8 - Math.floor(i / 8)}`}>
              {p ? <span className={`chess-piece ${p.c === "w" ? "white" : "black"}`}>{GLYPH[p.c][p.t]}</span> : null}
            </button>
          )
        })}
      </div>
      {promo ? (
        <div className="promo-pick">
          <span>Promotion :</span>
          {(["q", "r", "b", "n"] as PieceType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                onMove({ ...promo, promo: t })
                setPromo(null)
              }}
            >
              {GLYPH[s.turn][t]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
