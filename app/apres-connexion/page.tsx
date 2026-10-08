import { redirect } from "next/navigation"
import { currentUser, homeForRole } from "@/lib/auth"

export const dynamic = "force-dynamic"

/** Atterrissage après inscription/connexion Clerk : redirection selon le rôle en base. */
export default async function ApresConnexion() {
  const user = await currentUser()
  if (!user) redirect("/connexion")
  redirect(homeForRole(user.role))
}
