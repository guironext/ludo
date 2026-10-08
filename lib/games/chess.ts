// Échecs : logique pure (coups légaux, échec, mat, pat, roque, prise en passant, promotion).
export type Color = "w" | "b"
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k"
export type Piece = { t: PieceType; c: Color }
export type Square = Piece | null
export type Move = { from: number; to: number; promo?: PieceType; ep?: boolean; castle?: "K" | "Q" }
export type ChessState = {
  board: Square[] // index = rang*8 + colonne, rang 0 = 8e rangée (noirs en haut)
  turn: Color
  castling: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean }
  ep: number | null
  halfmove: number
}
export type ChessStatus =
  | { kind: "playing"; check: boolean }
  | { kind: "checkmate"; winner: Color }
  | { kind: "stalemate" }
  | { kind: "draw"; reason: string }

const r = (i: number) => Math.floor(i / 8)
const c = (i: number) => i % 8
const on = (row: number, col: number) => row >= 0 && row < 8 && col >= 0 && col < 8
export const other = (col: Color): Color => (col === "w" ? "b" : "w")

export function initialChess(): ChessState {
  const back: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"]
  const board: Square[] = Array(64).fill(null)
  for (let i = 0; i < 8; i++) {
    board[i] = { t: back[i], c: "b" }
    board[8 + i] = { t: "p", c: "b" }
    board[48 + i] = { t: "p", c: "w" }
    board[56 + i] = { t: back[i], c: "w" }
  }
  return { board, turn: "w", castling: { wK: true, wQ: true, bK: true, bQ: true }, ep: null, halfmove: 0 }
}

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]]
const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]]

export function isAttacked(board: Square[], sq: number, by: Color): boolean {
  const row = r(sq), col = c(sq)
  const pd = by === "w" ? 1 : -1 // un pion blanc attaque depuis la rangée du dessous
  for (const dc of [-1, 1]) {
    const rr = row + pd, cc = col + dc
    if (on(rr, cc)) { const p = board[rr * 8 + cc]; if (p && p.c === by && p.t === "p") return true }
  }
  for (const [dr, dc] of KNIGHT) {
    const rr = row + dr, cc = col + dc
    if (on(rr, cc)) { const p = board[rr * 8 + cc]; if (p && p.c === by && p.t === "n") return true }
  }
  for (const [dr, dc] of KING) {
    const rr = row + dr, cc = col + dc
    if (on(rr, cc)) { const p = board[rr * 8 + cc]; if (p && p.c === by && p.t === "k") return true }
  }
  for (const [dirs, types] of [[DIAG, ["b", "q"]], [ORTHO, ["r", "q"]]] as const) {
    for (const [dr, dc] of dirs) {
      let rr = row + dr, cc = col + dc
      while (on(rr, cc)) {
        const p = board[rr * 8 + cc]
        if (p) { if (p.c === by && (types as readonly string[]).includes(p.t)) return true; break }
        rr += dr; cc += dc
      }
    }
  }
  return false
}

export function kingSquare(board: Square[], col: Color) {
  return board.findIndex((p) => p?.t === "k" && p.c === col)
}

export function inCheck(s: ChessState, col: Color = s.turn) {
  return isAttacked(s.board, kingSquare(s.board, col), other(col))
}

function pseudoMoves(s: ChessState): Move[] {
  const out: Move[] = []
  const { board, turn } = s
  for (let i = 0; i < 64; i++) {
    const p = board[i]
    if (!p || p.c !== turn) continue
    const row = r(i), col = c(i)
    if (p.t === "p") {
      const d = turn === "w" ? -1 : 1
      const start = turn === "w" ? 6 : 1
      const last = turn === "w" ? 0 : 7
      const push = (to: number, ep = false) => {
        if (r(to) === last) for (const promo of ["q", "r", "b", "n"] as PieceType[]) out.push({ from: i, to, promo })
        else out.push(ep ? { from: i, to, ep } : { from: i, to })
      }
      if (on(row + d, col) && !board[(row + d) * 8 + col]) {
        push((row + d) * 8 + col)
        if (row === start && !board[(row + 2 * d) * 8 + col]) out.push({ from: i, to: (row + 2 * d) * 8 + col })
      }
      for (const dc of [-1, 1]) {
        if (!on(row + d, col + dc)) continue
        const to = (row + d) * 8 + col + dc
        const t = board[to]
        if (t && t.c !== turn) push(to)
        else if (to === s.ep) push(to, true)
      }
    } else if (p.t === "n" || p.t === "k") {
      for (const [dr, dc] of p.t === "n" ? KNIGHT : KING) {
        if (!on(row + dr, col + dc)) continue
        const to = (row + dr) * 8 + col + dc
        const t = board[to]
        if (!t || t.c !== turn) out.push({ from: i, to })
      }
      if (p.t === "k") {
        const home = turn === "w" ? 60 : 4
        const opp = other(turn)
        if (i === home && !isAttacked(board, home, opp)) {
          const k = turn === "w" ? s.castling.wK : s.castling.bK
          const q = turn === "w" ? s.castling.wQ : s.castling.bQ
          const rook = (sq: number) => board[sq]?.t === "r" && board[sq]?.c === turn
          if (k && rook(home + 3) && !board[home + 1] && !board[home + 2] && !isAttacked(board, home + 1, opp) && !isAttacked(board, home + 2, opp))
            out.push({ from: home, to: home + 2, castle: "K" })
          if (q && rook(home - 4) && !board[home - 1] && !board[home - 2] && !board[home - 3] && !isAttacked(board, home - 1, opp) && !isAttacked(board, home - 2, opp))
            out.push({ from: home, to: home - 2, castle: "Q" })
        }
      }
    } else {
      const dirs = p.t === "b" ? DIAG : p.t === "r" ? ORTHO : [...DIAG, ...ORTHO]
      for (const [dr, dc] of dirs) {
        let rr = row + dr, cc = col + dc
        while (on(rr, cc)) {
          const t = board[rr * 8 + cc]
          if (t) { if (t.c !== turn) out.push({ from: i, to: rr * 8 + cc }); break }
          out.push({ from: i, to: rr * 8 + cc })
          rr += dr; cc += dc
        }
      }
    }
  }
  return out
}

