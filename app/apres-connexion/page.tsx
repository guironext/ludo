import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { SignOutButton } from "@clerk/nextjs"
import { currentUser, homeForRole } from "@/lib/auth"

export const dynamic = "force-dynamic"

/** Atterrissage après inscription/connexion Clerk : redirection selon le rôle en base. */
export default async function ApresConnexion() {
  const user = await currentUser()
  if (user) redirect(homeForRole(user.role))
  const { userId } = await auth()
  if (!userId) redirect("/connexion")
  // Connecté chez Clerk mais aucun joueur n'a pu être créé : message au lieu d'une boucle.
  console.error("[apres-connexion] compte Clerk connecté sans joueur", userId)
  return (
    <div className="page">
      <section className="card form" role="alert">
        <h1>Ton compte n&apos;est pas encore prêt</h1>
        <p className="hint">
          Nous n&apos;avons pas pu ouvrir ton espace joueur. Réessaie dans un instant ; si ça continue,
          confirme ton adresse e-mail dans ton profil ou contacte l&apos;équipe Baobab Arena.
        </p>
        <p>
          <Link href="/apres-connexion">Réessayer</Link>
        </p>
        <SignOutButton redirectUrl="/">
          <button type="button" className="ghost">Se déconnecter</button>
        </SignOutButton>
      </section>
    </div>
  )
}
