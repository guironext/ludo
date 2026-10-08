import { randomBytes, randomInt } from "crypto"
import type { Game, Prisma, User } from "@prisma/client"
import { ONLINE_MS, isOnline } from "./auth"
import { prisma } from "./db"
import { chooseMove } from "./ludo/ai"
import { PLAYER_COLORS, PLAYER_LABELS, seatsFor } from "./ludo/board"
import { advance, applyMove, applyRoll, createMatch, forfeit, type LudoState } from "./ludo/engine"
import {
  boardAdvance,
  boardForfeit,
  boardPlay,
  createBoardMatch,
  isBoardGame,
  isBoardMatch,
  parseGameType,
  type BoardInput,
  type BoardMatch,
  type GameType,
} from "./games/match"
import {
  CASHOUT_MIN_LION,
  HOUSE_PSEUDO,
  LEVELS,
  POKY_PER_LION,
  ROLE_JOUEUR,
  ROLE_MAISON,
  SIGNUP_POKY,
  VIP_CHALLENGE_MIN_LION,
  VIP_TABLE_MIN_LION,
  WELCOME_REPAY_FCFA,
  WELCOME_REPAY_LION,
  eurFromLion,
  fcfaFromLion,
  levelById,
  splitPot,
  type LevelId,
} from "./rules"

export class PlayError extends Error {}

type Lobby = { lobby: true; seats: number[] }

function isLobby(value: unknown): value is Lobby {
  return Boolean(value && typeof value === "object" && "lobby" in value && (value as Lobby).lobby)
}

function parseState(raw: string): Lobby | LudoState | BoardMatch {
  return JSON.parse(raw) as Lobby | LudoState | BoardMatch
}

/** Nouvel état de partie selon le jeu (Ludo ou jeu de plateau à 2). */
function newMatch(gameType: string, seats: number[], bots: number[]): LudoState | BoardMatch {
  return isBoardGame(gameType) ? createBoardMatch(gameType, seats, bots, Date.now()) : createMatch(seats, bots, Date.now())
}

function activeSeats(state: LudoState | BoardMatch) {
  return isBoardMatch(state) ? state.seats : state.active
}

function die() {
  return randomInt(1, 7)
}

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = randomBytes(6)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")
}

export async function ensureHouse() {
  const existing = await prisma.user.findUnique({ where: { pseudo: HOUSE_PSEUDO } })
  if (existing?.role === ROLE_MAISON) return existing
  if (existing) return prisma.user.update({ where: { id: existing.id }, data: { role: ROLE_MAISON } })
  return prisma.user.create({
    data: {
      pseudo: HOUSE_PSEUDO,
      email: "maison@ludo-poky.local",
      passwordHash: "disabled",
      poky: 5_000_000,
      pokyBonus: 0,
      lion: 500_000,
      adult: true,
      role: ROLE_MAISON,
    },
  })
}

async function debit(
  tx: Prisma.TransactionClient,
  userId: string,
  currency: "poky" | "lion",
  amount: number,
  reason: string,
  gameId: string,
) {
  const user = await tx.user.findUnique({ where: { id: userId } })
  if (!user) throw new PlayError("Joueur introuvable.")
  if (currency === "poky") {
    if (user.poky < amount) throw new PlayError(`${user.pseudo} n'a pas assez de poky.`)
    const bonus = Math.min(user.pokyBonus, amount)
    await tx.user.update({
      where: { id: userId },
      data: { poky: user.poky - amount, pokyBonus: user.pokyBonus - bonus },
    })
  } else if (user.lion < amount) {
    throw new PlayError(`${user.pseudo} n'a pas assez de Lion.`)
  } else {
    await tx.user.update({
      where: { id: userId },
      data: { lion: user.lion - amount },
    })
  }
  await tx.walletTx.create({
    data: { userId, currency, amount: -amount, reason, gameId },
  })
}

async function credit(
  tx: Prisma.TransactionClient,
  userId: string,
  currency: string,
  amount: number,
  reason: string,
  gameId: string,
) {
  if (amount <= 0) return
  await tx.user.update({
    where: { id: userId },
    data: currency === "lion" ? { lion: { increment: amount } } : { poky: { increment: amount } },
  })
  await tx.walletTx.create({
    data: { userId, currency, amount, reason, gameId },
  })
}

