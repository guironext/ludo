// Dames internationales 10x10 : prise obligatoire, prise majoritaire, rafles, dames volantes.
export type DColor = "w" | "b"
export type DPiece = { c: DColor; king: boolean }
export type DSquare = DPiece | null
export type DMove = { path: number[]; captured: number[] }
export type DamesState = { board: DSquare[]; turn: DColor; quiet: number }

const N = 10
const rw = (i: number) => Math.floor(i / N)
const cl = (i: number) => i % N
const on = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N
const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]]
export const dOther = (c: DColor): DColor => (c === "w" ? "b" : "w")
export const isDark = (i: number) => (rw(i) + cl(i)) % 2 === 1

export function initialDames(): DamesState {
  const board: DSquare[] = Array(N * N).fill(null)
  for (let i = 0; i < N * N; i++) {
    if (!isDark(i)) continue
    if (rw(i) <= 3) board[i] = { c: "b", king: false }
    if (rw(i) >= 6) board[i] = { c: "w", king: false }
  }
  return { board, turn: "w", quiet: 0 }
}

function captures(board: DSquare[], from: number, piece: DPiece): DMove[] {
  const results: DMove[] = []
  const walk = (pos: number, path: number[], taken: number[]) => {
    let extended = false
    for (const [dr, dc] of DIRS) {
      let r = rw(pos) + dr, c = cl(pos) + dc
      if (piece.king) {
        while (on(r, c) && !board[r * N + c]) { r += dr; c += dc }
      }
      if (!on(r, c)) continue
      const mid = r * N + c
      const t = board[mid]
      if (!t || t.c === piece.c || taken.includes(mid)) continue
      let lr = r + dr, lc = c + dc
      while (on(lr, lc) && !board[lr * N + lc]) {
        const land = lr * N + lc
        extended = true
        walk(land, [...path, land], [...taken, mid])
        if (!piece.king) break
        lr += dr; lc += dc
      }
    }
    if (!extended && taken.length) results.push({ path, captured: taken })
  }
  // la pièce qui joue quitte sa case pendant la rafle
  const saved = board[from]
  board[from] = null
  walk(from, [from], [])
  board[from] = saved
  return results
}

export function damesMoves(s: DamesState): DMove[] {
  const board = s.board.slice()
  let caps: DMove[] = []
  const simple: DMove[] = []
  for (let i = 0; i < N * N; i++) {
    const p = board[i]
    if (!p || p.c !== s.turn) continue
    caps = caps.concat(captures(board, i, p))
    for (const [dr, dc] of DIRS) {
      if (!p.king && dr !== (p.c === "w" ? -1 : 1)) continue
      let r = rw(i) + dr, c = cl(i) + dc
      while (on(r, c) && !board[r * N + c]) {
        simple.push({ path: [i, r * N + c], captured: [] })
        if (!p.king) break
        r += dr; c += dc
      }
    }
  }
  if (caps.length) {
    const max = Math.max(...caps.map((m) => m.captured.length))
    return caps.filter((m) => m.captured.length === max)
  }
  return simple
}

export function applyDames(s: DamesState, m: DMove): DamesState {
  const board = s.board.slice()
  const from = m.path[0], to = m.path[m.path.length - 1]
  const p = board[from]!
  board[from] = null
  for (const x of m.captured) board[x] = null
  const promote = !p.king && rw(to) === (p.c === "w" ? 0 : N - 1)
  board[to] = { c: p.c, king: p.king || promote }
  const quiet = m.captured.length || !p.king ? 0 : s.quiet + 1
  return { board, turn: dOther(s.turn), quiet }
}

export type DamesStatus = { kind: "playing" } | { kind: "win"; winner: DColor } | { kind: "draw" }

export function damesStatus(s: DamesState): DamesStatus {
  if (s.quiet >= 50) return { kind: "draw" } // 25 coups de dames de chaque côté sans prise
  if (damesMoves(s).length === 0) return { kind: "win", winner: dOther(s.turn) }
  return { kind: "playing" }
}

function material(s: DamesState, me: DColor) {
  let v = 0
  for (let i = 0; i < N * N; i++) {
    const p = s.board[i]
    if (!p) continue
    const adv = p.c === "w" ? 9 - rw(i) : rw(i)
    const val = p.king ? 300 : 100 + adv * 2
    v += p.c === me ? val : -val
  }
  return v
}

/** IA : meilleur coup sur 2 demi-coups (matériel), avec un peu de hasard. */
export function damesAi(s: DamesState): DMove | null {
  const moves = damesMoves(s)
  if (!moves.length) return null
  let best = moves[0], bestV = -Infinity
  for (const m of moves) {
    const n = applyDames(s, m)
    const replies = damesMoves(n)
    let worst = Infinity
    if (!replies.length) worst = 100000
    for (const rep of replies) worst = Math.min(worst, material(applyDames(n, rep), s.turn))
    const v = worst + Math.random() * 10
    if (v > bestV) { bestV = v; best = m }
  }
  return best
}
