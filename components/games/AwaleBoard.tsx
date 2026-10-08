"use client"

import { awaleMoves, type AwaleState } from "@/lib/games/awale"
import type { BoardInput } from "@/lib/games/match"

export function AwaleBoard({
  s,
  mySide,
  canPlay,
  last,
  names,
  onMove,
}: {
  s: AwaleState
  mySide: 0 | 1 | null
  canPlay: boolean
  last: number[]
  names: [string, string]
  onMove: (input: BoardInput) => void
}) {
  const legal = canPlay ? awaleMoves(s) : []
  const me: 0 | 1 = mySide ?? 0
  const them = (1 - me) as 0 | 1
  // rangée du bas : la mienne de gauche à droite ; rangée du haut : l'adverse, de droite à gauche
  const bottom = me === 0 ? [0, 1, 2, 3, 4, 5] : [6, 7, 8, 9, 10, 11]
  const top = me === 0 ? [11, 10, 9, 8, 7, 6] : [5, 4, 3, 2, 1, 0]

  const pit = (i: number) => (
    <button
      key={i}
      type="button"
      className={`awale-pit ${legal.includes(i) ? "playable" : ""} ${last.includes(i) ? "last" : ""}`}
      disabled={!legal.includes(i)}
      onClick={() => onMove({ pit: i })}
      aria-label={`case de ${s.pits[i]} graines`}
    >
      <span className="seeds" aria-hidden="true">
        {Array.from({ length: Math.min(s.pits[i], 20) }, (_, k) => (
          <i key={k} />
        ))}
      </span>
      <strong>{s.pits[i]}</strong>
    </button>
  )

  return (
    <div className="gboard-wrap">
      <div className="awale-board">
        <div className="awale-store">
          <small>{names[them]}</small>
          <strong>{s.store[them]}</strong>
        </div>
        <div className="awale-rows">
          <div className="awale-row">{top.map(pit)}</div>
          <div className="awale-row">{bottom.map(pit)}</div>
        </div>
        <div className="awale-store">
          <small>{names[me]}</small>
          <strong>{s.store[me]}</strong>
        </div>
      </div>
    </div>
  )
}