async function payout(tx: Prisma.TransactionClient, game: Game, state: LudoState | BoardMatch) {
  const fresh = await tx.game.findUnique({ where: { id: game.id } })
  if (!fresh || fresh.status !== "playing") return
  const house = await tx.user.findUnique({ where: { pseudo: HOUSE_PSEUDO } })
  if (!house) throw new PlayError("Caisse de la maison introuvable.")
  if (isBoardMatch(state) && state.draw && state.winner == null) {
    // partie nulle : chaque mise est rendue (celle de l'ordinateur revient à la maison)
    const seats = await tx.gamePlayer.findMany({ where: { gameId: fresh.id } })
    for (const seat of seats) {
      await credit(tx, seat.isAi || !seat.userId ? house.id : seat.userId, fresh.stakeCurrency, fresh.stakeAmount, "partie nulle · mise rendue", fresh.id)
    }
    await tx.game.update({
      where: { id: fresh.id },
      data: { status: "finished", winnerId: null, stateJson: JSON.stringify(state) },
    })
    await tx.challenge.updateMany({
      where: { gameId: fresh.id, status: "playing" },
      data: { status: "finished", winnerId: null, resolvedAt: new Date() },
    })
    return
  }
  if (state.winner == null) return
  const { winner, house: rake } = splitPot(fresh.pot)
  const seat = await tx.gamePlayer.findFirst({
    where: { gameId: fresh.id, seat: state.winner },
  })
  const currency = fresh.stakeCurrency
  if (seat?.userId) {
    await credit(tx, seat.userId, currency, winner, "gain", fresh.id)
    await credit(tx, house.id, currency, rake, "commission", fresh.id)
  } else {
    await credit(tx, house.id, currency, winner + rake, "gain ordinateur", fresh.id)
  }
  await tx.game.update({
    where: { id: fresh.id },
    data: { status: "finished", winnerId: seat?.userId ?? null, stateJson: JSON.stringify(state) },
  })
  await tx.challenge.updateMany({
    where: { gameId: fresh.id, status: "playing" },
    data: {
      status: "finished",
      winnerId: seat?.userId ?? null,
      resolvedAt: new Date(),
    },
  })
}

function stakeFor(levelId: string, requested: number) {
  const level = levelById(levelId)
  if (!level) throw new PlayError("Niveau inconnu.")
  if (level.custom) {
    const stake = Math.floor(requested)
    if (stake < level.stake) {
      throw new PlayError(`La mise ${level.label} est d'au moins ${level.stake} Lion.`)
    }
    return { level, stake }
  }
  return { level, stake: level.stake }
}

export async function createRoom(user: User, input: {
  level: string
  players: number
  stake: number
  invites: string[]
  fillAi: boolean
  gameType?: string
}) {
  const players = input.players
  const gameType: GameType = parseGameType(input.gameType)
  if (![1, 2, 3, 4].includes(players)) throw new PlayError("Choisis 1, 2, 3 ou 4 joueurs.")
  if (gameType !== "ludo" && players > 2) throw new PlayError("Ce jeu se joue à 2 : contre l'ordinateur ou un contre un.")
  const { level, stake } = stakeFor(input.level, input.stake)
  if (players === 1 && level.id !== "gratuit" && level.id !== "vip") {
    throw new PlayError("Contre l'ordinateur, seuls le gratuit et le salon VIP sont ouverts.")
  }
  if (players > 1 && players < level.minPlayers) {
    throw new PlayError("Ce salon se joue à partir de 2 joueurs.")
  }
  const total = players === 1 ? 2 : players
  const seats = seatsFor(total)
  const fillAi = players === 1 || input.fillAi
  const invites = fillAi
    ? []
    : input.invites.map((pseudo) => pseudo.trim().toLowerCase()).filter(Boolean)
  if (invites.length > seats.length - 1) throw new PlayError("Trop d'invitations pour cette salle.")
  const unique = new Set(invites)
  if (unique.size !== invites.length) throw new PlayError("Un pseudo est invité deux fois.")
  if (unique.has(user.pseudo.toLowerCase())) throw new PlayError("Tu ne peux pas t'inviter.")
  const house = await ensureHouse()
  const code = makeCode()
  const game = await prisma.game.create({
    data: {
      code,
      level: level.id,
      gameType,
      stakeCurrency: level.currency,
      stakeAmount: stake,
      status: "waiting",
      creatorId: user.id,
      stateJson: JSON.stringify({ lobby: true, seats } satisfies Lobby),
      players: {
        create: {
          userId: user.id,
          seat: seats[0],
          name: user.pseudo,
          color: PLAYER_COLORS[seats[0]],
        },
      },
      invites: {
        create: invites.map((pseudo) => ({ pseudo, status: "pending" })),
      },
    },
  })
  if (fillAi) {
    try {
      await prisma.gamePlayer.createMany({
        data: seats.slice(1).map((seat) => ({
          gameId: game.id,
          seat,
          name: "Ordinateur",
          color: PLAYER_COLORS[seat],
          isAi: true,
        })),
      })
      await startRoom(user, code, house.id)
    } catch (error) {
      await prisma.game.delete({ where: { id: game.id } })
      throw error
    }
  }
  return code
}

