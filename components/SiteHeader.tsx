import Link from "next/link"
import { ROLE_JOUEUR, ROLE_MAISON, ROLE_MANAGER } from "@/lib/rules"
import { SiteHeaderNav, type HeaderLink } from "@/components/SiteHeaderNav"

function BaobabMark() {
  return (
    <svg className="sh-mark" viewBox="0 0 32 32" aria-hidden="true">
      <ellipse cx="16" cy="10" rx="12" ry="6" fill="currentColor" />
      <path d="M13 29h6l-1-14h-4z" fill="currentColor" />
      <path d="M14 16 8 12M18 16l6-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

const nf = new Intl.NumberFormat("fr-FR")

export function SiteHeader({
  pseudo,
  poky,
  lion,
  role,
}: {
  pseudo: string | null
  poky: number
  lion: number
  role: string | null
}) {
  const home = !pseudo ? "/" : role === ROLE_JOUEUR ? "/joueur" : role === ROLE_MAISON ? "/maison" : "/admin"

  const links: HeaderLink[] = []
  if (pseudo) {
    if (role === ROLE_JOUEUR) links.push({ href: "/joueur", label: "Joueur" })
    if (role === ROLE_JOUEUR) links.push({ href: "/joueur/vip", label: "VIP" })
    links.push({ href: role === ROLE_JOUEUR ? "/joueur/portefeuille" : "/portefeuille", label: "Portefeuille" })
    if (role === ROLE_MANAGER) links.push({ href: "/admin", label: "Admin" })
    if (role === ROLE_MAISON || role === ROLE_MANAGER) links.push({ href: "/maison", label: "Maison" })
  }

  const roleLabel =
    role === ROLE_MANAGER ? "Manager" : role === ROLE_MAISON ? "Maison" : role === ROLE_JOUEUR ? "Joueur" : null

  return (
    <header className="site-header" id="site-header">
      <div className="sh-inner flex justify-between items-center">
        <Link href={home} className="sh-brand" aria-label="Baobab Arena, accueil">
          <BaobabMark />
          <span className="sh-brand-text">
            Baobab <em>Arena</em>
          </span>
        </Link>
        <SiteHeaderNav
          signedIn={Boolean(pseudo)}
          links={links}
          pseudo={pseudo}
          role={roleLabel ? role : null}
          roleLabel={roleLabel}
          poky={nf.format(poky)}
          lion={nf.format(lion)}
        />
      </div>
    </header>
  )
}
