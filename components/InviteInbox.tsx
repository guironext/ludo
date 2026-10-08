"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type Invite = {
  id: string
  code: string
  from: string
  seats: number
  stake: number
  currency: string
  href: string
}

export function InviteInbox() {
  const router = useRouter()
  const [invites, setInvites] = useState<Invite[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let stop = false
    const pull = async () => {
      if (document.visibilityState === "hidden") return
      const response = await fetch("/api/invitations", { cache: "no-store" })
      if (!response.ok) return
      const json = (await response.json()) as { invites: Invite[] }
      if (!stop) setInvites(json.invites)
    }
    void pull()
    const timer = window.setInterval(() => void pull(), 4000)
    document.addEventListener("visibilitychange", pull)
    return () => {
      stop = true
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", pull)
    }
  }, [])

  async function answer(invite: Invite, accept: boolean) {
    setBusy(invite.id)
    const response = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: accept ? "accept" : "refuse", id: invite.id }),
    })
    setBusy(null)
    if (!response.ok) return
    setInvites((current) => current.filter((item) => item.id !== invite.id))
    if (accept) router.push(invite.href)
    router.refresh()
  }

  if (invites.length === 0) return null

  return (
    <div className="invite-inbox" aria-live="polite">
      {invites.map((invite) => (
        <article key={invite.id} className="invite-card">
          <p>
            <strong>{invite.from}</strong> t&apos;invite à une table de {invite.seats} joueurs
            {" · "}
            {invite.stake} {invite.currency === "lion" ? "Lion" : "poky"}.
          </p>
          <div className="invite-actions">
            <button type="button" disabled={busy === invite.id} onClick={() => void answer(invite, true)}>
              Accepter
            </button>
            <button type="button" className="ghost" disabled={busy === invite.id} onClick={() => void answer(invite, false)}>
              Refuser
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}
