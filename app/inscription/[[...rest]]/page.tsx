import { SignUp } from "@clerk/nextjs"
import { clerkAppearance } from "@/lib/clerk-appearance"
import { SIGNUP_POKY } from "@/lib/rules"

export default function Inscription() {
  return (
    <section className="clerk-page">
      <p className="clerk-kicker">Baobab Arena · {SIGNUP_POKY} poky offerts à l&apos;inscription</p>
      <SignUp path="/inscription" routing="path" signInUrl="/connexion" forceRedirectUrl="/apres-connexion" fallbackRedirectUrl="/apres-connexion" appearance={clerkAppearance} />
    </section>
  )
}
