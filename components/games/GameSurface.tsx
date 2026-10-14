"use client"

import type { BoardData, BoardInput } from "@/lib/games/match"
import { AwaleBoard } from "./AwaleBoard"
import { ChessBoard } from "./ChessBoard"
import { DamesBoard } from "./DamesBoard"
import { ScrabbleBoard } from "./ScrabbleBoard"

export function GameSurface({
  data,
  mySide,
  canPlay,
  last,
  names,
  onMove,
}: {
  data: BoardData
  mySide: 0 | 1 | null
  canPlay: boolean
  last: number[]
  names: [string, string]
  onMove: (input: BoardInput) => void
}) {
  if (data.game === "echecs") return <ChessBoard s={data.s} mySide={mySide} canPlay={canPlay} last={last} onMove={onMove} />
  if (data.game === "dames") return <DamesBoard s={data.s} mySide={mySide} canPlay={canPlay} last={last} onMove={onMove} />
  if (data.game === "scrabble") return <ScrabbleBoard s={data.s} mySide={mySide} canPlay={canPlay} last={last} names={names} onMove={onMove} />
  return <AwaleBoard s={data.s} mySide={mySide} canPlay={canPlay} last={last} names={names} onMove={onMove} />
}
