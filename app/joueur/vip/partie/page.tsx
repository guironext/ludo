import { VipPartieView } from "@/components/VipPartieView"
import { requireJoueur } from "@/lib/auth"
import { parseVipPlayers } from "@/lib/vip-tables"

export const dynamic = "force-dynamic"

export default async function VipPartiePage({
  searchParams,
}: {
  searchParams: Promise<{ players?: string; erreur?: string; jeu?: string }>
}) {
  const user = await requireJoueur()
  const params = await searchParams
  const players = parseVipPlayers(params.players)

  return <VipPartieView lion={user.lion} players={players} erreur={params.erreur} jeu={params.jeu} />
}
