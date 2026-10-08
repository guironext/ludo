"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { useLayoutEffect, useState } from "react"
import { useFormStatus } from "react-dom"
import { CASHOUT_MIN_LION, FCFA_PER_LION, POKY_PER_LION, SIGNUP_POKY, WELCOME_REPAY_FCFA, WELCOME_REPAY_LION, eurFromLion, fcfaFromLion } from "@/lib/rules"

export type WalletMove = {
  id: string
  amount: number
  currency: string
  reason: string
  createdAt: string
}

type ConvertAction = (formData: FormData) => void | Promise<void>

export function WalletView({
  lion,
  poky,
  pokyBonus,
  welcomeBonusRepaid,
  erreur,
  moves,
  action,
  buyAction,
  pokyAction,
  cashoutAction,
}: {
  lion: number
  poky: number
  pokyBonus: number
  welcomeBonusRepaid: boolean
  erreur?: string
  moves: WalletMove[]
  action: ConvertAction
  buyAction: ConvertAction
  pokyAction: ConvertAction
  cashoutAction: ConvertAction
}) {
  const motionOff = useReducedMotion() === true
  const convertible = Math.max(0, poky - pokyBonus)
  const progress = Math.min(100, (lion / CASHOUT_MIN_LION) * 100)
  const ready = lion >= CASHOUT_MIN_LION

  return (
    <div className="wallet-page">
      <div className="wallet-rise">
        <Link href="/joueur" className="wallet-back">
          Salons
        </Link>
      </div>

      <section className="wallet-card wallet-rise" aria-label="Solde">
        <div className="wallet-card-top">
          <p className="kicker">Portefeuille</p>
          <span className="wallet-chip" aria-hidden="true" />
        </div>
        <p className="wallet-lion">
          <Count value={lion} />
          <small>Lion</small>
        </p>
        <p className="wallet-worth">
          environ {formatAmount(fcfaFromLion(lion))} FCFA · {formatEur(eurFromLion(lion))} €
        </p>
        <dl className="wallet-stats">
          <div>
            <dt>Poky</dt>
            <dd>
              <Count value={poky} />
            </dd>
          </div>
          <div>
            <dt>Bonus</dt>
            <dd>
              <Count value={pokyBonus} />
            </dd>
          </div>
          <div>
            <dt>À convertir</dt>
            <dd>
              <Count value={convertible} />
            </dd>
          </div>
        </dl>
      </section>

      {erreur ? (
        <p className="error wallet-rise" role="alert">
          {erreur}
        </p>
      ) : null}

      <div className="vip-dock wallet-rise">
        <Link href="/joueur/vip" className="vip-cta">
          <span>
            <strong>Passez au salon VIP</strong>
            <small>Tables Lion, ordinateur, défis entre joueurs dès 100 Lion.</small>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>

      <div className="wallet-split">
        <form action={action} className="wallet-panel wallet-rise">
          <div>
            <h2>En Lion</h2>
            <p>
              {POKY_PER_LION} poky gagnés deviennent 1 Lion. Le bonus de bienvenue reste pour les parties gratuites.
            </p>
          </div>
          <ConvertFields convertible={convertible} motionOff={motionOff} />
        </form>

        <form action={cashoutAction} className="wallet-panel wallet-cashout wallet-rise" aria-labelledby="retrait-title">
          <span className="wallet-badge">{ready ? "Seuil atteint" : "Bientôt"}</span>
          <div>
            <h2 id="retrait-title">Retrait</h2>
            <p>
              Le solde Lion quitte le portefeuille dès confirmation. Le virement carte / mobile money n&apos;est pas
              encore branché : aucune somme ne part vers un compte bancaire.
            </p>
          </div>
          <div
            className="wallet-meter"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={CASHOUT_MIN_LION}
            aria-valuenow={Math.min(lion, CASHOUT_MIN_LION)}
            aria-label="Progression vers le retrait"
          >
            <span style={{ width: `${progress}%`, minWidth: progress > 0 ? 12 : 0 }} />
          </div>
          <p className="wallet-meter-label">
            {formatAmount(lion)} sur {formatAmount(CASHOUT_MIN_LION)} Lion
          </p>
          <ul className="wallet-facts">
            <li>
              <span>Seuil</span>
              <strong>{formatAmount(CASHOUT_MIN_LION)} Lion</strong>
            </li>
            <li>
              <span>Francs CFA</span>
              <strong>{formatAmount(fcfaFromLion(CASHOUT_MIN_LION))} FCFA</strong>
            </li>
            <li>
              <span>Euros</span>
              <strong>{formatEur(eurFromLion(CASHOUT_MIN_LION))} €</strong>
            </li>
            <li>
              <span>Bonus</span>
              <strong>{welcomeBonusRepaid ? "Déjà remboursé" : "Dû au 1er retrait"}</strong>
            </li>
          </ul>
          {!welcomeBonusRepaid ? (
            <p className="wallet-repay" role="note">
              Premier retrait : {formatAmount(WELCOME_REPAY_LION)} Lion ({formatAmount(WELCOME_REPAY_FCFA)} FCFA) seront
              déduits pour rembourser le bonus de {formatAmount(SIGNUP_POKY)} poky. Si le montant est inférieur, le
              retrait est refusé (pas de report partiel).
            </p>
          ) : (
            <p className="wallet-repay is-done" role="note">
              Le bonus de bienvenue a déjà été remboursé sur un retrait précédent.
            </p>
          )}
          <CashoutFields
            lion={lion}
            ready={ready}
            welcomeBonusRepaid={welcomeBonusRepaid}
            motionOff={motionOff}
          />
        </form>
      </div>

      <div className="wallet-split">
        <form action={buyAction} className="wallet-panel wallet-buy wallet-rise">
          <div>
            <h2>Acheter des Lion</h2>
            <p>
              1 Lion coûte {formatAmount(FCFA_PER_LION)} FCFA, soit {formatEur(eurFromLion(1))} €.
            </p>
          </div>
          <BuyFields motionOff={motionOff} />
        </form>

        <form action={pokyAction} className="wallet-panel wallet-rise">
          <div>
            <h2>En poky</h2>
            <p>1 Lion redevient {POKY_PER_LION} poky.</p>
          </div>
          <LionFields lion={lion} motionOff={motionOff} />
        </form>
      </div>

      <section className="wallet-history" aria-labelledby="mouvements-title">
        <div className="wallet-head wallet-rise">
          <h2 id="mouvements-title">Mouvements</h2>
          <span>{moves.length === 0 ? "Aucun" : `${moves.length} récents`}</span>
        </div>
        <ul className="wallet-moves">
          {moves.length === 0 ? (
            <li className="wallet-empty">Tes achats, tes parties et tes conversions apparaîtront ici.</li>
          ) : (
            moves.map((move, index) => {
              const up = move.amount > 0
              const sign = move.amount > 0 ? "+" : move.amount < 0 ? "−" : ""
              return (
                <li key={move.id} style={{ ["--i" as string]: index }}>
                  <span className={`wallet-mark ${up ? "up" : "down"}`} aria-hidden="true">
                    {up ? "+" : "−"}
                  </span>
                  <span className="wallet-move">
                    <strong>{labelReason(move.reason)}</strong>
                    <time dateTime={move.createdAt}>{formatWhen(move.createdAt)}</time>
                  </span>
                  <span className={`wallet-amt ${up ? "up" : "down"}`}>
                    {sign}
                    {formatAmount(Math.abs(move.amount))}
                    <small>{moneyName(move.currency)}</small>
                  </span>
                </li>
              )
            })
          )}
        </ul>
      </section>
    </div>
  )
}