export function applyMove(s: ChessState, m: Move): ChessState {
  const board = s.board.slice()
  const p = board[m.from]!
  const captured = board[m.to]
  board[m.to] = m.promo ? { t: m.promo, c: p.c } : p
  board[m.from] = null
  if (m.ep) board[m.to + (p.c === "w" ? 8 : -8)] = null
  if (m.castle === "K") { board[m.from + 1] = board[m.from + 3]; board[m.from + 3] = null }
  if (m.castle === "Q") { board[m.from - 1] = board[m.from - 4]; board[m.from - 4] = null }
  const castling = { ...s.castling }
  if (p.t === "k") { if (p.c === "w") { castling.wK = false; castling.wQ = false } else { castling.bK = false; castling.bQ = false } }
  for (const sq of [m.from, m.to]) {
    if (sq === 63) castling.wK = false
    if (sq === 56) castling.wQ = false
    if (sq === 7) castling.bK = false
    if (sq === 0) castling.bQ = false
  }
  const ep = p.t === "p" && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : null
  const halfmove = p.t === "p" || captured || m.ep ? 0 : s.halfmove + 1
  return { board, turn: other(s.turn), castling, ep, halfmove }
}

export function legalMoves(s: ChessState): Move[] {
  return pseudoMoves(s).filter((m) => {
    const n = applyMove(s, m)
    return !isAttacked(n.board, kingSquare(n.board, s.turn), n.turn)
  })
}

function insufficient(board: Square[]) {
  const rest = board.filter((p): p is Piece => !!p && p.t !== "k")
  if (rest.length === 0) return true
  return rest.length === 1 && (rest[0].t === "b" || rest[0].t === "n")
}

export function chessStatus(s: ChessState): ChessStatus {
  const check = inCheck(s)
  if (legalMoves(s).length === 0) return check ? { kind: "checkmate", winner: other(s.turn) } : { kind: "stalemate" }
  if (s.halfmove >= 100) return { kind: "draw", reason: "règle des 50 coups" }
  if (insufficient(s.board)) return { kind: "draw", reason: "matériel insuffisant" }
  return { kind: "playing", check }
}

const VALUE: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }

function evaluate(s: ChessState): number {
  // score du point de vue du camp au trait
  let score = 0
  for (let i = 0; i < 64; i++) {
    const p = s.board[i]
    if (!p) continue
    let v = VALUE[p.t]
    const cr = 3.5 - Math.abs(3.5 - c(i)), rr = 3.5 - Math.abs(3.5 - r(i))
    if (p.t === "n" || p.t === "b") v += (cr + rr) * 4
    if (p.t === "p") v += (p.c === "w" ? 6 - r(i) : r(i) - 1) * 6 + cr * 2
    score += p.c === s.turn ? v : -v
  }
  return score
}

function search(s: ChessState, depth: number, alpha: number, beta: number): number {
  const moves = legalMoves(s)
  if (moves.length === 0) return inCheck(s) ? -100000 - depth : 0
  if (depth === 0) return evaluate(s)
  for (const m of moves) {
    const v = -search(applyMove(s, m), depth - 1, -beta, -alpha)
    if (v > alpha) alpha = v
    if (alpha >= beta) break
  }
  return alpha
}

/** IA simple : recherche matérielle à 2 demi-coups (+ un peu de hasard). */
export function aiMove(s: ChessState, depth = 2): Move | null {
  const moves = legalMoves(s).filter((m) => !m.promo || m.promo === "q")
  if (!moves.length) return null
  moves.sort(() => Math.random() - 0.5)
  let best = moves[0], bestV = -Infinity
  for (const m of moves) {
    const v = -search(applyMove(s, m), depth - 1, -Infinity, -bestV) + Math.random() * 8
    if (v > bestV) { bestV = v; best = m }
  }
  return best
}

export const GLYPH: Record<Color, Record<PieceType, string>> = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
}
