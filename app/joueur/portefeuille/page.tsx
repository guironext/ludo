import { acheter, convertir, convertirEnPoky, retirer } from "@/app/actions/game"
import { WalletView } from "@/components/WalletView"
import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function Portefeuille({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>
}) {
  const user = await requireUser()
  const { erreur } = await searchParams
  const txs = await prisma.walletTx.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 12,
  })

  return (
    <WalletView
      lion={user.lion}
      poky={user.poky}
      pokyBonus={user.pokyBonus}
      welcomeBonusRepaid={user.welcomeBonusRepaid}
      erreur={erreur}
      action={convertir}
      buyAction={acheter}
      pokyAction={convertirEnPoky}
      cashoutAction={retirer}
      moves={txs.map((tx) => ({
        id: tx.id,
        amount: tx.amount,
        currency: tx.currency,
        reason: tx.reason,
        createdAt: tx.createdAt.toISOString(),
      }))}
    />
  )
}