function CashoutFields({
  lion,
  ready,
  welcomeBonusRepaid,
  motionOff,
}: {
  lion: number
  ready: boolean
  welcomeBonusRepaid: boolean
  motionOff: boolean
}) {
  const repay = welcomeBonusRepaid ? 0 : WELCOME_REPAY_LION
  const minNeeded = Math.max(CASHOUT_MIN_LION, repay)
  const defaultAmount = ready ? Math.max(minNeeded, Math.min(lion, CASHOUT_MIN_LION)) : CASHOUT_MIN_LION
  const [raw, setRaw] = useState(String(defaultAmount))
  const count = positive(raw)
  const short = lion < minNeeded
  const over = !short && count > lion
  const below = count > 0 && count < minNeeded
  const net = Math.max(0, count - repay)
  const canSubmit = ready && !short && count >= minNeeded && count <= lion

  let hint = `Tu retires ${formatAmount(count)} Lion.`
  if (repay > 0 && count >= repay) {
    hint = `Retrait de ${formatAmount(count)} Lion : ${formatAmount(repay)} Lion remboursent le bonus, il reste ${formatAmount(net)} Lion nets (${formatAmount(fcfaFromLion(net))} FCFA).`
  } else if (repay > 0 && count > 0 && count < repay) {
    hint = `Il faut au moins ${formatAmount(repay)} Lion pour rembourser le bonus de bienvenue.`
  }
  if (short) hint = `Il faut au moins ${formatAmount(minNeeded)} Lion pour un premier retrait.`
  else if (!count) hint = "Indique un montant en Lion."
  else if (below) hint = `Minimum ${formatAmount(minNeeded)} Lion.`
  else if (over) hint = `Tu as ${formatAmount(lion)} Lion.`

  return (
    <>
      <Stepper raw={raw} count={count} cap={lion} blocked={short || !ready} motionOff={motionOff} onRaw={setRaw} />
      <div className="wallet-costline">
        <p aria-live="polite">{hint}</p>
        <button
          type="button"
          className="ghost wallet-max"
          disabled={short || !ready || count === lion}
          onClick={() => setRaw(String(Math.max(minNeeded, lion)))}
        >
          Maximum
        </button>
      </div>
      <Submit
        disabled={!canSubmit}
        motionOff={motionOff}
        label="Confirmer le retrait"
        pendingLabel="Retrait…"
      />
    </>
  )
}

