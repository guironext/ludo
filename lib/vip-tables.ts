import type { SalonChoice } from "@/components/SalonCard"
import { VIP_TABLE_MIN_LION } from "@/lib/rules"

export const VIP_TABLES: SalonChoice[] = [
  {
    players: 1,
    eyebrow: "VIP · Solo",
    title: "Contre l'ordinateur",
    detail: "1 contre 1 face à l'ordinateur. Mise en Lion, départ immédiat.",
    tone: "ai",
    seats: ["green", "ai"],
    stake: `${VIP_TABLE_MIN_LION} Lion min.`,
  },
  {
    players: 2,
    eyebrow: "VIP · Duo",
    title: "1 contre 1",
    detail: "Toi et un autre joueur. Partage le code ou invite un pseudo.",
    tone: "duo",
    seats: ["green", "blue"],
    stake: `${VIP_TABLE_MIN_LION} Lion min.`,
  },
  {
    players: 3,
    eyebrow: "VIP · Trio",
    title: "3 joueurs",
    detail: "Table VIP à trois. La maison prend 20 % du pot.",
    tone: "trio",
    seats: ["green", "yellow", "blue"],
    stake: `${VIP_TABLE_MIN_LION} Lion min.`,
  },
  {
    players: 4,
    eyebrow: "VIP · Quatre",
    title: "4 joueurs",
    detail: "Table pleine en Lion. Gagnant 80 %, maison 20 %.",
    tone: "full",
    seats: ["green", "yellow", "blue", "red"],
    stake: `${VIP_TABLE_MIN_LION} Lion min.`,
  },
]

export function parseVipPlayers(raw: string | undefined): 1 | 2 | 3 | 4 {
  const n = Number(raw)
  if (n === 1 || n === 2 || n === 3 || n === 4) return n
  return 2
}
