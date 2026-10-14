import { FINISH, STRETCH, isSafe } from "./board"
import type { LudoState } from "./engine"
import { TRACK, globalIndex } from "./board"

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

const TRACK_LEN = TRACK.length

/** Nombre d'adversaires pouvant atteindre la case (1 à 6 cases derrière) sur le parcours commun. */
function threats(state: LudoState, player: number, pos: number) {
  if (pos < 0 || pos >= STRETCH || isSafe(player, pos)) return 0
  const cell = globalIndex(player, pos)
  let n = 0
  for (const p of state.pieces) {
    if (p.player === player || p.pos < 0 || p.pos >= STRETCH) continue
    const d = (cell - globalIndex(p.player, p.pos) + TRACK_LEN) % TRACK_LEN
    if (d >= 1 && d <= 6) n++
  }
  return n
}

/** IA « pro » : prise, mise à l'abri, sortie de danger, progression ; aucun hasard. */
export function chooseMovePro(state: LudoState) {
  let bestId = state.legal[0]
  let best = -Infinity
  const dice = state.dice ?? 0
  for (const id of state.legal) {
    const piece = state.pieces.find((item) => item.id === id)
    if (!piece) continue
    const from = piece.pos
    const to = from < 0 ? 0 : from + dice
    let score = to * 1.2
    if (wouldCapture(state, piece.player, to)) score += 120 + Math.max(0, to)
    if (to >= FINISH) score += 100
    else if (from < STRETCH && to >= STRETCH) score += 70
    if (from < 0) score += 55
    const dangerNow = threats(state, piece.player, from)
    const dangerAfter = to >= STRETCH ? 0 : threats(state, piece.player, to)
    score += dangerNow * (25 + Math.max(0, from))
    score -= dangerAfter * (30 + Math.max(0, to))
    if (to < STRETCH && isSafe(piece.player, to)) score += 30
    if (score > best) { best = score; bestId = id }
  }
  return bestId
}