function ConvertFields({ convertible, motionOff }: { convertible: number; motionOff: boolean }) {
  const max = Math.floor(convertible / POKY_PER_LION)
  const [raw, setRaw] = useState("1")
  const parsed = Math.floor(Number(raw))
  const count = Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  const short = max < 1
  const over = !short && count > max
  const cost = count * POKY_PER_LION
  const left = Math.max(0, convertible - cost)
  const canSubmit = !short && count >= 1 && count <= max

  function setCount(next: number) {
    const cap = Math.max(1, max)
    const clamped = Math.min(cap, Math.max(1, Math.floor(next) || 1))
    setRaw(String(clamped))
  }

  let hint = `Cette conversion coûte ${formatAmount(cost)} poky. Il en restera ${formatAmount(left)}.`
  if (short) hint = "Pas encore assez de poky gagnés."
  else if (!count) hint = "Indique au moins 1 Lion."
  else if (over) hint = `Tu peux convertir au plus ${formatAmount(max)} Lion.`

  return (
    <>
      <div className="wallet-stepper">
        <motion.button
          type="button"
          aria-label="Diminuer"
          disabled={!count || count <= 1}
          whileTap={motionOff || !count || count <= 1 ? undefined : { scale: 0.94 }}
          onClick={() => setCount(count - 1)}
        >
          −
        </motion.button>
        <label>
          <span className="sr-only">Nombre de Lion</span>
          <input
            name="lions"
            autoComplete="off"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={raw}
            onChange={(event) => setRaw(event.target.value.replace(/[^\d]/g, ""))}
            onBlur={() => {
              if (raw !== "") setCount(Number(raw))
            }}
          />
        </label>
        <motion.button
          type="button"
          aria-label="Augmenter"
          disabled={short || count >= max}
          whileTap={motionOff || short || count >= max ? undefined : { scale: 0.94 }}
          onClick={() => setCount((count || 0) + 1)}
        >
          +
        </motion.button>
      </div>
      <div className="wallet-costline">
        <p aria-live="polite">{hint}</p>
        <button type="button" className="ghost wallet-max" disabled={short || count === max} onClick={() => setCount(max)}>
          Maximum
        </button>
      </div>
      <Submit disabled={!canSubmit} motionOff={motionOff} label="Convertir" pendingLabel="Conversion…" />
    </>
  )
}

function BuyFields({ motionOff }: { motionOff: boolean }) {
  const [raw, setRaw] = useState("1")
  const count = positive(raw)
  const fcfa = fcfaFromLion(count)
  const eur = eurFromLion(count)

  return (
    <>
      <Stepper raw={raw} count={count} cap={null} blocked={false} motionOff={motionOff} onRaw={setRaw} />
      <p className="wallet-quote" aria-live="polite">
        <strong>{formatAmount(fcfa)} FCFA</strong>
        <span>{formatEur(eur)} €</span>
      </p>
      <Submit disabled={count < 1} motionOff={motionOff} label="Acheter" pendingLabel="Achat…" />
    </>
  )
}

