import assert from "node:assert/strict"
import { FINISH } from "../lib/ludo/board"
import { applyMove, applyRoll, createMatch, legalMoves, type LudoState } from "../lib/ludo/engine"
import { splitPot } from "../lib/rules"

function rollTo(state: LudoState, dice: number) {
  applyRoll(state, dice, 1_000)
}

const economy = splitPot(100)
assert.equal(economy.winner, 80)
assert.equal(economy.house, 20)
assert.equal(splitPot(60).winner, 48)

const match = createMatch([0, 2], [2], 0)
rollTo(match, 5)
assert.equal(match.legal.length, 0, "un 5 ne sort pas un pion de la maison")
match.phase = "roll"
rollTo(match, 6)
assert.ok(match.legal.includes("0-0"))
assert.equal(applyMove(match, "0-0", 2_000), true)
assert.equal(match.pieces.find((piece) => piece.id === "0-0")?.pos, 0)
assert.equal(match.phase, "roll", "un 6 fait rejouer")
assert.equal(match.turn, 0)

rollTo(match, 6)
assert.equal(match.sixStreak, 2)
applyMove(match, match.legal[0], 3_000)
rollTo(match, 6)
assert.notEqual(match.turn, 0, "le troisième 6 passe le tour")
assert.equal(match.sixStreak, 0)

const capture = createMatch([0, 2], [], 0)
const mover = capture.pieces.find((piece) => piece.id === "0-0")
const victim = capture.pieces.find((piece) => piece.id === "2-0")
assert.ok(mover && victim)
mover.pos = 0
victim.pos = 27
capture.phase = "move"
capture.dice = 1
capture.turn = 0
capture.legal = legalMoves(capture, 1)
assert.ok(capture.legal.includes("0-0"))
applyMove(capture, "0-0", 4_000)
assert.equal(victim.pos, -1, "un pion adverse est renvoyé à la maison")

const safe = createMatch([0, 2], [], 0)
const blocked = safe.pieces.find((piece) => piece.id === "0-1")
const guard = safe.pieces.find((piece) => piece.id === "2-1")
assert.ok(blocked && guard)
guard.pos = 26
safe.turn = 0
safe.phase = "roll"
applyRoll(safe, 6, 5_000)
assert.equal(safe.legal.includes("0-1"), false, "la case de départ occupée bloque la sortie")

const finish = createMatch([0], [], 0)
const last = finish.pieces[0]
last.pos = 54
finish.phase = "move"
finish.dice = 3
finish.legal = legalMoves(finish, 3)
assert.equal(finish.legal.includes(last.id), false, "on ne dépasse pas l'arrivée")
finish.dice = 2
finish.legal = legalMoves(finish, 2)
assert.ok(finish.legal.includes(last.id))
applyMove(finish, last.id, 6_000)
assert.equal(last.pos, FINISH)

console.log("règles ludo ok")
