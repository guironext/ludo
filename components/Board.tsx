"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { PLAYER_COLORS } from "@/lib/ludo/board"
import type { Piece } from "@/lib/ludo/engine"
import type { BoardDie } from "./BoardCanvas"

const BoardCanvas = dynamic(() => import("./BoardCanvas").then((mod) => mod.BoardCanvas), {
  ssr: false,
  loading: () => <div className="board-loading" aria-hidden="true" />,
})

export function Board({
  pieces,
  legal,
  active,
  dice,
  onPick,
  onRoll,
}: {
  pieces: Piece[]
  legal: string[]
  active: number[]
  dice: BoardDie[]
  onPick: (id: string) => void
  onRoll: () => void
}) {
  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => setReduceMotion(media.matches)
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [])

  return (
    <div className="tray">
      <div className="board board-stage">
        <div className="board-canvas">
          <BoardCanvas
            pieces={pieces}
            legal={legal}
            active={active}
            dice={dice}
            onPick={onPick}
            onRoll={onRoll}
            reduceMotion={reduceMotion}
          />
        </div>
        <div className="board-picks">
          {pieces.map((piece) => {
            const playable = legal.includes(piece.id) && active.includes(piece.player)
            return (
              <button
                key={piece.id}
                type="button"
                disabled={!playable}
                onClick={() => playable && onPick(piece.id)}
              >
                Pion {PLAYER_COLORS[piece.player]} {piece.id}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
