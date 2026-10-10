"use client"

import Link from "next/link"
import { useEffect } from "react"

/** Erreur serveur ou client : un message clair et un bouton pour réessayer, au lieu d'une page vide. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <div className="page">
      <section className="card form" role="alert">
        <h1>Oups, la page n&apos;a pas pu se charger.</h1>
        <p className="hint">
          Le serveur a rencontré une erreur. Réessaie ; si ça continue, donne ce code à l&apos;équipe :{" "}
          <code>{error.digest ?? "sans code"}</code>
        </p>
        <button type="button" onClick={() => reset()}>
          Réessayer
        </button>
        <p>
          <Link href="/">Retour à l&apos;accueil</Link>
        </p>
      </section>
    </div>
  )
}
