import { ROLE_MAISON, ROLE_MANAGER } from "./rules"

/** Seuls ces e-mails (vérifiés) sont envoyés automatiquement vers leur espace. */
export const SPECIAL_ACCOUNTS: Record<string, { role: string; home: string; pseudo: string }> = {
  "guironext@gmail.com": { role: ROLE_MAISON, home: "/maison", pseudo: "maison" },
  "guirogerard@gmail.com": { role: ROLE_MANAGER, home: "/admin", pseudo: "admin" },
}

export function specialAccountFor(email: string | null | undefined) {
  if (!email) return null
  return SPECIAL_ACCOUNTS[email.trim().toLowerCase()] ?? null
}

export const PRIVILEGED_ROLES = [ROLE_MAISON, ROLE_MANAGER]
