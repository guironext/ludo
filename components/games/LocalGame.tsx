"use client"

import { useState } from "react"
import { GAME_LABELS, SIDE_LABELS, boardPlay, createBoardMatch, type BoardGameType, type BoardInput } from "@/lib/games/match"
import { GameSurface } from "./GameSurface"
import { VictoryOverlay } from "../VictoryOverlay"

/** Entraînement gratuit : 2 joueurs sur le même écran, sans mise. */
export function LocalGame({ game }: { game: BoardGameType }) {
  const [m, setM] = useState(() => createBoardMatch(game, [0, 1], [], 0))
  const [round, setRound] = useState(0)
  const sides = SIDE_LABELS[game]
  const over = m.winner != null || m.draw
  const side = m.turn === 0 ? 0 : 1

  function play(input: BoardInput) {
    const next = structuredClone(m)
    if (boardPlay(next, next.turn, input, Date.now())) setM(next)
  }

  return (
    <section className="card local-game">
      <VictoryOverlay
        id={m.winner != null ? `local:${game}:${round}:${m.moves}` : null}
        winnerName={m.winner != null ? `${game === "awale" ? "le" : "les"} ${sides[m.winner === 0 ? 0 : 1]}` : ""}
        persist={false}
      />
      <div className="local-board">
        <GameSurface data={m.data} mySide={game === "awale" ? null : 0} canPlay={!over} last={m.last} names={sides} onMove={play} />
      </div>
      <aside className="local-info">
        <div className="match-status">
          <span className="pill live">{over ? "Partie terminée" : `Au tour des ${sides[side]}`}</span>
          <span className="status-log">{m.log}</span>
        </div>
        <ul className="seats local-seats">
          {[0, 1].map((k) => (
            <li key={k} className={!over && side === k ? "seat on" : "seat"}>
              <i className={k === 0 ? "side-light" : "side-dark"} />
              <div>
                <strong>{sides[k]}</strong>
                <em>{!over && side === k ? "À toi de jouer" : "En attente"}</em>
              </div>
            </li>
          ))}
        </ul>
        {over ? (
          <p className="win">{m.winner != null ? `Les ${sides[m.winner]} gagnent.` : "Partie nulle."}</p>
        ) : null}
        <button type="button" className="ghost" onClick={() => {
            setM(createBoardMatch(game, [0, 1], [], 0))
            setRound((value) => value + 1)
          }}>
          Recommencer ({GAME_LABELS[game]})
        </button>
      </aside>
    </section>
  )
}
