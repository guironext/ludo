import { FINISH, STRETCH, isSafe } from "./board"
import type { LudoState } from "./engine"
import { globalIndex } from "./board"

function wouldCapture(state: LudoState, player: number, pos: number) {
  if (pos < 0 || pos >= STRETCH || isSafe(player, pos)) return false
  const cell = globalIndex(player, pos)
  return state.pieces.some((piece) => {
    if (piece.player === player || piece.pos < 0 || piece.pos >= STRETCH) return false
    return globalIndex(piece.player, piece.pos) === cell
  })
}

export function chooseMove(state: LudoState) {
  let bestId = state.legal[0]
  let best = -10_000
  const dice = state.dice ?? 0
  for (const id of state.legal) {
    const piece = state.pieces.find((item) => item.id === id)
    if (!piece) continue
    const to = piece.pos < 0 ? 0 : piece.pos + dice
    let score = 10 + Math.max(0, to)
    if (piece.pos < 0) score += 30
    if (piece.pos < STRETCH && to >= STRETCH) score += 40
    if (to >= FINISH) score += 70
    if (to < STRETCH && isSafe(piece.player, to)) score += 25
    if (piece.pos >= 0 && piece.pos < STRETCH && isSafe(piece.player, piece.pos) && !isSafe(piece.player, to)) {
      score -= 10
    }
    if (wouldCapture(state, piece.player, to)) score += 50
    if (score > best) {
      best = score
      bestId = id
    }
  }
  return bestId
}