export async function joinRoom(user: User, code: string) {
  const game = await prisma.game.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { players: true, invites: { orderBy: { createdAt: "asc" } } },
  })
  if (!game) throw new PlayError("Salle introuvable.")
  if (game.status !== "waiting") throw new PlayError("Cette partie a déjà commencé.")
  if (game.players.some((player) => player.userId === user.id)) return game.code
  const stored = parseState(game.stateJson)
  if (!isLobby(stored)) throw new PlayError("Cette salle n'accepte plus de joueurs.")
  const taken = new Set(game.players.map((player) => player.seat))
  const open = stored.seats.filter((seat) => !taken.has(seat))
  const pseudo = user.pseudo.toLowerCase()
  const refused = game.invites.find(
    (invite) =>
      invite.status === "refused" &&
      (invite.userId === user.id || invite.pseudo.toLowerCase() === pseudo),
  )
  if (refused) throw new PlayError("Tu as refusé cette invitation.")
  const holding = game.invites.filter((invite) => invite.status !== "refused")
  const reserved = new Set(holding.map((invite) => invite.pseudo.toLowerCase()))
  const mine = holding.find((invite) => invite.userId === user.id || invite.pseudo.toLowerCase() === pseudo)
  let seat: number | undefined
  if (mine) {
    const reservedSeats = stored.seats.slice(1, 1 + holding.length)
    const index = holding.findIndex((invite) => invite.userId === user.id || invite.pseudo.toLowerCase() === pseudo)
    seat = reservedSeats[index]
    if (seat == null || taken.has(seat)) seat = open.find((item) => !taken.has(item))
  } else {
    const reservedSeats = new Set(stored.seats.slice(1, 1 + holding.length))
    seat = open.find((item) => !reservedSeats.has(item))
  }
  if (seat == null) {
    throw new PlayError(reserved.size ? "Les places restantes sont réservées." : "La salle est pleine.")
  }
  await prisma.gamePlayer.create({
    data: {
      gameId: game.id,
      userId: user.id,
      seat,
      name: user.pseudo,
      color: PLAYER_COLORS[seat],
    },
  })
  return game.code
}

function sameInvite(invite: { userId: string | null; pseudo: string }, user: User) {
  return invite.userId === user.id || invite.pseudo.toLowerCase() === user.pseudo.toLowerCase()
}

export async function invitePlayer(user: User, code: string, targetId: string) {
  const game = await prisma.game.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { players: true, invites: true },
  })
  if (!game || game.creatorId !== user.id) throw new PlayError("Seul le créateur peut inviter.")
  if (game.status !== "waiting") throw new PlayError("La partie a déjà commencé.")
  const stored = parseState(game.stateJson)
  if (!isLobby(stored) || stored.seats.length < 2) throw new PlayError("Ce salon ne se partage pas.")
  if (targetId === user.id) throw new PlayError("Tu ne peux pas t'inviter.")
  const target = await prisma.user.findUnique({ where: { id: targetId } })
  if (!target || target.role !== ROLE_JOUEUR) throw new PlayError("Joueur introuvable.")
  if (!isOnline(target.lastSeen)) throw new PlayError("Ce joueur n'est plus connecté.")
  if (game.players.some((player) => player.userId === target.id)) throw new PlayError("Ce joueur est déjà à la table.")
  const pending = game.invites.filter((invite) => invite.status === "pending")
  const openSeats = stored.seats.length - game.players.length
  const already = game.invites.find((invite) => sameInvite(invite, target))
  if (!already && pending.length >= openSeats) throw new PlayError("Toutes les places ont déjà une invitation.")
  if (already) {
    await prisma.invite.update({
      where: { id: already.id },
      data: { status: "pending", userId: target.id, pseudo: target.pseudo.toLowerCase() },
    })
    return
  }
  await prisma.invite.create({
    data: {
      gameId: game.id,
      userId: target.id,
      pseudo: target.pseudo.toLowerCase(),
      status: "pending",
    },
  })
}

export async function acceptGameLink(user: User, code: string) {
  const game = await prisma.game.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { invites: true },
  })
  if (!game) throw new PlayError("Salle introuvable.")
  const invite = game.invites.find((item) => sameInvite(item, user))
  if (invite?.status === "refused") throw new PlayError("Tu as refusé cette invitation.")
  if (invite && invite.status !== "accepted") {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { status: "accepted", userId: user.id },
    })
  }
  return joinRoom(user, game.code)
}

export async function refuseGameLink(user: User, code: string) {
  const game = await prisma.game.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { invites: true },
  })
  if (!game) throw new PlayError("Salle introuvable.")
  const invite = game.invites.find((item) => sameInvite(item, user) && item.status === "pending")
  if (invite) {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { status: "refused", userId: user.id },
    })
  }
}

