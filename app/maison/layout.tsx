import { MaisonNav } from "@/components/maison/MaisonNav"
import { requireMaison } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function MaisonLayout({ children }: { children: React.ReactNode }) {
  const user = await requireMaison()
  return (
    <div className="maison">
      <MaisonNav pseudo={user.pseudo} role={user.role} />
      <div className="maison-body">{children}</div>
    </div>
  )
}
