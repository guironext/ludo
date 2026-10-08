import assert from "node:assert/strict"
import bcrypt from "bcryptjs"
import { prisma } from "../lib/db"
import { PlayError, convertPoky, createRoom, joinRoom, playerAct, replayRoom, snapshot, startRoom } from "../lib/play"

async function user(pseudo: string) {
  return prisma.user.create({
    data: {
      pseudo,
      email: `${pseudo}@exemple.ci`,
      passwordHash: await bcrypt.hash("motdepasse", 10),
      poky: 500,
      pokyBonus: 500,
      adult: true,
    },
  })
}

async function main() {
const ama = await user("ama")
const koffi = await user("koffi")
const aya = await user("aya")

await assert.rejects(() => convertPoky(ama, 1), /bonus|gagnés/)

const solo = await createRoom(ama, { level: "gratuit", players: 1, stake: 50, invites: [], fillAi: false })
const afterSolo = await prisma.user.findUniqueOrThrow({ where: { id: ama.id } })
assert.equal(afterSolo.poky, 450)
assert.equal(afterSolo.pokyBonus, 450)
const soloGame = await prisma.game.findUniqueOrThrow({ where: { code: solo } })
assert.equal(soloGame.status, "playing")
assert.equal(soloGame.pot, 100)

const freshAma = await prisma.user.findUniqueOrThrow({ where: { id: ama.id } })
await playerAct(freshAma, solo, "forfeit")
const lost = await prisma.user.findUniqueOrThrow({ where: { id: ama.id } })
assert.equal(lost.poky, 450, "abandonner ne rembourse pas")
const closed = await prisma.game.findUniqueOrThrow({ where: { code: solo } })
assert.equal(closed.status, "finished")

const code = await createRoom(koffi, {
  level: "gratuit",
  players: 2,
  stake: 50,
  invites: ["ama"],
  fillAi: false,
})
await assert.rejects(() => joinRoom(aya, code), /réserv/)
await joinRoom(ama, code)
const host = await prisma.user.findUniqueOrThrow({ where: { id: koffi.id } })
await startRoom(host, code)
await playerAct(freshAma, code, "forfeit")
const winner = await prisma.user.findUniqueOrThrow({ where: { id: koffi.id } })
assert.equal(winner.poky, 450 + 80)
assert.equal(winner.pokyBonus, 450)
await convertPoky(winner, 1)
const converted = await prisma.user.findUniqueOrThrow({ where: { id: koffi.id } })
assert.equal(converted.lion, 1)
assert.equal(converted.poky, 480)
assert.equal(converted.poky - converted.pokyBonus, 30)

const view = await snapshot(converted, code)
assert.equal(view.status, "finished")
assert.equal(view.wallet.lion, 1)

const beforeReplay = await prisma.user.findUniqueOrThrow({ where: { id: ama.id } })
await replayRoom(freshAma, solo)
const replayed = await prisma.game.findUniqueOrThrow({ where: { code: solo } })
assert.equal(replayed.status, "playing")
assert.equal(replayed.pot, 100)
assert.equal(replayed.winnerId, null)
const afterReplay = await prisma.user.findUniqueOrThrow({ where: { id: ama.id } })
assert.equal(afterReplay.poky, beforeReplay.poky - 50, "la revanche reprend la mise")
const stakeTx = await prisma.walletTx.findFirst({
  where: { userId: ama.id, gameId: replayed.id, reason: "nouvelle mise" },
})
assert.equal(stakeTx?.amount, -50)
await assert.rejects(() => replayRoom(freshAma, solo), /pas terminée/)

console.log("parcours poky ok", { solo, code })
await prisma.$disconnect()
}

main()
