import { FINISH, STRETCH, globalIndex, isSafe } from "./board"
import { TURN_MS } from "../rules"

export type Piece = { id: string; player: number; pos: number }

export type LudoState = {
  pieces: Piece[]
  active: number[]
  bots: number[]
  turn: number
  phase: "roll" | "move"
  dice: number | null
  legal: string[]
  winner: number | null
  forfeited: number[]
  sixStreak: number
  deadline: number
  pauseUntil: number
  log: string
}

export function createMatch(active: number[], bots: number[], now: number): LudoState {
  const pieces: Piece[] = []
  for (const player of active) {
    for (let slot = 0; slot < 4; slot += 1) {
      pieces.push({ id: `${player}-${slot}`, player, pos: -1 })
    }
  }
  return {
    pieces,
    active,
    bots,
    turn: active[0],
    phase: "roll",
    dice: null,
    legal: [],
    winner: null,
    forfeited: [],
    sixStreak: 0,
    deadline: now + TURN_MS,
    pauseUntil: 0,
    log: "La partie commence.",
  }
}

function othersOn(state: LudoState, player: number, pos: number) {
  if (pos < 0 || pos >= STRETCH) return []
  const cell = globalIndex(player, pos)
  return state.pieces.filter((piece) => {
    if (piece.player === player || piece.pos < 0 || piece.pos >= STRETCH) return false
    return globalIndex(piece.player, piece.pos) === cell
  })
}

function blocked(state: LudoState, player: number, pos: number) {
  if (!isSafe(player, pos)) return false
  return othersOn(state, player, pos).length > 0
}

export function legalMoves(state: LudoState, dice: number) {
  const ids: string[] = []
  for (const piece of state.pieces) {
    if (piece.player !== state.turn || piece.pos >= FINISH) continue
    if (piece.pos < 0) {
      if (dice === 6 && !blocked(state, piece.player, 0)) ids.push(piece.id)
      continue
    }
    const next = piece.pos + dice
    if (next > FINISH) continue
    if (next < STRETCH && blocked(state, piece.player, next)) continue
    ids.push(piece.id)
  }
  return ids
}

function alive(state: LudoState) {
  return state.active.filter((player) => !state.forfeited.includes(player))
}

function nextTurn(state: LudoState) {
  const order = state.active
  const start = order.indexOf(state.turn)
  for (let step = 1; step <= order.length; step += 1) {
    const player = order[(start + step) % order.length]
    if (!state.forfeited.includes(player)) return player
  }
  return state.turn
}

function claimWinner(state: LudoState) {
  const remaining = alive(state)
  if (remaining.length === 1) {
    state.winner = remaining[0]
    state.log = "Un seul joueur reste en jeu."
    return
  }
  for (const player of remaining) {
    const done = state.pieces.filter((piece) => piece.player === player && piece.pos >= FINISH)
    if (done.length === 4) {
      state.winner = player
      state.log = "Les quatre pions sont arrivés."
    }
  }
}

function pass(state: LudoState, now: number, reason: string) {
  state.sixStreak = 0
  state.dice = null
  state.legal = []
  state.phase = "roll"
  state.turn = nextTurn(state)
  state.deadline = now + TURN_MS
  state.pauseUntil = state.bots.includes(state.turn) ? now + 600 : 0
  state.log = reason
  claimWinner(state)
}

function captures(state: LudoState, piece: Piece) {
  if (piece.pos < 0 || piece.pos >= STRETCH || isSafe(piece.player, piece.pos)) return
  for (const other of othersOn(state, piece.player, piece.pos)) other.pos = -1
}

export function applyRoll(state: LudoState, dice: number, now: number) {
  if (state.winner != null || state.phase !== "roll") return
  state.dice = dice
  if (dice === 6) state.sixStreak += 1
  else state.sixStreak = 0
  if (state.sixStreak >= 3) {
    pass(state, now, "Trois 6 d'affilée : le tour passe.")
    return
  }
  state.legal = legalMoves(state, dice)
  state.phase = "move"
  const auto = state.bots.includes(state.turn)
  if (state.legal.length === 0) {
    state.pauseUntil = now + 900
    state.log = `Dé ${dice} : aucun pion ne peut bouger.`
    return
  }
  state.deadline = now + TURN_MS
  state.pauseUntil = auto ? now + 700 : 0
  state.log = `Dé ${dice}.`
}

export function applyMove(state: LudoState, pieceId: string, now: number) {
  if (state.winner != null || state.phase !== "move") return false
  if (!state.legal.includes(pieceId) || state.dice == null) return false
  const piece = state.pieces.find((item) => item.id === pieceId)
  if (!piece) return false
  const dice = state.dice
  piece.pos = piece.pos < 0 ? 0 : piece.pos + dice
  captures(state, piece)
  claimWinner(state)
  if (state.winner != null) return true
  if (dice === 6) {
    state.phase = "roll"
    state.legal = []
    state.dice = null
    state.deadline = now + TURN_MS
    state.pauseUntil = state.bots.includes(state.turn) ? now + 500 : 0
    state.log = "6 : tu rejoues."
    return true
  }
  pass(state, now, "Au joueur suivant.")
  return true
}

export function forfeit(state: LudoState, player: number, now: number) {
  if (state.winner != null || state.forfeited.includes(player)) return
  state.forfeited.push(player)
  for (const piece of state.pieces) {
    if (piece.player === player) piece.pos = -1
  }
  if (state.turn === player) pass(state, now, "Un joueur abandonne.")
  else {
    state.log = "Un joueur abandonne."
    claimWinner(state)
  }
}

export function advance(state: LudoState, now: number, roll: () => number, choose: (state: LudoState) => string) {
  if (state.winner != null || now < state.pauseUntil) return false
  if (state.forfeited.includes(state.turn)) {
    pass(state, now, "Tour sauté.")
    return true
  }
  const auto = state.bots.includes(state.turn) || now >= state.deadline
  if (state.phase === "roll") {
    if (!auto) return false
    applyRoll(state, roll(), now)
    return true
  }
  if (state.legal.length === 0) {
    pass(state, now, state.log)
    return true
  }
  if (!auto) return false
  return applyMove(state, choose(state), now)
}
