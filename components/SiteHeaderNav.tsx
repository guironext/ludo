"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton } from "@clerk/nextjs"
import { useEffect, useRef, useState } from "react"

export type HeaderLink = { href: string; label: string }

const MOBILE_QUERY = "(max-width: 860px)"

/** Lien actif : la correspondance la plus précise (ex. /joueur/vip plutôt que /joueur). */
function activeHref(path: string, links: HeaderLink[]) {
  let best: string | null = null
  for (const l of links) {
    if (path === l.href || path.startsWith(l.href + "/")) {
      if (!best || l.href.length > best.length) best = l.href
    }
  }
  return best
}

function Wallet({ poky, lion, className }: { poky: string; lion: string; className: string }) {
  return (
    <span className={className} aria-label={`Solde : ${poky} poky et ${lion} Lion`}>
      <span className="sh-coin sh-coin-poky" aria-hidden="true" />
      <b>{poky}</b>
      <small>poky</small>
      <span className="sh-sep" aria-hidden="true" />
      <span className="sh-coin sh-coin-lion" aria-hidden="true" />
      <b>{lion}</b>
      <small>Lion</small>
    </span>
  )
}

function Chevron() {
  return (
    <svg className="sh-chevron" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SiteHeaderNav({
  signedIn,
  links,
  pseudo,
  role,
  roleLabel,
  poky,
  lion,
}: {
  signedIn: boolean
  links: HeaderLink[]
  pseudo: string | null
  role: string | null
  roleLabel: string | null
  poky: string
  lion: string
}) {
  const path = usePathname() ?? "/"
  const active = activeHref(path, links)
  const [open, setOpen] = useState(false)
  const [lastPath, setLastPath] = useState(path)
  const rootRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  // Ferme le menu quand la page change.
  if (path !== lastPath) {
    setLastPath(path)
    setOpen(false)
  }

  // Ombre de l'en-tête dès qu'on fait défiler la page.
  useEffect(() => {
    const header = rootRef.current?.closest<HTMLElement>(".site-header")
    if (!header) return
    const update = () => header.toggleAttribute("data-scrolled", window.scrollY > 4)
    update()
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [])

  // Échap ferme le menu ; repasser en mode bureau aussi.
  useEffect(() => {
    if (!open) return
    const header = rootRef.current?.closest<HTMLElement>(".site-header")
    header?.setAttribute("data-menu-open", "")
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    const mq = window.matchMedia(MOBILE_QUERY)
    const onMq = () => {
      if (!mq.matches) setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    mq.addEventListener("change", onMq)
    return () => {
      header?.removeAttribute("data-menu-open")
      document.removeEventListener("keydown", onKey)
      mq.removeEventListener("change", onMq)
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <div className="sh-rest" ref={rootRef}>
      {links.length > 0 ? (
        <nav className="sh-nav" aria-label="Navigation principale">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={l.href === active ? "is-active" : undefined}
              aria-current={l.href === active ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="sh-actions">
        {signedIn ? (
          <>
            <Wallet poky={poky} lion={lion} className="sh-wallet" />
            {pseudo ? (
              <span className="sh-who">
                <span className="sh-pseudo">{pseudo}</span>
                {roleLabel ? <span className={`role role-${role} sh-role`}>{roleLabel}</span> : null}
              </span>
            ) : null}
            <span className="sh-user">
              <UserButton appearance={{ elements: { avatarBox: { width: "36px", height: "36px" } } }} />
            </span>
          </>
        ) : (
          <>
            <Link href="/connexion" className="sh-btn sh-btn-ghost sh-cta-desktop">
              Se connecter
            </Link>
            <Link href="/inscription" className="sh-btn sh-btn-gold sh-cta-compact">
              Créer un compte
            </Link>
          </>
        )}

        <button
          ref={toggleRef}
          type="button"
          className="sh-toggle"
          aria-expanded={open}
          aria-controls="sh-menu"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sh-burger" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>

        <div className="sh-backdrop" aria-hidden="true" onClick={close} />

        <div id="sh-menu" className="sh-menu" data-open={open ? "" : undefined}>
          {signedIn ? (
            <>
              <div className="sh-menu-card">
                <div className="sh-menu-id">
                  <span className="sh-menu-pseudo">{pseudo}</span>
                  {roleLabel ? <span className={`role role-${role} sh-role`}>{roleLabel}</span> : null}
                </div>
                <Wallet poky={poky} lion={lion} className="sh-wallet sh-wallet-menu" />
              </div>
              <nav aria-label="Navigation mobile">
                <ul className="sh-menu-links">
                  {links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        onClick={close}
                        className={l.href === active ? "is-active" : undefined}
                        aria-current={l.href === active ? "page" : undefined}
                      >
                        <span>{l.label}</span>
                        <Chevron />
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </>
          ) : (
            <div className="sh-menu-guest">
              <p className="sh-menu-title">Bienvenue sur Baobab Arena</p>
              <p className="sh-menu-text">Un seul compte pour Ludo, Dames, Échecs et Awalé.</p>
              <Link href="/inscription" onClick={close} className="sh-btn sh-btn-gold sh-btn-block">
                Créer un compte
              </Link>
              <Link href="/connexion" onClick={close} className="sh-btn sh-btn-ghost sh-btn-block">
                Se connecter
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
