"use client"

import { useState } from "react"
import { creerPartie } from "@/app/actions/game"
import { LEVELS } from "@/lib/rules"
import { SubmitButton } from "./SubmitButton"

export function CreateForm() {
  const [level, setLevel] = useState("gratuit")
  const [players, setPlayers] = useState(1)
  const chosen = LEVELS.find((item) => item.id === level) ?? LEVELS[0]
  const soloOnly = level !== "gratuit" && level !== "vip"

  return (
    <form action={creerPartie} className="card form">
      <h2>Ouvrir une salle</h2>
      <label>
        Niveau
        <select name="level" value={level} onChange={(event) => {
          const next = event.target.value
          setLevel(next)
          if (next !== "gratuit" && next !== "vip" && players < 2) setPlayers(2)
        }}>
          {LEVELS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <p className="hint">{chosen.blurb}</p>
      <label>
        Joueurs
        <select name="players" value={players} onChange={(event) => setPlayers(Number(event.target.value))}>
          {soloOnly ? null : <option value={1}>1 contre l&apos;ordinateur</option>}
          <option value={2}>2 joueurs</option>
          <option value={3}>3 joueurs</option>
          <option value={4}>4 joueurs</option>
        </select>
      </label>
      {chosen.custom ? (
        <label>
          Mise en Lion (minimum 20)
          <input name="stake" type="number" min={20} defaultValue={20} required />
        </label>
      ) : (
        <input type="hidden" name="stake" value={chosen.stake} />
      )}
      {players > 1 ? (
        <>
          <label>
            Inviter des pseudos
            <input name="invites" placeholder="ama, koffi" />
          </label>
          <p className="hint">Sans invitation, toute personne qui a le code peut prendre une place libre.</p>
          <label className="check">
            <input type="checkbox" name="fillAi" value="oui" />
            Compléter les places vides avec l&apos;ordinateur et lancer tout de suite
          </label>
        </>
      ) : null}
      <SubmitButton pendingLabel="Création de la salle…">Créer la salle</SubmitButton>
    </form>
  )
}
