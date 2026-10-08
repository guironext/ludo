export const GRID = 15

export const TRACK: ReadonlyArray<readonly [number, number]> = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14],
  [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7],
  [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0],
  [6, 0],
]

export const STARTS = [0, 13, 26, 39] as const

export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47])

export const HOMES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
]

export const CENTER: readonly [number, number] = [7, 7]

export const YARDS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0, 9],
  [9, 9],
  [9, 0],
]

export const YARD_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, 4],
  [4, 1],
  [4, 4],
]

export const PLAYER_COLORS = ["green", "yellow", "blue", "red"] as const
export type PlayerColor = (typeof PLAYER_COLORS)[number]

export const PLAYER_LABELS = ["Vert", "Jaune", "Bleu", "Rouge"] as const

export const COLOR_HEX: Record<PlayerColor, string> = {
  green: "#1f8f4a",
  yellow: "#e0b422",
  blue: "#2d6adf",
  red: "#d63c3c",
}

/** 0..50 piste, 51..55 couloir, 56 centre. -1 = maison. */
export const FINISH = 56
export const STRETCH = 51

export function seatsFor(total: number): number[] {
  if (total <= 2) return [0, 2]
  if (total === 3) return [0, 1, 2]
  return [0, 1, 2, 3]
}

export function globalIndex(player: number, pos: number) {
  return (STARTS[player] + pos) % TRACK.length
}

export function isSafe(player: number, pos: number) {
  if (pos < 0 || pos >= STRETCH) return false
  return SAFE.has(globalIndex(player, pos))
}

export function cellFor(player: number, pos: number, slot: number): readonly [number, number] {
  if (pos < 0) {
    const [r, c] = YARDS[player]
    const [dr, dc] = YARD_SLOTS[slot]
    return [r + dr, c + dc]
  }
  if (pos >= FINISH) return CENTER
  if (pos >= STRETCH) return HOMES[player][pos - STRETCH]
  return TRACK[globalIndex(player, pos)]
}