function LionFields({ lion, motionOff }: { lion: number; motionOff: boolean }) {
  const [raw, setRaw] = useState("1")
  const count = positive(raw)
  const short = lion < 1
  const over = !short && count > lion
  const gain = count * POKY_PER_LION
  const canSubmit = !short && count >= 1 && count <= lion
  const verb = count > 1 ? "deviennent" : "devient"
  let hint = `${formatAmount(count)} Lion ${verb} ${formatAmount(gain)} poky.`
  if (short) hint = "Pas encore de Lion à convertir."
  else if (!count) hint = "Indique au moins 1 Lion."
  else if (over) hint = `Tu as ${formatAmount(lion)} Lion.`

  return (
    <>
      <Stepper raw={raw} count={count} cap={lion} blocked={short} motionOff={motionOff} onRaw={setRaw} />
      <div className="wallet-costline">
        <p aria-live="polite">{hint}</p>
        <button type="button" className="ghost wallet-max" disabled={short || count === lion} onClick={() => setRaw(String(Math.max(1, lion)))}>
          Maximum
        </button>
      </div>
      <Submit disabled={!canSubmit} motionOff={motionOff} label="Convertir" pendingLabel="Conversion…" />
    </>
  )
}

function Stepper({
  raw,
  count,
  cap,
  blocked,
  motionOff,
  onRaw,
}: {
  raw: string
  count: number
  cap: number | null
  blocked: boolean
  motionOff: boolean
  onRaw: (value: string) => void
}) {
  const ceiling = cap == null ? null : Math.max(0, cap)

  function setCount(next: number) {
    const floored = Math.max(1, Math.floor(next) || 1)
    const clamped = ceiling == null ? floored : Math.min(Math.max(1, ceiling), floored)
    onRaw(String(clamped))
  }

  return (
    <div className="wallet-stepper">
      <motion.button
        type="button"
        aria-label="Diminuer"
        disabled={!count || count <= 1}
        whileTap={motionOff || !count || count <= 1 ? undefined : { scale: 0.94 }}
        onClick={() => setCount(count - 1)}
      >
        −
      </motion.button>
      <label>
        <span className="sr-only">Nombre de Lion</span>
        <input
          name="lions"
          autoComplete="off"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={raw}
          onChange={(event) => onRaw(event.target.value.replace(/[^\d]/g, ""))}
          onBlur={() => {
            if (raw !== "") setCount(Number(raw))
          }}
        />
      </label>
      <motion.button
        type="button"
        aria-label="Augmenter"
        disabled={blocked || (ceiling != null && count >= ceiling)}
        whileTap={motionOff || blocked || (ceiling != null && count >= ceiling) ? undefined : { scale: 0.94 }}
        onClick={() => setCount((count || 0) + 1)}
      >
        +
      </motion.button>
    </div>
  )
}

function positive(raw: string) {
  const parsed = Math.floor(Number(raw))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function Submit({
  disabled,
  motionOff,
  label,
  pendingLabel,
}: {
  disabled: boolean
  motionOff: boolean
  label: string
  pendingLabel: string
}) {
  const { pending } = useFormStatus()
  return (
    <motion.button
      type="submit"
      className="wallet-submit"
      disabled={disabled || pending}
      whileTap={motionOff || disabled || pending ? undefined : { scale: 0.98 }}
    >
      {pending ? pendingLabel : label}
    </motion.button>
  )
}

function Count({ value }: { value: number }) {
  const motionOff = useReducedMotion() === true
  const [shown, setShown] = useState(value)

  useLayoutEffect(() => {
    if (motionOff) {
      setShown(value)
      return
    }
    setShown(0)
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 880)
      const eased = 1 - (1 - t) ** 3
      setShown(Math.round(value * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, motionOff])

  return <>{formatAmount(shown)}</>
}

function formatAmount(value: number) {
  return stableNumber(value, 0, 2)
}

function formatEur(value: number) {
  return stableNumber(value, 2, 2)
}

function stableNumber(value: number, minimumFractionDigits: number, maximumFractionDigits: number) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits, maximumFractionDigits })
    .format(value)
    .replace(/[\u202f\u00a0]/g, " ")
}

function moneyName(currency: string) {
  if (currency === "lion") return "Lion"
  if (currency === "poky") return "poky"
  return currency
}

function labelReason(reason: string) {
  const text = reason.trim()
  if (!text) return "Mouvement"
  return text.charAt(0).toLocaleUpperCase("fr-FR") + text.slice(1)
}

function formatWhen(iso: string) {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ""
  return `${part("day")} ${part("month")} ${part("hour")}:${part("minute")}`
}