export async function answerInvite(user: User, inviteId: string, accept: boolean) {
  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
    include: { game: true },
  })
  if (!invite || !sameInvite(invite, user)) throw new PlayError("Invitation introuvable.")
  if (invite.status !== "pending") throw new PlayError("Cette invitation n'est plus valable.")
  if (!accept) {
    await refuseGameLink(user, invite.game.code)
    return null
  }
  return acceptGameLink(user, invite.game.code)
}

export async function pendingInvites(user: User) {
  const rows = await prisma.invite.findMany({
    where: {
      status: "pending",
      game: { status: "waiting" },
      OR: [{ userId: user.id }, { pseudo: user.pseudo.toLowerCase() }],
    },
    include: { game: { include: { creator: true, players: true } } },
    orderBy: { createdAt: "desc" },
  })
  return rows.flatMap((row) => {
    if (row.game.players.some((player) => player.userId === user.id)) return []
    const stored = parseState(row.game.stateJson)
    const seats = isLobby(stored) ? stored.seats.length : 0
    if (seats < 2) return []
    return [
      {
        id: row.id,
        code: row.game.code,
        from: row.game.creator.pseudo,
        seats,
        stake: row.game.stakeAmount,
        currency: row.game.stakeCurrency,
      },
    ]
  })
}

export async function addAi(user: User, code: string) {
  const game = await prisma.game.findUnique({
    where: { code },
    include: { players: true },
  })
  if (!game || game.creatorId !== user.id) throw new PlayError("Seul le créateur peut ajouter l'ordinateur.")
  if (game.status !== "waiting") throw new PlayError("La partie a déjà commencé.")
  const stored = parseState(game.stateJson)
  if (!isLobby(stored)) throw new PlayError("Salle invalide.")
  const taken = new Set(game.players.map((player) => player.seat))
  const seat = stored.seats.find((item) => !taken.has(item))
  if (seat == null) throw new PlayError("Il n'y a plus de place.")
  await prisma.gamePlayer.create({
    data: {
      gameId: game.id,
      seat,
      name: "Ordinateur",
      color: PLAYER_COLORS[seat],
      isAi: true,
    },
  })
}

export async function cancelRoom(user: User, code: string) {
  const game = await prisma.game.findUnique({ where: { code } })
  if (!game || game.creatorId !== user.id) throw new PlayError("Seul le créateur peut annuler.")
  if (game.status !== "waiting") throw new PlayError("La mise est déjà engagée.")
  await prisma.game.delete({ where: { id: game.id } })
}

export async function startRoom(user: User, code: string, houseId?: string) {
  const house = houseId ? { id: houseId } : await ensureHouse()
  await prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({
      where: { code },
      include: { players: true },
    })
    if (!game || game.creatorId !== user.id) throw new PlayError("Seul le créateur peut lancer la partie.")
    if (game.status !== "waiting") throw new PlayError("Cette partie est déjà lancée.")
    const stored = parseState(game.stateJson)
    if (!isLobby(stored)) throw new PlayError("Salle invalide.")
    if (game.players.length !== stored.seats.length) {
      throw new PlayError("La salle n'est pas complète.")
    }
    const currency = game.stakeCurrency === "lion" ? "lion" : "poky"
    for (const player of game.players) {
      await debit(
        tx,
        player.isAi || !player.userId ? house.id : player.userId,
        currency,
        game.stakeAmount,
        "mise",
        game.id,
      )
    }
    const bots = game.players.filter((player) => player.isAi).map((player) => player.seat)
    const state = newMatch(game.gameType, stored.seats, bots)
    await tx.game.update({
      where: { id: game.id },
      data: {
        status: "playing",
        pot: game.stakeAmount * game.players.length,
        stateJson: JSON.stringify(state),
      },
    })
  })
}

async function saveProgress(code: string) {
  await prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { code } })
    if (!game || game.status !== "playing") return
    const stored = parseState(game.stateJson)
    if (isLobby(stored)) return
    const before = game.stateJson
    if (isBoardMatch(stored)) boardAdvance(stored, Date.now())
    else advance(stored, Date.now(), die, chooseMove)
    const next = JSON.stringify(stored)
    if (next !== before) {
      const updated = await tx.game.updateMany({
        where: { id: game.id, stateJson: before },
        data: { stateJson: next },
      })
      if (updated.count !== 1) return
    }
    if (stored.winner != null || (isBoardMatch(stored) && stored.draw)) await payout(tx, game, stored)
  })
}

