import { verifyWebhook } from "@clerk/nextjs/webhooks"
import type { NextRequest } from "next/server"
import { ensurePlayerFromClerk, pickPrimaryEmail, syncPlayerEmail, unlinkClerkUser } from "@/lib/clerk-sync"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  let evt
  try {
    evt = await verifyWebhook(req) // utilise CLERK_WEBHOOK_SIGNING_SECRET
  } catch {
    return new Response("Signature invalide", { status: 400 })
  }

  try {
    if (evt.type === "user.created" || evt.type === "user.updated") {
      const u = evt.data
      const { email, emailVerified } = pickPrimaryEmail(
        (u.email_addresses ?? []).map((e) => ({
          id: e.id,
          address: e.email_address,
          verified: e.verification?.status === "verified",
        })),
        u.primary_email_address_id,
      )
      const data = { clerkId: u.id, email, emailVerified, username: u.username ?? null, firstName: u.first_name ?? null }
      // user.updated crée aussi le joueur s'il manque (ex. e-mail confirmé après coup).
      await ensurePlayerFromClerk(data)
      if (evt.type === "user.updated") await syncPlayerEmail(data)
    } else if (evt.type === "user.deleted") {
      if (evt.data.id) await unlinkClerkUser(evt.data.id)
    }
  } catch (err) {
    console.error("Webhook Clerk", evt.type, err)
    return new Response("Erreur", { status: 500 })
  }
  return new Response("ok", { status: 200 })
}
