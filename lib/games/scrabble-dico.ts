import "server-only"
import { readFileSync } from "fs"
import { join } from "path"
import { gunzipSync } from "zlib"
import type { Dict } from "./scrabble"

/**
 * Dictionnaire français (≈ 311 000 formes, sans accents, 2 à 15 lettres).
 * Source : paquet npm « an-array-of-french-words » 2.0.0 (licence MIT), normalisé pour le Scrabble
 * (+ les mots de deux lettres de l'ODS). Chargé une seule fois par instance, tableau trié + recherche dichotomique.
 */
let words: string[] | null = null

function load() {
  if (!words) {
    const raw = gunzipSync(readFileSync(join(process.cwd(), "data", "scrabble", "mots.txt.gz"))).toString("utf8")
    words = raw.split("\n").filter(Boolean)
  }
  return words
}

function lowerBound(list: string[], key: string) {
  let lo = 0, hi = list.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (list[mid] < key) lo = mid + 1
    else hi = mid
  }
  return lo
}

export const frenchDict: Dict = {
  has(w) {
    const list = load()
    const k = lowerBound(list, w)
    return list[k] === w
  },
  prefix(p) {
    const list = load()
    const k = lowerBound(list, p)
    return k < list.length && list[k].startsWith(p)
  },
}
