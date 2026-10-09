"use client"

import { useEffect, useRef, useState } from "react"
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

const BASE_INTERVAL_MS = 4000
const MAX_INTERVAL_MS = 30000

function isJsonResponse(response: Response) {
  const type = response.headers.get("content-type") ?? ""
  return type.includes("application/json")
}

export function InviteInbox() {
  const router = useRouter()
  const [invites, setInvites] = useState<Invite[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const errorsRef = useRef(0)

  useEffect(() => {
    let stop = false
    let timer: number | undefined
    let controller: AbortController | null = null

    const schedule = (delay: number) => {
      if (stop) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void pull(), delay)
    }

    const pull = async () => {
      if (stop) return
      if (document.visibilityState === "hidden") {
        schedule(BASE_INTERVAL_MS)
        return
      }
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        schedule(Math.min(BASE_INTERVAL_MS * 2, MAX_INTERVAL_MS))
        return
      }

      controller?.abort()
      controller = new AbortController()

      try {
        const response = await fetch("/api/invitations", {
          cache: "no-store",
          redirect: "manual",
          signal: controller.signal,
        })

        // Clerk protect / opaque redirects must not crash the page.
        if (response.type === "opaqueredirect" || response.status === 0) {
          errorsRef.current += 1
          schedule(Math.min(BASE_INTERVAL_MS * 2 ** Math.min(errorsRef.current, 3), MAX_INTERVAL_MS))
          return
        }

        if (!response.ok) {
          errorsRef.current += 1
          schedule(Math.min(BASE_INTERVAL_MS * 2 ** Math.min(errorsRef.current, 3), MAX_INTERVAL_MS))
          return
        }

        if (!isJsonResponse(response)) {
          errorsRef.current += 1
          schedule(Math.min(BASE_INTERVAL_MS * 2 ** Math.min(errorsRef.current, 3), MAX_INTERVAL_MS))
          return
        }

        const json = (await response.json()) as { invites?: Invite[] }
        if (!stop) setInvites(Array.isArray(json.invites) ? json.invites : [])
        errorsRef.current = 0
        schedule(BASE_INTERVAL_MS)
      } catch {
        // Network blips, aborts, and non-JSON bodies stay silent.
        if (stop) return
        errorsRef.current += 1
        schedule(Math.min(BASE_INTERVAL_MS * 2 ** Math.min(errorsRef.current, 3), MAX_INTERVAL_MS))
      }
    }

    void pull()
    const onVisible = () => {
      if (document.visibilityState === "visible") void pull()
    }
    const onOnline = () => void pull()
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("online", onOnline)

    return () => {
      stop = true
      controller?.abort()
      window.clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("online", onOnline)
    }
  }, [])

  async function answer(invite: Invite, accept: boolean) {
    setBusy(invite.id)
    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: accept ? "accept" : "refuse", id: invite.id }),
        redirect: "manual",
      })
      if (!response.ok || !isJsonResponse(response)) {
        setBusy(null)
        return
      }
      await response.json().catch(() => null)
      setInvites((current) => current.filter((item) => item.id !== invite.id))
      if (accept) router.push(invite.href)
      router.refresh()
    } catch {
      // Ignore network errors on accept/refuse.
    } finally {
      setBusy(null)
    }
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
