import { notFound } from "next/navigation"
import { Table } from "@/components/Table"
import { GameTable } from "@/components/games/GameTable"
import { requireJoueur } from "@/lib/auth"
import { PlayError, snapshot } from "@/lib/play"

export const dynamic = "force-dynamic"

export default async function Partie({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ erreur?: string }>
}) {
  const user = await requireJoueur()
  const { code } = await params
  const { erreur } = await searchParams
  try {
    const view = await snapshot(user, code.toUpperCase())
    return (
      <div className="page match-page">
        {view.gameType === "ludo" ? <Table initial={view} erreur={erreur} /> : <GameTable initial={view} erreur={erreur} />}
      </div>
    )
  } catch (error) {
    if (error instanceof PlayError) notFound()
    throw error
  }
}
