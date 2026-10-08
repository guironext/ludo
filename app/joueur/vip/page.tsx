import { VipLounge } from "@/components/VipLounge"
import { requireJoueur } from "@/lib/auth"
import { listOnlinePlayers, pendingChallenges, publicChallengeResults } from "@/lib/play"

export const dynamic = "force-dynamic"

export default async function VipPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>
}) {
  const user = await requireJoueur()
  const { erreur } = await searchParams
  const [pending, results, online] = await Promise.all([
    pendingChallenges(user),
    publicChallengeResults(40),
    listOnlinePlayers(user.id),
  ])

  return (
    <VipLounge
      pseudo={user.pseudo}
      lion={user.lion}
      erreur={erreur}
      pending={pending}
      results={results}
      online={online}
    />
  )
}
