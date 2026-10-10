"use client"

import type { ReactNode } from "react"
import { useFormStatus } from "react-dom"

/** Bouton d'envoi avec état « en cours » : désactivé et texte d'attente pendant l'action serveur. */
export function SubmitButton({
  children,
  pendingLabel = "Un instant…",
  className,
}: {
  children: ReactNode
  pendingLabel?: string
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending} aria-disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  )
}
