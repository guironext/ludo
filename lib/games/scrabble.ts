// Scrabble francophone : règles, score et générateur de coups. Aucune dépendance serveur :
// le dictionnaire est fourni par l'appelant (validation côté serveur, voir lib/games/scrabble-dico.ts).

export const SIZE = 15
export const CENTER = 112
export const RACK = 7
export const BLANK = "?"

/** Distribution et valeurs officielles du Scrabble français (102 jetons). */
export const LETTERS: Record<string, { n: number; v: number }> = {
  A: { n: 9, v: 1 }, B: { n: 2, v: 3 }, C: { n: 2, v: 3 }, D: { n: 3, v: 2 }, E: { n: 15, v: 1 }, F: { n: 2, v: 4 },
  G: { n: 2, v: 2 }, H: { n: 2, v: 4 }, I: { n: 8, v: 1 }, J: { n: 1, v: 8 }, K: { n: 1, v: 10 }, L: { n: 5, v: 1 },
  M: { n: 3, v: 2 }, N: { n: 6, v: 1 }, O: { n: 6, v: 1 }, P: { n: 2, v: 3 }, Q: { n: 1, v: 8 }, R: { n: 6, v: 1 },
  S: { n: 6, v: 1 }, T: { n: 6, v: 1 }, U: { n: 6, v: 1 }, V: { n: 2, v: 4 }, W: { n: 1, v: 10 }, X: { n: 1, v: 10 },
  Y: { n: 1, v: 10 }, Z: { n: 1, v: 10 }, [BLANK]: { n: 2, v: 0 },
}
export const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
export const tileValue = (l: string) => LETTERS[l]?.v ?? 0

export type Premium = "" | "MD" | "MT" | "LD" | "LT"
const TW = ["0,0", "0,7", "7,0"]
const DW = ["1,1", "2,2", "3,3", "4,4", "7,7"]
const TL = ["1,5", "5,1", "5,5"]
const DL = ["0,3", "3,0", "2,6", "6,2", "3,7", "7,3", "6,6"]
function sym(list: string[]) {
  const out = new Set<number>()
  for (const k of list) {
    const [r, c] = k.split(",").map(Number)
    for (const [a, b] of [[r, c], [c, r]]) for (const rr of [a, 14 - a]) for (const cc of [b, 14 - b]) out.add(rr * SIZE + cc)
  }
  return out
}
const SETS: [Premium, Set<number>][] = [["MT", sym(TW)], ["MD", sym(DW)], ["LT", sym(TL)], ["LD", sym(DL)]]
export const PREMIUM: Premium[] = Array.from({ length: SIZE * SIZE }, (_, i) => SETS.find(([, s]) => s.has(i))?.[0] ?? "")

export type Cell = { l: string; blank: boolean } | null
export type Placement = { i: number; l: string; blank?: boolean }
export type ScrabbleState = {
  board: Cell[]
  racks: [string[], string[]]
  bag: string[]
  bagCount?: number
  scores: [number, number]
  turn: 0 | 1
  passes: number
  over: boolean
  lastWords: string[]
  log: string
  endBonus?: [number, number]
}
export type Dict = { has: (w: string) => boolean; prefix: (p: string) => boolean }

