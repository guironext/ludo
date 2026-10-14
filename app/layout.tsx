import type { Metadata, Viewport } from "next"
import { Fraunces, Outfit } from "next/font/google"
import { InviteInbox } from "@/components/InviteInbox"
import { PresencePulse } from "@/components/PresencePulse"
import { SiteHeader } from "@/components/SiteHeader"
import { ClerkProvider } from "@clerk/nextjs"
import { frFR } from "@clerk/localizations"
import { ui } from "@clerk/ui"
import { currentUser } from "@/lib/auth"
import { clerkAppearance } from "@/lib/clerk-appearance"
import { ROLE_JOUEUR } from "@/lib/rules"
import "./globals.css"

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" })
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" })

export const metadata: Metadata = {
  title: "Baobab Arena",
  description: "Baobab Arena : Ludo, Dames, Échecs et Awalé, avec mises en poky et Lion.",
}

/** Site sombre : évite que le « mode sombre forcé » des navigateurs mobiles inverse les couleurs (pions de dames, etc.). */
export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0c241e",
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await currentUser()
  return (
    <ClerkProvider ui={ui} localization={frFR} appearance={clerkAppearance} signInUrl="/connexion" signUpUrl="/inscription" afterSignOutUrl="/">
    <html lang="fr" className={`${outfit.variable} ${fraunces.variable}`}>
      <body>
        {user ? <PresencePulse /> : null}
        <SiteHeader
          pseudo={user?.pseudo ?? null}
          poky={user?.poky ?? 0}
          lion={user?.lion ?? 0}
          role={user?.role ?? null}
        />
        {user?.role === ROLE_JOUEUR ? <InviteInbox /> : null}
        <main>{children}</main>
      </body>
    </html>
    </ClerkProvider>
  )
}
