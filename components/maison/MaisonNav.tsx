"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton } from "@clerk/nextjs"

const LINKS = [
  { href: "/maison", label: "Vue d'ensemble", icon: "📊" },
  { href: "/maison/gains", label: "Gains de la maison", icon: "💰" },
  { href: "/maison/parties", label: "Parties", icon: "🎲" },
  { href: "/maison/versements", label: "Versements", icon: "🏆" },
  { href: "/maison/joueurs", label: "Joueurs", icon: "👥" },
]

export function MaisonNav({ pseudo, role }: { pseudo: string; role: string }) {
  const path = usePathname()
  return (
    <div className="maison-bar">
      <div className="maison-bar-top">
        <div className="maison-title">
          <span className="maison-badge">Maison</span>
          <strong>Caisse Baobab Arena</strong>
          <small>{pseudo}{role !== "maison" ? " · lecture manager" : ""}</small>
        </div>
        <UserButton />
      </div>
      <nav className="maison-nav" aria-label="Navigation de la maison">
        {LINKS.map((l) => {
          const active = l.href === "/maison" ? path === "/maison" : path.startsWith(l.href)
          return (
            <Link key={l.href} href={l.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
              <span aria-hidden="true">{l.icon}</span> {l.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