function shuffle<T>(a: T[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function initialScrabble(): ScrabbleState {
  const bag: string[] = []
  for (const [l, { n }] of Object.entries(LETTERS)) for (let k = 0; k < n; k++) bag.push(l)
  shuffle(bag)
  const racks: [string[], string[]] = [bag.splice(0, RACK), bag.splice(0, RACK)]
  return { board: Array(SIZE * SIZE).fill(null), racks, bag, scores: [0, 0], turn: 0, passes: 0, over: false, lastWords: [], log: "" }
}

const rowOf = (i: number) => Math.floor(i / SIZE)
const colOf = (i: number) => i % SIZE

/** Copie la grille avec les jetons posés ; renvoie null si une case est occupée ou hors grille. */
function overlay(board: Cell[], tiles: Placement[]) {
  const b = board.slice()
  for (const t of tiles) {
    if (!Number.isInteger(t.i) || t.i < 0 || t.i >= SIZE * SIZE || b[t.i]) return null
    b[t.i] = { l: t.l, blank: Boolean(t.blank) }
  }
  return b
}

/** Mot (début, cases) passant par i dans la direction d (1 = horizontal, 15 = vertical). */
function wordAt(b: Cell[], i: number, d: 1 | 15) {
  const sameLine = (a: number, c: number) => (d === 1 ? rowOf(a) === rowOf(c) : true)
  let s = i
  while (s - d >= 0 && sameLine(s - d, s) && b[s - d]) s -= d
  const cells: number[] = []
  let k = s
  while (k < SIZE * SIZE && sameLine(k, s) && b[k]) { cells.push(k); k += d }
  return cells
}

export type Evaluated = { ok: true; score: number; words: { word: string; score: number }[] } | { ok: false; error: string }

/** Vérifie un placement (alignement, connexion, premier coup au centre, mots du dictionnaire) et calcule le score. */
export function evaluatePlacement(s: ScrabbleState, tiles: Placement[], dict: Dict | null): Evaluated {
  if (!tiles.length) return { ok: false, error: "Pose au moins une lettre." }
  if (new Set(tiles.map((t) => t.i)).size !== tiles.length) return { ok: false, error: "Deux lettres sur la même case." }
  for (const t of tiles) if (!ALPHA.includes(t.l) || t.l.length !== 1) return { ok: false, error: "Lettre invalide." }
  const b = overlay(s.board, tiles)
  if (!b) return { ok: false, error: "Case déjà occupée." }
  const rows = new Set(tiles.map((t) => rowOf(t.i)))
  const cols = new Set(tiles.map((t) => colOf(t.i)))
  if (rows.size > 1 && cols.size > 1) return { ok: false, error: "Les lettres doivent être alignées." }
  const d: 1 | 15 = tiles.length === 1 ? (wordAt(b, tiles[0].i, 1).length > 1 ? 1 : 15) : rows.size === 1 ? 1 : 15
  const main = wordAt(b, tiles[0].i, d)
  if (!tiles.every((t) => main.includes(t.i))) return { ok: false, error: "Les lettres doivent former un seul mot sans trou." }
  const empty = s.board.every((c) => !c)
  if (empty) {
    if (!tiles.some((t) => t.i === CENTER)) return { ok: false, error: "Le premier mot passe par la case centrale ★." }
    if (main.length < 2) return { ok: false, error: "Le premier mot fait au moins 2 lettres." }
  } else {
    const touches = tiles.some((t) => {
      const r = rowOf(t.i), c = colOf(t.i)
      const n = [r > 0 ? t.i - SIZE : -1, r < 14 ? t.i + SIZE : -1, c > 0 ? t.i - 1 : -1, c < 14 ? t.i + 1 : -1]
      return n.some((k) => k >= 0 && s.board[k])
    })
    if (!touches) return { ok: false, error: "Le mot doit toucher une lettre déjà posée." }
  }
  const fresh = new Set(tiles.map((t) => t.i))
  const lines: number[][] = []
  if (main.length > 1) lines.push(main)
  for (const t of tiles) {
    const cross = wordAt(b, t.i, d === 1 ? 15 : 1)
    if (cross.length > 1) lines.push(cross)
  }
  if (!lines.length) return { ok: false, error: "Le mot fait au moins 2 lettres." }
  const words: { word: string; score: number }[] = []
  let total = 0
  for (const line of lines) {
    const word = line.map((k) => b[k]!.l).join("")
    if (dict && !dict.has(word)) return { ok: false, error: `« ${word} » n'est pas dans le dictionnaire.` }
    let sum = 0, mult = 1
    for (const k of line) {
      const cell = b[k]!
      let v = cell.blank ? 0 : tileValue(cell.l)
      if (fresh.has(k)) {
        const p = PREMIUM[k]
        if (p === "LD") v *= 2
        else if (p === "LT") v *= 3
        else if (p === "MD") mult *= 2
        else if (p === "MT") mult *= 3
      }
      sum += v
    }
    words.push({ word, score: sum * mult })
    total += sum * mult
  }
  if (tiles.length === RACK) total += 50
  return { ok: true, score: total, words }
}

/** Retire les jetons du chevalet (joker « ? » pour une lettre blanche). Null si absents. */
function takeFromRack(rack: string[], tiles: Placement[]) {
  const r = rack.slice()
  for (const t of tiles) {
    const k = r.indexOf(t.blank ? BLANK : t.l)
    if (k < 0) return null
    r.splice(k, 1)
  }
  return r
}

const rackPoints = (r: string[]) => r.reduce((a, l) => a + tileValue(l), 0)

function finish(s: ScrabbleState, outPlayer: 0 | 1 | null) {
  s.over = true
  const pen: [number, number] = [rackPoints(s.racks[0]), rackPoints(s.racks[1])]
  const bonus: [number, number] = [-pen[0], -pen[1]]
  if (outPlayer != null) bonus[outPlayer] += pen[1 - outPlayer]
  s.scores = [s.scores[0] + bonus[0], s.scores[1] + bonus[1]]
  s.endBonus = bonus
}

function nextTurn(s: ScrabbleState) {
  s.turn = s.turn === 0 ? 1 : 0
}

export type ScrabbleInput = { kind: "place"; tiles: Placement[] } | { kind: "pass" } | { kind: "exchange"; letters: string[] }

/** Joue un coup ; renvoie l'état suivant ou un message d'erreur. Ne modifie pas `s`. */
export function playScrabble(s0: ScrabbleState, input: ScrabbleInput, dict: Dict | null): ScrabbleState | string {
  if (s0.over) return "Partie terminée."
  const s: ScrabbleState = structuredClone(s0)
  const me = s.turn
  if (input.kind === "pass") {
    s.passes++
    s.lastWords = []
    s.log = "Passe."
    if (s.passes >= 6) finish(s, null)
    else nextTurn(s)
    return s
  }
  if (input.kind === "exchange") {
    if (s.bag.length < RACK) return "Échange impossible : moins de 7 jetons dans le sac."
    const left = takeFromRack(s.racks[me], input.letters.map((l) => ({ i: 0, l, blank: l === BLANK })))
    if (!left || !input.letters.length) return "Choisis les jetons à échanger."
    const drawn = s.bag.splice(0, input.letters.length)
    s.bag.push(...input.letters)
    shuffle(s.bag)
    s.racks[me] = [...left, ...drawn]
    s.passes++
    s.lastWords = []
    s.log = `Échange de ${input.letters.length} jeton${input.letters.length > 1 ? "s" : ""}.`
    if (s.passes >= 6) finish(s, null)
    else nextTurn(s)
    return s
  }
  const left = takeFromRack(s.racks[me], input.tiles)
  if (!left) return "Ces lettres ne sont pas sur ton chevalet."
  const ev = evaluatePlacement(s, input.tiles, dict)
  if (!ev.ok) return ev.error
  for (const t of input.tiles) s.board[t.i] = { l: t.l, blank: Boolean(t.blank) }
  s.racks[me] = [...left, ...s.bag.splice(0, RACK - left.length)]
  s.scores[me] += ev.score
  s.passes = 0
  s.lastWords = ev.words.map((w) => w.word)
  s.log = `${ev.words.map((w) => w.word).join(", ")} : ${ev.score} points${input.tiles.length === RACK ? " (scrabble +50)" : ""}.`
  if (!s.bag.length && !s.racks[me].length) finish(s, me)
  else nextTurn(s)
  return s
}

export function scrabbleWinner(s: ScrabbleState): 0 | 1 | "draw" | null {
  if (!s.over) return null
  if (s.scores[0] === s.scores[1]) return "draw"
  return s.scores[0] > s.scores[1] ? 0 : 1
}

/** Version visible par un joueur : chevalet adverse et sac masqués. */
export function redactScrabble(s: ScrabbleState, viewer: 0 | 1 | null): ScrabbleState {
  return {
    ...s,
    racks: [viewer === 0 || s.over ? s.racks[0] : s.racks[0].map(() => ""), viewer === 1 || s.over ? s.racks[1] : s.racks[1].map(() => "")],
    bag: [],
    bagCount: s.bag.length,
  }
}

// ——— Générateur de coups (ancres + contrôles croisés, Appel & Jacobson) ———

export type GenMove = { tiles: Placement[]; score: number }

export function generateMoves(s: ScrabbleState, rackIn: string[], dict: Dict, deadline: number, cap = 4000): GenMove[] {
  const out: GenMove[] = []
  const seen = new Set<string>()
  const empty = s.board.every((c) => !c)
  for (const d of [1, 15] as const) {
    // ligne k : cases dans la direction d ; « perp » = direction croisée
    const perp = d === 1 ? 15 : 1
    for (let line = 0; line < SIZE; line++) {
      const cells = Array.from({ length: SIZE }, (_, k) => (d === 1 ? line * SIZE + k : k * SIZE + line))
      const at = (k: number) => s.board[cells[k]]
      // contrôles croisés
      const cross: (Set<string> | null)[] = cells.map((idx) => {
        if (s.board[idx]) return null
        const before: string[] = [], after: string[] = []
        let k = idx - perp
        while (k >= 0 && k < SIZE * SIZE && (perp === 1 ? rowOf(k) === rowOf(idx) : true) && s.board[k]) { before.unshift(s.board[k]!.l); k -= perp }
        k = idx + perp
        while (k >= 0 && k < SIZE * SIZE && (perp === 1 ? rowOf(k) === rowOf(idx) : true) && s.board[k]) { after.push(s.board[k]!.l); k += perp }
        if (!before.length && !after.length) return null // pas de contrainte
        const ok = new Set<string>()
        for (const L of ALPHA) if (dict.has(before.join("") + L + after.join(""))) ok.add(L)
        return ok
      })
      const isAnchor = (k: number) => {
        if (at(k)) return false
        if (empty) return cells[k] === CENTER
        return (k > 0 && at(k - 1)) || (k < 14 && at(k + 1)) || cross[k] !== null
      }
      const rack = rackIn.slice()
      const record = (placed: Placement[]) => {
        const key = placed.map((p) => `${p.i}${p.l}${p.blank ? "*" : ""}`).sort().join("|")
        if (seen.has(key)) return
        seen.add(key)
        const ev = evaluatePlacement(s, placed, null)
        if (ev.ok) out.push({ tiles: placed.slice(), score: ev.score })
      }
      const allowed = (k: number, L: string) => cross[k] === null || cross[k]!.has(L)
      const extend = (word: string, k: number, placed: Placement[], anchor: number) => {
        if (Date.now() > deadline || out.length >= cap) return
        if (k >= SIZE || !at(k)) {
          if (k > anchor && placed.length && word.length > 1 && dict.has(word)) record(placed)
        }
        if (k >= SIZE) return
        const cell = at(k)
        if (cell) {
          if (dict.prefix(word + cell.l)) extend(word + cell.l, k + 1, placed, anchor)
          return
        }
        const tried = new Set<string>()
        for (let r = 0; r < rack.length; r++) {
          const t = rack[r]
          if (tried.has(t)) continue
          tried.add(t)
          rack.splice(r, 1)
          const letters = t === BLANK ? ALPHA : t
          for (const L of letters) {
            if (!allowed(k, L) || !dict.prefix(word + L)) continue
            placed.push({ i: cells[k], l: L, blank: t === BLANK || undefined })
            extend(word + L, k + 1, placed, anchor)
            placed.pop()
          }
          rack.splice(r, 0, t)
        }
      }
      const left = (part: string, placed: Placement[], limit: number, anchor: number) => {
        // placed contient la partie gauche ; on la décale pour qu'elle finisse juste avant l'ancre
        const shifted = placed.map((p, n) => ({ ...p, i: cells[anchor - placed.length + n] }))
        extend(part, anchor, shifted, anchor)
        if (limit <= 0 || Date.now() > deadline) return
        const tried = new Set<string>()
        for (let r = 0; r < rack.length; r++) {
          const t = rack[r]
          if (tried.has(t)) continue
          tried.add(t)
          rack.splice(r, 1)
          for (const L of t === BLANK ? ALPHA : t) {
            if (!dict.prefix(part + L)) continue
            placed.push({ i: -1, l: L, blank: t === BLANK || undefined })
            left(part + L, placed, limit - 1, anchor)
            placed.pop()
          }
          rack.splice(r, 0, t)
        }
      }
      for (let a = 0; a < SIZE; a++) {
        if (!isAnchor(a)) continue
        if (a > 0 && at(a - 1)) {
          let k = a - 1, pre = ""
          while (k >= 0 && at(k)) { pre = at(k)!.l + pre; k-- }
          if (dict.prefix(pre)) extend(pre, a, [], a)
        } else {
          let limit = 0, k = a - 1
          while (k >= 0 && !at(k) && !isAnchor(k) && limit < RACK - 1) { limit++; k-- }
          left("", [], limit, a)
        }
      }
    }
  }
  return out
}

/** Coup de l'ordinateur. pro : meilleur score en ~800 ms ; sinon un bon coup avec un peu de variété en ~300 ms. */
export function scrabbleAi(s: ScrabbleState, dict: Dict, pro: boolean): ScrabbleInput {
  const moves = generateMoves(s, s.racks[s.turn], dict, Date.now() + (pro ? 800 : 300))
  if (!moves.length) {
    if (s.bag.length >= RACK) {
      const r = s.racks[s.turn]
      const worst = [...r].sort((a, b) => tileValue(b) - tileValue(a)).slice(0, Math.min(r.length, 4))
      return { kind: "exchange", letters: worst }
    }
    return { kind: "pass" }
  }
  moves.sort((a, b) => b.score - a.score)
  if (pro) return { kind: "place", tiles: moves[0].tiles }
  const top = moves.slice(0, Math.min(5, moves.length))
  const pick = Math.random() < 0.55 ? top[0] : top[Math.floor(Math.random() * top.length)]
  return { kind: "place", tiles: pick.tiles }
}
