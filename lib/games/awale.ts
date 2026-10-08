// Awalé (règles abapa). Cases 0-5 : joueur 0 (bas, de gauche à droite) ; 6-11 : joueur 1 (haut, de droite à gauche).
export type AwaleState = { pits: number[]; store: [number, number]; turn: 0 | 1; noCapture: number; over: boolean; log: string }

export const side = (p: 0 | 1) => (p === 0 ? [0, 1, 2, 3, 4, 5] : [6, 7, 8, 9, 10, 11])
const owner = (i: number): 0 | 1 => (i < 6 ? 0 : 1)
const seedsOf = (pits: number[], p: 0 | 1) => side(p).reduce((a, i) => a + pits[i], 0)

export function initialAwale(): AwaleState {
  return { pits: Array(12).fill(4), store: [0, 0], turn: 0, noCapture: 0, over: false, log: "" }
}

function sow(pits: number[], from: number) {
  const next = pits.slice()
  let seeds = next[from]
  next[from] = 0
  let i = from
  while (seeds > 0) {
    i = (i + 1) % 12
    if (i === from) continue // on saute la case de départ (12 graines ou plus)
    next[i]++
    seeds--
  }
  return { next, last: i }
}

export function awaleMoves(s: AwaleState): number[] {
  if (s.over) return []
  const opp = (1 - s.turn) as 0 | 1
  const mine = side(s.turn).filter((i) => s.pits[i] > 0)
  if (seedsOf(s.pits, opp) > 0) return mine
  // l'adversaire n'a plus de graines : il faut le nourrir
  return mine.filter((i) => seedsOf(sow(s.pits, i).next, opp) > 0)
}

export function playAwale(s: AwaleState, from: number): AwaleState {
  const opp = (1 - s.turn) as 0 | 1
  const { next, last } = sow(s.pits, from)
  let gain = 0
  const after = next.slice()
  let i = last
  while (owner(i) === opp && (after[i] === 2 || after[i] === 3)) {
    gain += after[i]
    after[i] = 0
    i--
    if (i < 0) break
  }
  let pits = after
  let log = gain ? `${gain} graines prises.` : ""
  if (gain && seedsOf(after, opp) === 0) {
    // grand chelem : coup joué mais aucune prise
    pits = next
    gain = 0
    log = "Grand chelem : coup permis, pas de prise."
  }
  const store: [number, number] = [s.store[0], s.store[1]]
  store[s.turn] += gain
  let st: AwaleState = { pits, store, turn: opp, noCapture: gain ? 0 : s.noCapture + 1, over: false, log }
  if (store[0] >= 25 || store[1] >= 25 || (store[0] === 24 && store[1] === 24)) return { ...st, over: true }
  if (st.noCapture >= 100) return endCollect(st, "Partie bloquée : chacun ramasse ses graines.")
  if (awaleMoves(st).length === 0) {
    // le joueur au trait ne peut pas jouer (ou ne peut pas nourrir) : il ramasse ce qui reste de son côté,
    // l'adversaire ramasse le sien.
    st = endCollect(st, "Plus de coup possible : chacun ramasse ses graines.")
  }
  return st
}

function endCollect(s: AwaleState, log: string): AwaleState {
  const store: [number, number] = [s.store[0] + seedsOf(s.pits, 0), s.store[1] + seedsOf(s.pits, 1)]
  return { ...s, pits: Array(12).fill(0), store, over: true, log }
}

export function awaleWinner(s: AwaleState): 0 | 1 | "draw" | null {
  if (!s.over) return null
  if (s.store[0] === s.store[1]) return "draw"
  return s.store[0] > s.store[1] ? 0 : 1
}

function score(s: AwaleState, me: 0 | 1) {
  const w = awaleWinner(s)
  if (w === me) return 1000
  if (w !== null && w !== "draw") return -1000
  return s.store[me] - s.store[1 - me]
}

function minimax(s: AwaleState, depth: number, me: 0 | 1): number {
  const moves = awaleMoves(s)
  if (depth === 0 || !moves.length) return score(s, me)
  const vals = moves.map((m) => minimax(playAwale(s, m), depth - 1, me))
  return s.turn === me ? Math.max(...vals) : Math.min(...vals)
}

/** IA : minimax sur 4 demi-coups selon les graines prises. */
export function awaleAi(s: AwaleState): number | null {
  const moves = awaleMoves(s)
  if (!moves.length) return null
  let best = moves[0], bestV = -Infinity
  for (const m of moves) {
    const v = minimax(playAwale(s, m), 3, s.turn) + Math.random() * 0.5
    if (v > bestV) { bestV = v; best = m }
  }
  return best
}
