import { NextResponse } from "next/server"
import { currentUser, partiePath } from "@/lib/auth"
import {
  PlayError,
  acceptGameLink,
  answerInvite,
  invitePlayer,
  pendingInvites,
  refuseGameLink,
} from "@/lib/play"

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 })
  const invites = await pendingInvites(user)
  return NextResponse.json({
    invites: invites.map((invite) => ({ ...invite, href: partiePath(invite.code) })),
  })
}

export async function POST(request: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 })
  const body = (await request.json()) as {
    action?: "invite" | "accept" | "refuse" | "accept-link" | "refuse-link"
    code?: string
    userId?: string
    id?: string
  }
  try {
    if (body.action === "invite") {
      await invitePlayer(user, String(body.code ?? ""), String(body.userId ?? ""))
      return NextResponse.json({ ok: true })
    }
    if (body.action === "accept" || body.action === "refuse") {
      const code = await answerInvite(user, String(body.id ?? ""), body.action === "accept")
      return NextResponse.json({ ok: true, code })
    }
    if (body.action === "accept-link") {
      const code = await acceptGameLink(user, String(body.code ?? ""))
      return NextResponse.json({ ok: true, code })
    }
    if (body.action === "refuse-link") {
      await refuseGameLink(user, String(body.code ?? ""))
      return NextResponse.json({ ok: true, code: null })
    }
    return NextResponse.json({ error: "Action inconnue." }, { status: 400 })
  } catch (error) {
    const message = error instanceof PlayError ? error.message : "Invitation impossible."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
