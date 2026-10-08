import { ouvrirSalon } from "@/app/actions/game"

export const dynamic = "force-dynamic"

export default async function OuvrirSalon({
  params,
}: {
  params: Promise<{ players: string }>
}) {
  const { players } = await params
  const formData = new FormData()
  formData.set("players", players)
  await ouvrirSalon(formData)
}