export async function playerAct(user: User, code: string, action: "roll" | "move" | "forfeit", pieceId?: string) {
  await prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({
      where: { code },
      include: { players: true },
    })
    if (!game || game.status !== "playing") throw new PlayError("Aucune partie en cours.")
    const mine = game.players.find((player) => player.userId === user.id)
    if (!mine) throw new PlayError("Tu n'es pas dans cette partie.")
    const state = parseState(game.stateJson)
    if (isLobby(state) || state.winner != null) throw new PlayError("Cette partie est terminée.")
    if (isBoardMatch(state)) throw new PlayError("Action réservée au Ludo.")
    if (action === "forfeit") {
      forfeit(state, mine.seat, Date.now())
    } else if (state.turn !== mine.seat || state.bots.includes(mine.seat)) {
      throw new PlayError("Ce n'est pas ton tour.")
    } else if (action === "roll") {
      if (state.phase !== "roll") throw new PlayError("Le dé est déjà lancé.")
      applyRoll(state, die(), Date.now())
    } else if (!pieceId || !applyMove(state, pieceId, Date.now())) {
      throw new PlayError("Ce pion ne peut pas jouer ce dé.")
    }
    await tx.game.update({
      where: { id: game.id },
      data: { stateJson: JSON.stringify(state) },
    })
    if (state.winner != null) await payout(tx, game, state)
  })
}

/** Coup ou abandon dans une partie d'échecs, de dames ou d'awalé. Le serveur valide le coup. */
export async function boardAct(user: User, code: string, action: "play" | "forfeit", input: BoardInput) {
  await prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({
      where: { code },
      include: { players: true },
    })
    if (!game || game.status !== "playing") throw new PlayError("Aucune partie en cours.")
    const mine = game.players.find((player) => player.userId === user.id)
    if (!mine) throw new PlayError("Tu n'es pas dans cette partie.")
    const state = parseState(game.stateJson)
    if (!isBoardMatch(state)) throw new PlayError("Cette partie n'est pas un jeu de plateau.")
    if (state.winner != null || state.draw) throw new PlayError("Cette partie est terminée.")
    if (action === "forfeit") {
      boardForfeit(state, mine.seat)
    } else if (state.turn !== mine.seat || state.bots.includes(mine.seat)) {
      throw new PlayError("Ce n'est pas ton tour.")
    } else if (!boardPlay(state, mine.seat, input, Date.now())) {
      throw new PlayError("Coup illégal.")
    }
    const updated = await tx.game.updateMany({
      where: { id: game.id, stateJson: game.stateJson },
      data: { stateJson: JSON.stringify(state) },
    })
    if (updated.count !== 1) throw new PlayError("La partie a changé, réessaie.")
    if (state.winner != null || state.draw) await payout(tx, game, state)
  })
}

export async function replayRoom(user: User, code: string) {
  const house = await ensureHouse()
  await prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({
      where: { code },
      include: { players: true },
    })
    if (!game) throw new PlayError("Salle introuvable.")
    if (!game.players.some((player) => player.userId === user.id)) {
      throw new PlayError("Tu n'es pas dans cette partie.")
    }
    if (game.status !== "finished") throw new PlayError("La partie n'est pas terminée.")
    const stored = parseState(game.stateJson)
    if (isLobby(stored) || (stored.winner == null && !(isBoardMatch(stored) && stored.draw))) {
      throw new PlayError("La partie n'est pas terminée.")
    }
    const currency = game.stakeCurrency === "lion" ? "lion" : "poky"
    for (const player of game.players) {
      await debit(
        tx,
        player.isAi || !player.userId ? house.id : player.userId,
        currency,
        game.stakeAmount,
        "nouvelle mise",
        game.id,
      )
    }
    const bots = game.players.filter((player) => player.isAi).map((player) => player.seat)
    const state = newMatch(game.gameType, activeSeats(stored), bots)
    const updated = await tx.game.updateMany({
      where: { id: game.id, status: "finished" },
      data: {
        status: "playing",
        winnerId: null,
        pot: game.stakeAmount * game.players.length,
        stateJson: JSON.stringify(state),
      },
    })
    if (updated.count !== 1) throw new PlayError("La revanche est déjà lancée.")
  })
}

export async function tick(code: string) {
  const game = await prisma.game.findUnique({ where: { code } })
  if (game?.status === "playing") await saveProgress(code)
}

