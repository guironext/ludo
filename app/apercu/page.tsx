import { Table } from "@/components/Table"
import { prisma } from "@/lib/db"
import { PLAYER_LABELS } from "@/lib/ludo/board"
import type { LudoState } from "@/lib/ludo/engine"
import { splitPot } from "@/lib/rules"

export const dynamic = "force-dynamic"

export default async function Apercu() {
  const game = await prisma.game.findUnique({
    where: { code: "943KYF" },
    include: { players: { orderBy: { seat: "asc" } } },
  })
  if (!game) return null
  const state = JSON.parse(game.stateJson) as LudoState
  const you = game.players.find((player) => !player.isAi)
  return (
    <div className="page match-page">
      <Table
        initial={{
          code: game.code,
          level: game.level,
          levelLabel: "Gratuit",
          gameType: "ludo",
          board: null,
          status: game.status,
          currency: game.stakeCurrency,
          stake: game.stakeAmount,
          pot: game.pot,
          creatorId: game.creatorId,
          you: you?.userId ?? "",
          yourSeat: you?.seat ?? null,
          players: game.players.map((player) => ({
            seat: player.seat,
            name: player.name,
            color: player.color,
            isAi: player.isAi,
            userId: player.userId,
          })),
          invites: [],
          yourInvite: null,
          online: [],
          seats: state.active,
          state,
          wallet: { poky: 0, pokyBonus: 0, lion: 0, convertible: 0 },
          share: splitPot(game.pot),
          labels: PLAYER_LABELS,
        }}
      />
    </div>
  )
}
