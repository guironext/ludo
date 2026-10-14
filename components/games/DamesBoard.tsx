"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { damesMoves, isDark, type DamesState } from "@/lib/games/dames"
import type { BoardInput } from "@/lib/games/match"

const DamesBoard3D = dynamic(() => import("./DamesBoard3D").then((mod) => mod.DamesBoard3D), {
  ssr: false,
  loading: () => <div className="gboard3d-loading" aria-hidden="true">Chargement du damier 3D…</div>,
})

const VIEW_KEY = "ba-dames-vue"

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas")
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"))
  } catch {
    return false
  }
}

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

  const moves = canPlay ? damesMoves(s) : []
  const mine = sel == null ? [] : moves.filter((m) => m.path[0] === sel)
  const targets = mine.map((m) => m.path[m.path.length - 1])
  const movable = Array.from(new Set(moves.map((m) => m.path[0])))
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

  const show3d = webgl && view === "3d"

  return (
    <div className="gboard-wrap">
      {webgl ? (
        <div className="view-toggle" role="group" aria-label="Affichage du damier">
          <button type="button" className={view === "2d" ? "is-on" : ""} aria-pressed={view === "2d"} onClick={() => choose("2d")}>
            2D
          </button>
          <button type="button" className={view === "3d" ? "is-on" : ""} aria-pressed={view === "3d"} onClick={() => choose("3d")}>
            3D
          </button>
        </div>
      ) : null}
      {show3d ? (
        <div className="gboard3d" aria-label="Damier 3D">
          <DamesBoard3D s={s} flip={flip} sel={sel} targets={targets} movable={movable} last={last} onSquare={click} lowPower={lowPower} />
        </div>
      ) : (
        <div className="gboard dames" role="grid" aria-label="Damier">
          {order.map((i) => {
            const p = s.board[i]
            const dark = isDark(i)
            const isMovable = canPlay && movable.includes(i)
            const cls = [
              "gsq",
              dark ? "dark" : "light",
              sel === i ? "sel" : "",
              targets.includes(i) ? "target" : "",
              last.includes(i) ? "last" : "",
              isMovable && forced ? "must" : "",
            ].join(" ")
            return (
              <button key={i} type="button" className={cls} onClick={() => click(i)} disabled={!dark} aria-label={`case ${i}`}>
                {p ? <span className={`dame-piece ${p.c === "w" ? "white" : "black"} ${p.king ? "king" : ""}`}>{p.king ? "♛" : ""}</span> : null}
              </button>
            )
          })}
        </div>
      )}
      {forced && canPlay ? <p className="hint">Prise obligatoire (prise majoritaire).</p> : null}
    </div>
  )
}