export async function snapshot(user: User, code: string) {
  await tick(code)
  const game = await prisma.game.findUnique({
    where: { code },
    include: { players: { orderBy: { seat: "asc" } }, invites: true, creator: true },
  })
  if (!game) throw new PlayError("Salle introuvable.")
  const fresh = await prisma.user.findUnique({ where: { id: user.id } })
  const stored = parseState(game.stateJson)
  const level = LEVELS.find((item) => item.id === (game.level as LevelId))
  const pending = game.invites.filter((invite) => invite.status === "pending")
  const yours = game.invites.find((invite) => sameInvite(invite, user)) ?? null
  const since = new Date(Date.now() - ONLINE_MS)
  const seated = new Set(game.players.map((player) => player.userId).filter((id): id is string => Boolean(id)))
  const lobby = isLobby(stored) && game.status === "waiting" && game.creatorId === user.id && stored.seats.length >= 2
  const online = lobby
    ? await prisma.user.findMany({
        where: { role: ROLE_JOUEUR, id: { notIn: [user.id, ...seated] }, lastSeen: { gte: since } },
        select: { id: true, pseudo: true },
        orderBy: { pseudo: "asc" },
        take: 24,
      })
    : []
  const invitedIds = new Set(pending.map((invite) => invite.userId).filter((id): id is string => Boolean(id)))
  return {
    code: game.code,
    level: game.level,
    levelLabel: level?.label ?? game.level,
    gameType: parseGameType(game.gameType),
    status: game.status,
    currency: game.stakeCurrency,
    stake: game.stakeAmount,
    pot: game.pot,
    creatorId: game.creatorId,
    you: user.id,
    yourSeat: game.players.find((player) => player.userId === user.id)?.seat ?? null,
    players: game.players.map((player) => ({
      seat: player.seat,
      name: player.name,
      color: player.color,
      isAi: player.isAi,
      userId: player.userId,
    })),
    invites: pending.map((invite) => invite.pseudo),
    yourInvite: yours ? { id: yours.id, status: yours.status } : null,
    online: online.map((player) => ({
      id: player.id,
      pseudo: player.pseudo,
      invited: invitedIds.has(player.id),
    })),
    seats: isLobby(stored) ? stored.seats : activeSeats(stored),
    state: isLobby(stored) || isBoardMatch(stored) ? null : stored,
    board: isBoardMatch(stored) ? stored : null,
    wallet: {
      poky: fresh?.poky ?? 0,
      pokyBonus: fresh?.pokyBonus ?? 0,
      lion: fresh?.lion ?? 0,
      convertible: Math.max(0, (fresh?.poky ?? 0) - (fresh?.pokyBonus ?? 0)),
    },
    share: splitPot(game.pot || game.stakeAmount * Math.max(game.players.length, 1)),
    labels: PLAYER_LABELS,
  }
}

export async function convertPoky(user: User, lions: number) {
  const count = Math.floor(lions)
  if (count < 1) throw new PlayError("Indique au moins 1 Lion.")
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.user.findUnique({ where: { id: user.id } })
    if (!fresh) throw new PlayError("Compte introuvable.")
    const cost = count * POKY_PER_LION
    const convertible = fresh.poky - fresh.pokyBonus
    if (convertible < cost) {
      throw new PlayError("Seuls les poky gagnés se convertissent. Le bonus de bienvenue reste pour les parties gratuites.")
    }
    await tx.user.update({
      where: { id: user.id },
      data: { poky: fresh.poky - cost, lion: fresh.lion + count },
    })
    await tx.walletTx.create({
      data: { userId: user.id, currency: "poky", amount: -cost, reason: "conversion en Lion" },
    })
    await tx.walletTx.create({
      data: { userId: user.id, currency: "lion", amount: count, reason: "conversion depuis les poky" },
    })
  })
}

export async function buyLions(user: User, lions: number) {
  const count = Math.floor(lions)
  if (!Number.isFinite(count) || count < 1) throw new PlayError("Indique au moins 1 Lion.")
  const fcfa = fcfaFromLion(count)
  const eur = eurFromLion(count)
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.user.findUnique({ where: { id: user.id } })
    if (!fresh) throw new PlayError("Compte introuvable.")
    await tx.user.update({
      where: { id: user.id },
      data: { lion: fresh.lion + count },
    })
    await tx.walletTx.create({
      data: {
        userId: user.id,
        currency: "lion",
        amount: count,
        reason: `achat de Lion · ${frAmount(fcfa)} FCFA · ${frAmount(eur, true)} €`,
      },
    })
  })
}

export async function convertLionToPoky(user: User, lions: number) {
  const count = Math.floor(lions)
  if (!Number.isFinite(count) || count < 1) throw new PlayError("Indique au moins 1 Lion.")
  const gain = count * POKY_PER_LION
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.user.findUnique({ where: { id: user.id } })
    if (!fresh) throw new PlayError("Compte introuvable.")
    if (fresh.lion < count) throw new PlayError("Pas assez de Lion.")
    await tx.user.update({
      where: { id: user.id },
      data: { lion: fresh.lion - count, poky: fresh.poky + gain },
    })
    await tx.walletTx.create({
      data: { userId: user.id, currency: "lion", amount: -count, reason: "conversion en poky" },
    })
    await tx.walletTx.create({
      data: { userId: user.id, currency: "poky", amount: gain, reason: "conversion depuis les Lion" },
    })
  })
}


