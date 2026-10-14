// Partie de jeu de plateau à 2 (échecs, dames, awalé), stockée dans Game.stateJson côté serveur.
import { aiMoveTimed, applyMove, chessStatus, initialChess, legalMoves, type ChessState, type PieceType } from "./chess"
import { applyDames, damesAiPro, damesMoves, damesStatus, initialDames, type DamesState } from "./dames"
import { initialScrabble, playScrabble, redactScrabble, scrabbleAi, scrabbleWinner, type Dict, type Placement, type ScrabbleInput, type ScrabbleState } from "./scrabble"
import { awaleAiPro, awaleMoves, awaleWinner, initialAwale, playAwale, type AwaleState } from "./awale"

export const BOARD_GAMES = ["echecs", "dames", "awale", "scrabble"] as const
export type BoardGameType = (typeof BOARD_GAMES)[number]
export type GameType = "ludo" | BoardGameType
export const GAME_LABELS: Record<GameType, string> = { ludo: "Ludo", echecs: "Échecs", dames: "Dames", awale: "Awalé", scrabble: "Scrabble" }
export const SIDE_LABELS: Record<BoardGameType, [string, string]> = {
  echecs: ["Blancs", "Noirs"],
  dames: ["Blancs", "Noirs"],
  awale: ["Sud", "Nord"],
  scrabble: ["Joueur 1", "Joueur 2"],
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
  | { game: "scrabble"; s: ScrabbleState }

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

export type BoardInput = {
  from?: number
  to?: number
  promo?: string
  pit?: number
  /** Scrabble : pose, passe ou échange. */
  kind?: "place" | "pass" | "exchange"
  tiles?: Placement[]
  letters?: string[]
}

function scrabbleInput(input: BoardInput): ScrabbleInput | null {
  if (input.kind === "pass") return { kind: "pass" }
  if (input.kind === "exchange" && Array.isArray(input.letters)) return { kind: "exchange", letters: input.letters.map(String) }
  if (input.kind === "place" && Array.isArray(input.tiles)) {
    return { kind: "place", tiles: input.tiles.map((t) => ({ i: Number(t.i), l: String(t.l).toUpperCase(), blank: Boolean(t.blank) || undefined })) }
  }
  return null
}

/** Message d'erreur d'un coup de Scrabble (null s'il est valide). Validation dictionnaire côté serveur. */
export function scrabbleError(m: BoardMatch, seat: number, input: BoardInput, dict: Dict): string | null {
  if (m.data.game !== "scrabble" || m.turn !== seat) return null
  const si = scrabbleInput(input)
  if (!si) return "Coup invalide."
  const r = playScrabble(m.data.s, si, dict)
  return typeof r === "string" ? r : null
}

/** Copie du match visible par un siège : au Scrabble, chevalet adverse et sac masqués. */
export function boardView(m: BoardMatch, seat: number | null): BoardMatch {
  if (m.data.game !== "scrabble") return m
  const side = seat == null ? null : sideOf(m, seat)
  return { ...m, data: { game: "scrabble", s: redactScrabble(m.data.s, side) } }
}

const AI_DELAY = 700

export function isBoardMatch(value: unknown): value is BoardMatch {
  return Boolean(value && typeof value === "object" && (value as BoardMatch).board === true)
}

function sideToMove(data: BoardData): 0 | 1 {
  if (data.game === "echecs") return data.s.turn === "w" ? 0 : 1
  if (data.game === "dames") return data.s.turn === "w" ? 0 : 1
  if (data.game === "scrabble") return data.s.turn
  return data.s.turn
}

export function sideOf(m: BoardMatch, seat: number): 0 | 1 | null {
  const i = m.seats.indexOf(seat)
  return i === 0 || i === 1 ? i : null
}

export function createBoardMatch(game: BoardGameType, seats: number[], bots: number[], now: number): BoardMatch {
  const data: BoardData =
    game === "echecs"
      ? { game, s: initialChess() }
      : game === "dames"
        ? { game, s: initialDames() }
        : game === "scrabble"
          ? { game, s: initialScrabble() }
          : { game, s: initialAwale() }
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
  } else if (d.game === "scrabble") {
    if (d.s.log) m.log = d.s.log
    const w = scrabbleWinner(d.s)
    if (w === "draw") { m.draw = true; m.log = `Égalité ${d.s.scores[0]} – ${d.s.scores[1]} : mises rendues.` }
    else if (w !== null) { m.winner = m.seats[w]; m.log = `Score final ${d.s.scores[0]} – ${d.s.scores[1]}.` }
  } else {
    const w = awaleWinner(d.s)
    if (d.s.log) m.log = d.s.log
    if (w === "draw") { m.draw = true; m.log = "Égalité 24 – 24." }
    else if (w !== null) { m.winner = m.seats[w]; m.log = `Score final ${d.s.store[0]} – ${d.s.store[1]}.` }
  }
}

/** Applique un coup ; renvoie false s'il est illégal. Le siège doit être au trait. */
export function boardPlay(m: BoardMatch, seat: number, input: BoardInput, now: number, dict: Dict | null = null): boolean {
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
  } else if (d.game === "scrabble") {
    // le dictionnaire n'existe que côté serveur : sans lui, aucun coup de Scrabble n'est accepté
    const si = scrabbleInput(input)
    if (!dict || !si) return false
    const r = playScrabble(d.s, si, dict)
    if (typeof r === "string") return false
    d.s = r
    m.last = si.kind === "place" ? si.tiles.map((t) => t.i) : []
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
 * `pro` (décidé côté serveur d'après la partie) : niveau maximal ; sinon niveau renforcé un cran en dessous. */
export function boardAdvance(m: BoardMatch, now: number, pro = false, dict: Dict | null = null): boolean {
  if (m.winner != null || m.draw || !m.bots.includes(m.turn) || now < m.aiAt) return false
  const d = m.data
  let input: BoardInput | null = null
  if (d.game === "echecs") {
    const mv = pro ? aiMoveTimed(d.s, 800, 5) : aiMoveTimed(d.s, 300, 3)
    if (mv) input = { from: mv.from, to: mv.to, promo: mv.promo }
  } else if (d.game === "dames") {
    const mv = pro ? damesAiPro(d.s) : damesAiPro(d.s, 300, 5)
    if (mv) input = { from: mv.path[0], to: mv.path[mv.path.length - 1] }
  } else if (d.game === "scrabble") {
    if (!dict) return false
    const ai = scrabbleAi(d.s, dict, pro)
    input = ai.kind === "place" ? { kind: "place", tiles: ai.tiles } : ai.kind === "exchange" ? { kind: "exchange", letters: ai.letters } : { kind: "pass" }
  } else {
    const pit = pro ? awaleAiPro(d.s) : awaleAiPro(d.s, 300, 7)
    if (pit != null) input = { pit }
  }
  if (!input) { settle(m, now); return true }
  return boardPlay(m, m.turn, input, now, dict)
}

export function boardForfeit(m: BoardMatch, seat: number) {
  if (m.winner != null || m.draw) return
  const other = m.seats.find((s) => s !== seat)
  if (other == null) return
  m.forfeited.push(seat)
  m.winner = other
  m.log = "Abandon."
}
