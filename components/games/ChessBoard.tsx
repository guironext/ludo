"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { GLYPH, inCheck, kingSquare, legalMoves, type ChessState, type PieceType } from "@/lib/games/chess"
import type { BoardInput } from "@/lib/games/match"

const ChessBoard3D = dynamic(() => import("./ChessBoard3D").then((mod) => mod.ChessBoard3D), {
  ssr: false,
  loading: () => <div className="gboard3d-loading" aria-hidden="true">Chargement de l’échiquier 3D…</div>,
})

const VIEW_KEY = "ba-echecs-vue"

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas")
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"))
  } catch {
    return false
  }
}

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
  const [webgl, setWebgl] = useState(false)
  const [view, setView] = useState<"2d" | "3d">("2d")
  const [lowPower, setLowPower] = useState(true)

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

  function choose(next: "2d" | "3d") {
    setView(next)
    try {
      window.localStorage.setItem(VIEW_KEY, next)
    } catch {
      /* stockage indisponible */
    }
  }

  const moves = canPlay ? legalMoves(s) : []
  const targets = sel == null ? [] : moves.filter((m) => m.from === sel).map((m) => m.to)
  const flip = mySide === 1
  const order = Array.from({ length: 64 }, (_, i) => (flip ? 63 - i : i))
  const checkSq = inCheck(s) ? kingSquare(s.board, s.turn) : -1
  const movable = Array.from(new Set(moves.map((m) => m.from)))
  const show3d = webgl && view === "3d"

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
      {webgl ? (
        <div className="view-toggle" role="group" aria-label="Affichage de l’échiquier">
          <button type="button" className={view === "2d" ? "is-on" : ""} aria-pressed={view === "2d"} onClick={() => choose("2d")}>
            2D
          </button>
          <button type="button" className={view === "3d" ? "is-on" : ""} aria-pressed={view === "3d"} onClick={() => choose("3d")}>
            3D
          </button>
        </div>
      ) : null}
      {show3d ? (
        <div className="gboard3d" aria-label="Échiquier 3D">
          <ChessBoard3D s={s} flip={flip} sel={sel} targets={targets} movable={movable} last={last} checkSq={checkSq} onSquare={click} lowPower={lowPower} />
        </div>
      ) : (
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
      )}
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