export async function cashoutLions(user: User, lions: number) {
  const amount = Math.floor(lions)
  if (!Number.isFinite(amount) || amount < 1) throw new PlayError("Indique au moins 1 Lion.")
  if (amount < CASHOUT_MIN_LION) {
    throw new PlayError(
      `Le retrait commence à ${frAmount(CASHOUT_MIN_LION)} Lion (${frAmount(fcfaFromLion(CASHOUT_MIN_LION))} FCFA).`,
    )
  }
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.user.findUnique({ where: { id: user.id } })
    if (!fresh) throw new PlayError("Compte introuvable.")
    if (fresh.role !== ROLE_JOUEUR) throw new PlayError("Seuls les joueurs peuvent retirer.")
    if (fresh.lion < amount) throw new PlayError("Pas assez de Lion.")
    const repay = fresh.welcomeBonusRepaid ? 0 : WELCOME_REPAY_LION
    if (repay > 0 && amount < repay) {
      throw new PlayError(
        `Premier retrait impossible : il faut au moins ${frAmount(repay)} Lion (${frAmount(WELCOME_REPAY_FCFA)} FCFA) pour rembourser le bonus de bienvenue de ${frAmount(SIGNUP_POKY)} poky. Aucun report partiel.`,
      )
    }
    const house = await tx.user.findUnique({ where: { pseudo: HOUSE_PSEUDO } })
    if (!house) throw new PlayError("Caisse de la maison introuvable.")
    const net = amount - repay
    await tx.user.update({
      where: { id: fresh.id },
      data: {
        lion: fresh.lion - amount,
        welcomeBonusRepaid: true,
      },
    })
    if (repay > 0) {
      await tx.walletTx.create({
        data: {
          userId: fresh.id,
          currency: "lion",
          amount: -repay,
          reason: `remboursement bonus de bienvenue · ${frAmount(SIGNUP_POKY)} poky = ${frAmount(repay)} Lion = ${frAmount(WELCOME_REPAY_FCFA)} FCFA`,
        },
      })
      await tx.user.update({
        where: { id: house.id },
        data: { lion: { increment: repay } },
      })
      await tx.walletTx.create({
        data: {
          userId: house.id,
          currency: "lion",
          amount: repay,
          reason: `remboursement bonus de bienvenue · ${fresh.pseudo}`,
        },
      })
    }
    if (net > 0) {
      await tx.walletTx.create({
        data: {
          userId: fresh.id,
          currency: "lion",
          amount: -net,
          reason: `retrait · ${frAmount(fcfaFromLion(net))} FCFA · ${frAmount(eurFromLion(net), true)} € (virement carte non branché)`,
        },
      })
    }
  })
}

export async function createVipRoom(
  user: User,
  input: { players: number; stake: number; invites?: string[]; fillAi?: boolean; gameType?: string },
) {
  const players = input.players
  const fillAi = players === 1 || Boolean(input.fillAi)
  return createRoom(user, {
    level: "vip",
    players,
    stake: Math.max(VIP_TABLE_MIN_LION, Math.floor(input.stake) || VIP_TABLE_MIN_LION),
    invites: input.invites ?? [],
    fillAi,
    gameType: input.gameType,
  })
}

export async function createChallenge(user: User, targetPseudo: string, stakeRaw: number, gameTypeRaw?: string) {
  const gameType = parseGameType(gameTypeRaw)
  const stake = Math.floor(stakeRaw)
  if (!Number.isFinite(stake) || stake < VIP_CHALLENGE_MIN_LION) {
    throw new PlayError(`La mise d'un défi VIP est d'au moins ${VIP_CHALLENGE_MIN_LION} Lion.`)
  }
  const pseudo = targetPseudo.trim().toLowerCase()
  if (!pseudo) throw new PlayError("Indique le pseudo du joueur à défier.")
  if (pseudo === user.pseudo.toLowerCase()) throw new PlayError("Tu ne peux pas te défier toi-même.")
  const candidates = await prisma.user.findMany({
    where: { role: ROLE_JOUEUR },
    select: { id: true, pseudo: true, lion: true, role: true },
  })
  const target = candidates.find((item) => item.pseudo.toLowerCase() === pseudo)
  if (!target) throw new PlayError("Joueur introuvable.")
  const fresh = await prisma.user.findUnique({ where: { id: user.id } })
  if (!fresh || fresh.lion < stake) throw new PlayError("Pas assez de Lion pour proposer ce défi.")
  const pending = await prisma.challenge.findFirst({
    where: {
      status: "pending",
      OR: [
        { challengerId: user.id, challengedId: target.id },
        { challengerId: target.id, challengedId: user.id },
      ],
    },
  })
  if (pending) throw new PlayError("Un défi est déjà en attente avec ce joueur.")
  const row = await prisma.challenge.create({
    data: {
      challengerId: user.id,
      challengedId: target.id,
      stakeLion: stake,
      gameType,
      status: "pending",
    },
  })
  return row.id
}

