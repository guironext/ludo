// Partie de jeu de plateau à 2 (échecs, dames, awalé), stockée dans Game.stateJson côté serveur.
import { aiMove, applyMove, chessStatus, initialChess, legalMoves, type ChessState, type PieceType } from "./chess"
import { applyDames, damesAi, damesAiPro, damesMoves, damesStatus, initialDames, type DamesState } from "./dames"
import { awaleAi, awaleAiPro, awaleMoves, awaleWinner, initialAwale, playAwale, type AwaleState } from "./awale"

export const BOARD_GAMES = ["echecs", "dames", "awale"] as const
export type BoardGameType = (typeof BOARD_GAMES)[number]
export type GameType = "ludo" | BoardGameType
export const GAME_LABELS: Record<GameType, string> = { ludo: "Ludo", echecs: "Échecs", dames: "Dames", awale: "Awalé" }
export const SIDE_LABELS: Record<BoardGameType, [string, string]> = {
  echecs: ["Blancs", "Noirs"],
  dames: ["Blancs", "Noirs"],
  awale: ["Sud", "Nord"],
}

export function isBoardGame(value: unknown): value is BoardGameType {
  return typeof value === "string" && (BOARD_GAMES as readonly string[]).includes(value)
}
export function parseGameType(value: unknown): GameType {
  return isBoardGame(value) ? value : "ludo"
}

export type BoardData =
  | { game: "echecs"; s: ChessState }
  | { game: "dames"; s: DamesState }
  | { game: "awale"; s: AwaleState }

export type BoardMatch = {
  board: true
  seats: [number, number]
  bots: number[]
  data: BoardData
  turn: number // siège au trait
  winner: number | null
  draw: boolean
  forfeited: number[]
  moves: number
  last: number[] // cases du dernier coup (surbrillance)
  log: string
  aiAt: number
}

export type BoardInput = { from?: number; to?: number; promo?: string; pit?: number }

const AI_DELAY = 700

export function isBoardMatch(value: unknown): value is BoardMatch {
  return Boolean(value && typeof value === "object" && (value as BoardMatch).board === true)
}

function sideToMove(data: BoardData): 0 | 1 {
  if (data.game === "echecs") return data.s.turn === "w" ? 0 : 1
  if (data.game === "dames") return data.s.turn === "w" ? 0 : 1
  return data.s.turn
}

export function sideOf(m: BoardMatch, seat: number): 0 | 1 | null {
  const i = m.seats.indexOf(seat)
  return i === 0 || i === 1 ? i : null
}

export function createBoardMatch(game: BoardGameType, seats: number[], bots: number[], now: number): BoardMatch {
  const data: BoardData =
    game === "echecs" ? { game, s: initialChess() } : game === "dames" ? { game, s: initialDames() } : { game, s: initialAwale() }
  const pair: [number, number] = [seats[0], seats[1]]
  return {
    board: true,
    seats: pair,
    bots,
    data,
    turn: pair[0],
    winner: null,
    draw: false,
    forfeited: [],
    moves: 0,
    last: [],
    log: "La partie commence.",
    aiAt: now + AI_DELAY,
  }
}

function settle(m: BoardMatch, now: number) {
  const d = m.data
  m.turn = m.seats[sideToMove(d)]
  m.aiAt = now + AI_DELAY
  if (d.game === "echecs") {
    const st = chessStatus(d.s)
    if (st.kind === "checkmate") { m.winner = m.seats[st.winner === "w" ? 0 : 1]; m.log = "Échec et mat." }
    else if (st.kind === "stalemate") { m.draw = true; m.log = "Pat : partie nulle." }
    else if (st.kind === "draw") { m.draw = true; m.log = `Nulle : ${st.reason}.` }
    else if (st.check) m.log = "Échec !"
  } else if (d.game === "dames") {
    const st = damesStatus(d.s)
    if (st.kind === "win") { m.winner = m.seats[st.winner === "w" ? 0 : 1]; m.log = "Plus de coup possible pour l'adversaire." }
    else if (st.kind === "draw") { m.draw = true; m.log = "Nulle : 25 coups de dames sans prise." }
  } else {
    const w = awaleWinner(d.s)
    if (d.s.log) m.log = d.s.log
    if (w === "draw") { m.draw = true; m.log = "Égalité 24 – 24." }
    else if (w !== null) { m.winner = m.seats[w]; m.log = `Score final ${d.s.store[0]} – ${d.s.store[1]}.` }
  }
}

/** Applique un coup ; renvoie false s'il est illégal. Le siège doit être au trait. */
export function boardPlay(m: BoardMatch, seat: number, input: BoardInput, now: number): boolean {
  if (m.winner != null || m.draw || m.turn !== seat) return false
  const d = m.data
  m.log = ""
  if (d.game === "echecs") {
    const promo = (["q", "r", "b", "n"].includes(input.promo ?? "") ? input.promo : "q") as PieceType
    const mv = legalMoves(d.s).find((x) => x.from === input.from && x.to === input.to && (!x.promo || x.promo === promo))
    if (!mv) return false
    d.s = applyMove(d.s, mv)
    m.last = [mv.from, mv.to]
  } else if (d.game === "dames") {
    const mv = damesMoves(d.s).find((x) => x.path[0] === input.from && x.path[x.path.length - 1] === input.to)
    if (!mv) return false
    d.s = applyDames(d.s, mv)
    m.last = mv.path
    if (mv.captured.length) m.log = `${mv.captured.length} pion${mv.captured.length > 1 ? "s" : ""} pris.`
  } else {
    if (input.pit == null || !awaleMoves(d.s).includes(input.pit)) return false
    d.s = playAwale(d.s, input.pit)
    m.last = [input.pit]
  }
  m.moves++
  settle(m, now)
  return true
}

/** Fait jouer l'ordinateur s'il est au trait. Renvoie true si l'état a changé.
 * `pro` (décidé côté serveur d'après la partie) : niveau maximal en dames et awalé. */
export function boardAdvance(m: BoardMatch, now: number, pro = false): boolean {
  if (m.winner != null || m.draw || !m.bots.includes(m.turn) || now < m.aiAt) return false
  const d = m.data
  let input: BoardInput | null = null
  if (d.game === "echecs") {
    const mv = aiMove(d.s)
    if (mv) input = { from: mv.from, to: mv.to, promo: mv.promo }
  } else if (d.game === "dames") {
    const mv = pro ? damesAiPro(d.s) : damesAi(d.s)
    if (mv) input = { from: mv.path[0], to: mv.path[mv.path.length - 1] }
  } else {
    const pit = pro ? awaleAiPro(d.s) : awaleAi(d.s)
    if (pit != null) input = { pit }
  }
  if (!input) { settle(m, now); return true }
  return boardPlay(m, m.turn, input, now)
}

export function boardForfeit(m: BoardMatch, seat: number) {
  if (m.winner != null || m.draw) return
  const other = m.seats.find((s) => s !== seat)
  if (other == null) return
  m.forfeited.push(seat)
  m.winner = other
  m.log = "Abandon."
}
