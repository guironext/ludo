import { NextResponse } from "next/server"
import { currentUser } from "@/lib/auth"
import { PlayError, boardAct, playerAct, replayRoom, snapshot } from "@/lib/play"

type Params = { params: Promise<{ code: string }> }

export async function GET(_request: Request, { params }: Params) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 })
  const { code } = await params
  try {
    return NextResponse.json(await snapshot(user, code.toUpperCase()))
  } catch (error) {
    const message = error instanceof PlayError ? error.message : "Partie introuvable."
    return NextResponse.json({ error: message }, { status: 404 })
  }
}

export async function POST(request: Request, { params }: Params) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 })
  const { code } = await params
  const body = (await request.json()) as {
    action?: "roll" | "move" | "forfeit" | "replay" | "play" | "board-forfeit"
    pieceId?: string
    from?: number
    to?: number
    promo?: string
    pit?: number
    kind?: string
    tiles?: unknown
    letters?: unknown
  }
  if (body.action === "play" || body.action === "board-forfeit") {
    try {
      const num = (value: unknown) => (typeof value === "number" && Number.isInteger(value) ? value : undefined)
      await boardAct(user, code.toUpperCase(), body.action === "play" ? "play" : "forfeit", {
        from: num(body.from),
        to: num(body.to),
        pit: num(body.pit),
        promo: typeof body.promo === "string" ? body.promo : undefined,
        kind: body.kind === "place" || body.kind === "pass" || body.kind === "exchange" ? body.kind : undefined,
        tiles: Array.isArray(body.tiles)
          ? body.tiles.slice(0, 7).map((t) => {
              const tile = (t ?? {}) as { i?: unknown; l?: unknown; blank?: unknown }
              return { i: num(tile.i) ?? -1, l: typeof tile.l === "string" ? tile.l.slice(0, 1) : "", blank: tile.blank === true }
            })
          : undefined,
        letters: Array.isArray(body.letters) ? body.letters.slice(0, 7).map((l) => (typeof l === "string" ? l.slice(0, 1) : "")) : undefined,
      })
      return NextResponse.json(await snapshot(user, code.toUpperCase()))
    } catch (error) {
      const message = error instanceof PlayError ? error.message : "Action impossible."
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }
  if (body.action !== "roll" && body.action !== "move" && body.action !== "forfeit" && body.action !== "replay") {
    return NextResponse.json({ error: "Action inconnue." }, { status: 400 })
  }
  try {
    if (body.action === "replay") await replayRoom(user, code.toUpperCase())
    else await playerAct(user, code.toUpperCase(), body.action, body.pieceId)
    return NextResponse.json(await snapshot(user, code.toUpperCase()))
  } catch (error) {
    const message = error instanceof PlayError ? error.message : "Action impossible."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