export async function answerChallenge(user: User, challengeId: string, accept: boolean) {
  if (!accept) {
    const row = await prisma.challenge.findUnique({ where: { id: challengeId } })
    if (!row || row.challengedId !== user.id) throw new PlayError("Défi introuvable.")
    if (row.status !== "pending") throw new PlayError("Ce défi n'est plus valable.")
    await prisma.challenge.update({
      where: { id: row.id },
      data: { status: "declined", resolvedAt: new Date() },
    })
    return null
  }

  const house = await ensureHouse()
  const code = makeCode()
  const seats = seatsFor(2)

  return prisma.$transaction(async (tx) => {
    const row = await tx.challenge.findUnique({
      where: { id: challengeId },
      include: { challenger: true, challenged: true },
    })
    if (!row || row.challengedId !== user.id) throw new PlayError("Défi introuvable.")
    if (row.status !== "pending") throw new PlayError("Ce défi n'est plus valable.")
    const stake = row.stakeLion
    const challenger = await tx.user.findUnique({ where: { id: row.challengerId } })
    const challenged = await tx.user.findUnique({ where: { id: row.challengedId } })
    if (!challenger || !challenged) throw new PlayError("Joueur introuvable.")
    if (challenger.lion < stake) throw new PlayError(`${challenger.pseudo} n'a plus assez de Lion.`)
    if (challenged.lion < stake) throw new PlayError("Tu n'as pas assez de Lion pour accepter.")

    const game = await tx.game.create({
      data: {
        code,
        level: "vip",
        gameType: row.gameType,
        stakeCurrency: "lion",
        stakeAmount: stake,
        status: "waiting",
        creatorId: challenger.id,
        stateJson: JSON.stringify({ lobby: true, seats } satisfies Lobby),
        players: {
          create: [
            {
              userId: challenger.id,
              seat: seats[0],
              name: challenger.pseudo,
              color: PLAYER_COLORS[seats[0]],
            },
            {
              userId: challenged.id,
              seat: seats[1],
              name: challenged.pseudo,
              color: PLAYER_COLORS[seats[1]],
            },
          ],
        },
      },
    })

    await debit(tx, challenger.id, "lion", stake, "mise défi VIP", game.id)
    await debit(tx, challenged.id, "lion", stake, "mise défi VIP", game.id)

    const state = newMatch(row.gameType, seats, [])
    await tx.game.update({
      where: { id: game.id },
      data: {
        status: "playing",
        pot: stake * 2,
        stateJson: JSON.stringify(state),
      },
    })
    await tx.challenge.update({
      where: { id: row.id },
      data: { status: "playing", gameId: game.id },
    })
    // keep house referenced so the caisse account exists for later commission
    void house
    return code
  })
}

export async function pendingChallenges(user: User) {
  const rows = await prisma.challenge.findMany({
    where: {
      status: "pending",
      OR: [{ challengedId: user.id }, { challengerId: user.id }],
    },
    include: {
      challenger: { select: { id: true, pseudo: true } },
      challenged: { select: { id: true, pseudo: true } },
    },
    orderBy: { createdAt: "desc" },
  })
  return rows.map((row) => ({
    id: row.id,
    stake: row.stakeLion,
    gameType: parseGameType(row.gameType),
    createdAt: row.createdAt.toISOString(),
    incoming: row.challengedId === user.id,
    opponent: row.challengedId === user.id ? row.challenger.pseudo : row.challenged.pseudo,
  }))
}

export async function publicChallengeResults(limit = 30) {
  const rows = await prisma.challenge.findMany({
    where: { status: "finished" },
    include: {
      challenger: { select: { pseudo: true } },
      challenged: { select: { pseudo: true } },
      winner: { select: { pseudo: true } },
    },
    orderBy: { resolvedAt: "desc" },
    take: limit,
  })
  return rows.map((row) => ({
    id: row.id,
    stake: row.stakeLion,
    gameType: parseGameType(row.gameType),
    challenger: row.challenger.pseudo,
    challenged: row.challenged.pseudo,
    winner: row.winner?.pseudo ?? "Ordinateur",
    date: (row.resolvedAt ?? row.createdAt).toISOString(),
  }))
}

export async function listOnlinePlayers(exceptId: string) {
  const since = new Date(Date.now() - ONLINE_MS)
  return prisma.user.findMany({
    where: {
      role: ROLE_JOUEUR,
      id: { not: exceptId },
      lastSeen: { gte: since },
    },
    select: { id: true, pseudo: true, lion: true },
    orderBy: { pseudo: "asc" },
    take: 40,
  })
}

function frAmount(value: number, euros = false) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: euros ? 2 : 0,
    maximumFractionDigits: euros ? 2 : 2,
  })
    .format(value)
    .replace(/[\u202f\u00a0]/g, " ")
}

