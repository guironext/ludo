"use server"

import { redirect, unstable_rethrow } from "next/navigation"
import { partiePath, requireJoueur, requireUser } from "@/lib/auth"
import {
  PlayError,
  addAi,
  answerChallenge,
  buyLions,
  cancelRoom,
  cashoutLions,
  convertLionToPoky,
  convertPoky,
  createChallenge,
  createRoom,
  createVipRoom,
  joinRoom,
  startRoom,
} from "@/lib/play"
import { FREE_STAKE_POKY, VIP_TABLE_MIN_LION } from "@/lib/rules"

/**
 * Renvoie l'erreur vers la page, en clair, au lieu de la perdre.
 * Les redirections de Next (redirect/notFound) sont relancées telles quelles.
 * Une erreur inattendue (base, délai dépassé…) est journalisée dans les logs Vercel
 * et affichée au joueur avec un message générique, au lieu d'un clic « qui ne fait rien ».
 */
function bounce(path: string, error: unknown): never {
  unstable_rethrow(error)
  const sep = path.includes("?") ? "&" : "?"
  if (error instanceof PlayError) {
    redirect(`${path}${sep}erreur=${encodeURIComponent(error.message)}`)
  }
  console.error("[action jeu]", path, error)
  redirect(`${path}${sep}erreur=${encodeURIComponent("Le serveur n'a pas pu ouvrir la partie. Réessaie dans un instant.")}`)
}

export async function ouvrirSalon(formData: FormData) {
  const user = await requireJoueur()
  try {
    const code = await createRoom(user, {
      level: "gratuit",
      players: Number(formData.get("players") ?? 1),
      stake: FREE_STAKE_POKY,
      invites: [],
      fillAi: String(formData.get("players") ?? "") === "1",
    })
    redirect(partiePath(code))
  } catch (error) {
    bounce("/joueur", error)
  }
}

export async function ouvrirSalonVip(formData: FormData) {
  const user = await requireJoueur()
  const players = Number(formData.get("players") ?? 1)
  const playersParam = players === 1 || players === 2 || players === 3 || players === 4 ? players : 2
  try {
    const code = await createVipRoom(user, {
      players,
      stake: Number(formData.get("stake") ?? VIP_TABLE_MIN_LION),
      invites: String(formData.get("invites") ?? "").split(","),
      fillAi: players === 1 || formData.get("fillAi") === "oui",
      gameType: String(formData.get("gameType") ?? "ludo"),
    })
    redirect(partiePath(code))
  } catch (error) {
    const jeu = String(formData.get("gameType") ?? "")
    bounce(`/joueur/vip/partie?players=${playersParam}${jeu && jeu !== "ludo" ? `&jeu=${encodeURIComponent(jeu)}` : ""}`, error)
  }
}

export async function creerPartie(formData: FormData) {
  const user = await requireJoueur()
  try {
    const code = await createRoom(user, {
      level: String(formData.get("level") ?? "gratuit"),
      players: Number(formData.get("players") ?? 1),
      stake: Number(formData.get("stake") ?? 20),
      invites: String(formData.get("invites") ?? "").split(","),
      fillAi: formData.get("fillAi") === "oui",
    })
    redirect(partiePath(code))
  } catch (error) {
    bounce("/joueur", error)
  }
}

export async function rejoindre(formData: FormData) {
  const user = await requireJoueur()
  const code = String(formData.get("code") ?? "")
  try {
    const joined = await joinRoom(user, code)
    redirect(partiePath(joined))
  } catch (error) {
    bounce("/joueur", error)
  }
}

export async function lancer(formData: FormData) {
  const user = await requireJoueur()
  const code = String(formData.get("code") ?? "")
  try {
    await startRoom(user, code)
  } catch (error) {
    bounce(partiePath(code), error)
  }
  redirect(partiePath(code))
}

export async function ajouterOrdinateur(formData: FormData) {
  const user = await requireJoueur()
  const code = String(formData.get("code") ?? "")
  try {
    await addAi(user, code)
  } catch (error) {
    bounce(partiePath(code), error)
  }
  redirect(partiePath(code))
}

export async function annuler(formData: FormData) {
  const user = await requireJoueur()
  const code = String(formData.get("code") ?? "")
  try {
    await cancelRoom(user, code)
  } catch (error) {
    bounce(partiePath(code), error)
  }
  redirect("/joueur")
}

export async function convertir(formData: FormData) {
  const user = await requireUser()
  try {
    await convertPoky(user, Number(formData.get("lions") ?? 0))
  } catch (error) {
    bounce("/joueur/portefeuille", error)
  }
  redirect("/joueur/portefeuille")
}

export async function acheter(formData: FormData) {
  const user = await requireUser()
  try {
    await buyLions(user, Number(formData.get("lions") ?? 0))
  } catch (error) {
    bounce("/joueur/portefeuille", error)
  }
  redirect("/joueur/portefeuille")
}

export async function convertirEnPoky(formData: FormData) {
  const user = await requireUser()
  try {
    await convertLionToPoky(user, Number(formData.get("lions") ?? 0))
  } catch (error) {
    bounce("/joueur/portefeuille", error)
  }
  redirect("/joueur/portefeuille")
}

export async function retirer(formData: FormData) {
  const user = await requireUser()
  try {
    await cashoutLions(user, Number(formData.get("lions") ?? 0))
  } catch (error) {
    bounce("/joueur/portefeuille", error)
  }
  redirect("/joueur/portefeuille")
}

export async function defier(formData: FormData) {
  const user = await requireJoueur()
  try {
    await createChallenge(user, String(formData.get("pseudo") ?? ""), Number(formData.get("stake") ?? 0), String(formData.get("gameType") ?? "ludo"))
  } catch (error) {
    bounce("/joueur/vip", error)
  }
  redirect("/joueur/vip")
}

export async function repondreDefi(formData: FormData) {
  const user = await requireJoueur()
  const id = String(formData.get("id") ?? "")
  const accept = formData.get("accept") === "oui"
  try {
    const code = await answerChallenge(user, id, accept)
    if (code) redirect(partiePath(code))
  } catch (error) {
    bounce("/joueur/vip", error)
  }
  redirect("/joueur/vip")
}

/** Ouvre une table d'échecs, de dames ou d'awalé avec la même mise que le Ludo. */
export async function ouvrirJeu(formData: FormData) {
  const user = await requireJoueur()
  const gameType = String(formData.get("gameType") ?? "")
  const level = String(formData.get("level") ?? "gratuit")
  const players = Number(formData.get("players") ?? 1)
  try {
    const code = await createRoom(user, {
      level,
      players,
      stake: Number(formData.get("stake") ?? FREE_STAKE_POKY),
      invites: String(formData.get("invites") ?? "").split(","),
      fillAi: players === 1 || formData.get("fillAi") === "oui",
      gameType,
    })
    redirect(partiePath(code))
  } catch (error) {
    bounce(`/joueur/jeux/${encodeURIComponent(gameType)}?offre=${encodeURIComponent(`${level}-${players}`)}`, error)
  }
}
