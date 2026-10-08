import { SignIn } from "@clerk/nextjs"
import { clerkAppearance } from "@/lib/clerk-appearance"

export default function Connexion() {
  return (
    <section className="clerk-page">
      <p className="clerk-kicker">Baobab Arena · Ton salon, tes poky, tes parties</p>
      <SignIn path="/connexion" routing="path" signUpUrl="/inscription" forceRedirectUrl="/apres-connexion" fallbackRedirectUrl="/apres-connexion" appearance={clerkAppearance} />
    </section>
  )
}
