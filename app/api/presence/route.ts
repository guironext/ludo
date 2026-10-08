import { NextResponse } from "next/server"
import { currentUser } from "@/lib/auth"

export async function POST() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })
  return NextResponse.json({ ok: true })
}
