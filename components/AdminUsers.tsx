"use client"

import { ajouterUtilisateur, modifierUtilisateur, supprimerUtilisateur } from "@/app/actions/admin-users"
import { HOUSE_PSEUDO, ROLE_JOUEUR, ROLE_MAISON, ROLE_MANAGER, SIGNUP_POKY } from "@/lib/rules"
import { animate, AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"

const ease = [0.22, 1, 0.36, 1] as const

const tabs = [
  { id: "utilisateurs", label: "Liste des utilisateurs", short: "Comptes" },
  { id: "gains", label: "Gain d'entreprise", short: "Gains" },
  { id: "salons", label: "Utilisateurs par salons", short: "Salons" },
] as const

type TabId = (typeof tabs)[number]["id"]

export type AdminGain = {
  poky: number
  lion: number
  fcfa: number
  eur: number
}

export type AdminUser = {
  id: string
  pseudo: string
  email: string
  role: string
  poky: number
  lion: number
  welcomeBonusRepaid: boolean
  online: boolean
  gain: AdminGain
}

export type AdminGroup = {
  role: string
  label: string
  users: AdminUser[]
}

export type AdminEarnings = {
  poky: number
  lion: number
  fcfa: number
  eur: number
  rate: string
}

export type AdminSalonUser = {
  id: string
  pseudo: string
  email: string
  poky: number
  lion: number
  games: number
  gain: AdminGain
}

export type AdminSalon = {
  id: string
  label: string
  stake: string
  users: AdminSalonUser[]
}

function initials(pseudo: string) {
  const parts = pseudo.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
  return pseudo.slice(0, 2).toUpperCase()
}

function amount(value: number, digits: number) {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
}

function tabIndex(id: TabId) {
  return tabs.findIndex((item) => item.id === id)
}

export function AdminUsers({
  groups,
  meId,
  earnings,
  salons,
}: {
  groups: AdminGroup[]
  meId: string
  earnings: AdminEarnings
  salons: AdminSalon[]
}) {
  const motionOff = useReducedMotion() === true
  const router = useRouter()
  const [[tab, direction], setTab] = useState<[TabId, number]>(["utilisateurs", 0])
  const [editor, setEditor] = useState<UserEditor | null>(null)
  const [payout, setPayout] = useState<PayoutStep>(null)
  const skipScroll = useRef(true)
  const onlineUsers = groups.flatMap((group) =>
    group.users
      .filter((user) => user.online)
      .map((user) => ({
        ...user,
        roleLabel: group.label === "Joueurs" ? "Joueur" : group.label,
      })),
  )

  useEffect(() => {
    if (skipScroll.current) {
      skipScroll.current = false
      return
    }
    document.getElementById(`admin-panel-${tab}`)?.scrollIntoView({
      block: "start",
      behavior: motionOff ? "auto" : "smooth",
    })
  }, [tab, motionOff])

  const variants = useMemo(() => {
    const still = { duration: 0 }
    return {
      stage: {
        hidden: {},
        show: {
          transition: motionOff ? still : { staggerChildren: 0.07, delayChildren: 0.02 },
        },
      },
      rise: {
        hidden: { opacity: motionOff ? 1 : 0, y: motionOff ? 0 : 16 },
        show: {
          opacity: 1,
          y: 0,
          transition: motionOff ? still : { duration: 0.48, ease },
        },
      },
      stats: {
        hidden: {},
        show: {
          transition: motionOff ? still : { staggerChildren: 0.06, delayChildren: 0.04 },
        },
      },
      chip: {
        hidden: { opacity: motionOff ? 1 : 0, y: motionOff ? 0 : 14, scale: motionOff ? 1 : 0.94 },
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: motionOff ? still : { type: "spring" as const, stiffness: 380, damping: 24 },
        },
      },
      board: {
        hidden: {},
        show: {
          transition: motionOff ? still : { staggerChildren: 0.08, delayChildren: 0.05 },
        },
      },
      group: {
        hidden: { opacity: motionOff ? 1 : 0, y: motionOff ? 0 : 20 },
        show: {
          opacity: 1,
          y: 0,
          transition: motionOff ? still : { duration: 0.42, ease },
        },
      },
      panel: {
        hidden: (shift: number) => ({
          opacity: motionOff ? 1 : 0,
          x: motionOff ? 0 : shift * 36,
        }),
        show: {
          opacity: 1,
          x: 0,
          transition: motionOff
            ? still
            : { duration: 0.38, ease, staggerChildren: 0.07, delayChildren: 0.05 },
        },
        exit: (shift: number) => ({
          opacity: motionOff ? 1 : 0,
          x: motionOff ? 0 : shift * -28,
          transition: motionOff ? still : { duration: 0.18, ease },
        }),
      },
    }
  }, [motionOff])

  function openTab(id: TabId) {
    if (id === tab) return
    setTab([id, tabIndex(id) > tabIndex(tab) ? 1 : -1])
  }

  return (
    <motion.div className="page admin-page" initial="hidden" animate="show" variants={variants.stage}>
      <motion.header className="admin-hero admin-hero-intro" variants={variants.rise}>
        <p className="kicker">Administration</p>
      </motion.header>

      <motion.div className="admin-tabs" role="tablist" aria-label="Sections d'administration" variants={variants.rise}>
        {tabs.map((item) => {
          const selected = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`admin-tab-${item.id}`}
              className={`admin-tab${selected ? " is-active" : ""}`}
              aria-selected={selected}
              aria-controls={`admin-panel-${item.id}`}
              onClick={() => openTab(item.id)}
            >
              {selected && !motionOff ? (
                <motion.span
                  className="admin-tab-glow"
                  layoutId="admin-tab"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              {selected && motionOff ? <span className="admin-tab-glow" /> : null}
              <span className="admin-tab-label">
                <span className="admin-tab-short">{item.short}</span>
                <span className="admin-tab-long">{item.label}</span>
              </span>
            </button>
          )
        })}
      </motion.div>

      <AnimatePresence mode="wait" custom={direction}>
        {tab === "utilisateurs" ? (
          <motion.div
            key="utilisateurs"
            id="admin-panel-utilisateurs"
            role="tabpanel"
            aria-labelledby="admin-tab-utilisateurs"
            className="admin-panel"
            custom={direction}
            variants={variants.panel}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <div className="admin-toolbar">
              <header className="admin-hero">
                <h1>Liste des utilisateurs</h1>
                <p className="admin-lead">Qui est connecté en ce moment, puis tous les comptes.</p>
              </header>
              <button type="button" className="admin-add" onClick={() => setEditor({ kind: "create" })}>
                Ajouter un utilisateur
              </button>
            </div>
            <section className="admin-online" aria-labelledby="connectes-title">
              <h2 id="connectes-title" className="admin-sr">
                Utilisateurs connectés
              </h2>
              <motion.div className="admin-stats" aria-label="Utilisateurs connectés" variants={variants.stats}>
                <motion.div className="admin-stat admin-stat-online" variants={variants.chip}>
                  <strong>
                    <CountUp value={onlineUsers.length} digits={0} />
                  </strong>
                  <span>Connectés</span>
                </motion.div>
                {groups.map((group) => (
                  <motion.div key={group.role} className={`admin-stat admin-stat-${group.role}`} variants={variants.chip}>
                    <strong>
                      <CountUp value={group.users.filter((user) => user.online).length} digits={0} />
                    </strong>
                    <span>{group.label}</span>
                  </motion.div>
                ))}
              </motion.div>
              {onlineUsers.length === 0 ? (
                <p className="manager-empty">Personne n&apos;est connecté.</p>
              ) : (
                <ul className="admin-online-users">
                  {onlineUsers.map((user) => (
                    <li key={user.id}>
                      <span className="admin-avatar" aria-hidden="true">
                        {initials(user.pseudo)}
                        <span className="admin-dot" />
                      </span>
                      <span>
                        <strong>
                          {user.pseudo}
                          {user.id === meId ? <em>vous</em> : null}
                        </strong>
                        <span className={`role role-${user.role}`}>{user.roleLabel}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <div className="admin-table-wrap" id="utilisateurs">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Utilisateur</th>
                    <th scope="col">Rôle</th>
                    <th scope="col" className="num">Poky</th>
                    <th scope="col" className="num">Lion</th>
                    <th scope="col">Bonus</th>
                    <th scope="col" className="num">Gains poky</th>
                    <th scope="col" className="num">Gains Lion</th>
                    <th scope="col" className="num">FCFA</th>
                    <th scope="col" className="num">Euro</th>
                    <th scope="col">
                      <span className="admin-sr">Actions</span>
                    </th>
                  </tr>
                </thead>
                {groups.map((group) => (
                  <tbody key={group.role} id={`role-${group.role}`}>
                    {group.users.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="admin-table-empty">
                          Aucun {group.label.toLocaleLowerCase("fr-FR")}
                        </td>
                      </tr>
                    ) : (
                      group.users.map((user) => (
                        <UserRow
                          key={user.id}
                          user={user}
                          roleLabel={group.label === "Joueurs" ? "Joueur" : group.label}
                          meId={meId}
                          motionOff={motionOff}
                          onEdit={() => setEditor({ kind: "edit", user })}
                          onDelete={() => setEditor({ kind: "delete", user })}
                        />
                      ))
                    )}
                  </tbody>
                ))}
              </table>
            </div>
          </motion.div>
        ) : null}

        {tab === "gains" ? (
          <motion.div
            key="gains"
            id="admin-panel-gains"
            role="tabpanel"
            aria-labelledby="admin-tab-gains"
            className="admin-panel"
            custom={direction}
            variants={variants.panel}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <header className="admin-hero">
              <h1>Gain d&apos;entreprise</h1>
              <p className="admin-lead">Le gain net de la maison, en poky, Lion, FCFA et euro.</p>
            </header>
            <motion.div className="admin-gains" variants={variants.stats}>
              <motion.article className="admin-gain" variants={variants.chip}>
                <strong>
                  <CountUp value={earnings.poky} digits={0} />
                </strong>
                <span>Poky</span>
              </motion.article>
              <motion.article className="admin-gain admin-gain-lion" variants={variants.chip}>
                <strong>
                  <CountUp value={earnings.lion} digits={0} />
                </strong>
                <span>Lion</span>
              </motion.article>
              <motion.article className="admin-gain" variants={variants.chip}>
                <strong>
                  <CountUp value={earnings.fcfa} digits={2} />
                </strong>
                <span>FCFA</span>
              </motion.article>
              <motion.article className="admin-gain admin-gain-eur" variants={variants.chip}>
                <strong>
                  <CountUp value={earnings.eur} digits={6} />
                </strong>
                <span>Euro</span>
              </motion.article>
            </motion.div>
            <motion.p className="admin-rate" variants={variants.rise}>
              {earnings.rate}
            </motion.p>
            <motion.button
              type="button"
              className="admin-payout"
              variants={variants.rise}
              onClick={() => setPayout("choose")}
            >
              Virer sur le compte WAVE, ORANGE MONEY ou MOOV MONEY
            </motion.button>
          </motion.div>
        ) : null}

        {tab === "salons" ? (
          <motion.div
            key="salons"
            id="admin-panel-salons"
            role="tabpanel"
            aria-labelledby="admin-tab-salons"
            className="admin-panel"
            custom={direction}
            variants={variants.panel}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <header className="admin-hero">
              <h1>Utilisateurs par salons</h1>
              <p className="admin-lead">Les joueurs qui ont pris place dans chaque salon.</p>
            </header>
            <motion.div className="admin-salons" variants={variants.board}>
              {salons.map((salon) => (
                <motion.section
                  key={salon.id}
                  className={`manager-group admin-salon admin-salon-${salon.id}`}
                  variants={variants.group}
                >
                  <h2>
                    <span className="admin-salon-name">{salon.label}</span>
                    <span className="admin-salon-aside">
                      {salon.stake ? <span className="admin-salon-stake">{salon.stake}</span> : null}
                      <span className="admin-count">{salon.users.length}</span>
                    </span>
                  </h2>
                  {salon.users.length === 0 ? (
                    <p className="manager-empty">Aucun joueur</p>
                  ) : (
                    <div className="admin-table-wrap">
                      <table className="admin-table admin-table-salon">
                        <thead>
                          <tr>
                            <th scope="col">Joueur</th>
                            <th scope="col" className="num">Parties</th>
                            <th scope="col" className="num">Poky</th>
                            <th scope="col" className="num">Lion</th>
                            <th scope="col" className="num">Gains poky</th>
                            <th scope="col" className="num">Gains Lion</th>
                            <th scope="col" className="num">FCFA</th>
                            <th scope="col" className="num">Euro</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salon.users.map((user) => (
                            <motion.tr
                              key={user.id}
                              initial={motionOff ? false : { opacity: 0 }}
                              whileInView={{ opacity: 1 }}
                              viewport={{ once: true, amount: 0.4 }}
                              transition={motionOff ? { duration: 0 } : { duration: 0.32, ease }}
                            >
                              <td>
                                <PersonCell pseudo={user.pseudo} email={user.email} />
                              </td>
                              <td className="num">{user.games.toLocaleString("fr-FR")}</td>
                              <Money value={user.poky} />
                              <Money value={user.lion} lion />
                              <Money value={user.gain.poky} signed />
                              <Money value={user.gain.lion} lion signed />
                              <Money value={user.gain.fcfa} digits={2} signed />
                              <Money value={user.gain.eur} digits={6} signed />
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </motion.section>
              ))}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <PayoutDialog
        step={payout}
        fcfa={earnings.fcfa}
        motionOff={motionOff}
        onClose={() => setPayout(null)}
        onChoose={setPayout}
      />
      <UserDialog
        editor={editor}
        meId={meId}
        motionOff={motionOff}
        onClose={() => setEditor(null)}
        onDone={() => {
          setEditor(null)
          router.refresh()
        }}
      />
    </motion.div>
  )
}

function CountUp({ value, digits }: { value: number; digits: number }) {
  const motionOff = useReducedMotion() === true
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (motionOff) {
      node.textContent = amount(value, digits)
      return
    }
    const controls = animate(0, value, {
      duration: 0.85,
      ease,
      onUpdate: (latest) => {
        node.textContent = amount(latest, digits)
      },
    })
    return () => controls.stop()
  }, [value, digits, motionOff])

  return <span ref={ref}>{amount(motionOff ? value : 0, digits)}</span>
}

function PersonCell({
  pseudo,
  email,
  you = false,
  online = false,
}: {
  pseudo: string
  email: string
  you?: boolean
  online?: boolean
}) {
  return (
    <span className="admin-person">
      <span className="admin-avatar" aria-hidden="true">
        {initials(pseudo)}
        {online ? <span className="admin-dot" /> : null}
      </span>
      <span className="admin-user">
        <strong>
          {pseudo}
          {you ? <em>vous</em> : null}
        </strong>
        <span className="admin-email">{email}</span>
      </span>
    </span>
  )
}

function Money({
  value,
  digits = 0,
  lion = false,
  signed = false,
}: {
  value: number
  digits?: number
  lion?: boolean
  signed?: boolean
}) {
  const down = signed && value < 0
  return <td className={`num${lion && !down ? " num-lion" : ""}${down ? " is-down" : ""}`}>{amount(value, digits)}</td>
}

function isHouse(user: AdminUser) {
  return user.role === ROLE_MAISON || user.pseudo === HOUSE_PSEUDO
}

function UserRow({
  user,
  roleLabel,
  meId,
  motionOff,
  onEdit,
  onDelete,
}: {
  user: AdminUser
  roleLabel: string
  meId: string
  motionOff: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const locked = user.id === meId || isHouse(user)
  return (
    <motion.tr
      initial={motionOff ? false : { opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={motionOff ? { duration: 0 } : { duration: 0.32, ease }}
    >
      <td>
        <PersonCell pseudo={user.pseudo} email={user.email} you={user.id === meId} online={user.online} />
      </td>
      <td>
        <span className={`role role-${user.role}`}>{roleLabel}</span>
      </td>
      <Money value={user.poky} />
      <Money value={user.lion} lion />
      <td>
        <span className={`admin-bonus ${user.welcomeBonusRepaid ? "is-done" : "is-due"}`}>
          {user.welcomeBonusRepaid ? "Remboursé" : "Dû au 1er retrait"}
        </span>
      </td>
      <Money value={user.gain.poky} signed />
      <Money value={user.gain.lion} lion signed />
      <Money value={user.gain.fcfa} digits={2} signed />
      <Money value={user.gain.eur} digits={6} signed />
      <td>
        <div className="admin-user-actions">
          <button type="button" className="admin-icon" aria-label={`Modifier ${user.pseudo}`} onClick={onEdit}>
            <PenIcon />
          </button>
          <button
            type="button"
            className="admin-icon admin-icon-danger"
            aria-label={locked ? `Suppression indisponible pour ${user.pseudo}` : `Supprimer ${user.pseudo}`}
            title={locked ? (user.id === meId ? "Vous ne pouvez pas supprimer votre compte" : "Le compte maison ne peut pas être supprimé") : "Supprimer"}
            disabled={locked}
            onClick={onDelete}
          >
            <TrashIcon />
          </button>
        </div>
      </td>
    </motion.tr>
  )
}

const wallets = [
  { id: "wave", label: "Wave" },
  { id: "orange", label: "Orange Money" },
  { id: "moov", label: "Moov Money" },
] as const

type PayoutStep = null | "choose" | (typeof wallets)[number]["id"]

function PayoutDialog({
  step,
  fcfa,
  motionOff,
  onClose,
  onChoose,
}: {
  step: PayoutStep
  fcfa: number
  motionOff: boolean
  onClose: () => void
  onChoose: (step: PayoutStep) => void
}) {
  const wallet = wallets.find((item) => item.id === step)

  useEffect(() => {
    if (!step) return
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [step, onClose])

  return (
    <AnimatePresence>
      {step ? (
        <motion.div
          className="admin-dialog-backdrop"
          initial={{ opacity: motionOff ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: motionOff ? 1 : 0 }}
          transition={{ duration: motionOff ? 0 : 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payout-title"
            initial={motionOff ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={motionOff ? undefined : { opacity: 0, y: 16 }}
            transition={motionOff ? { duration: 0 } : { duration: 0.32, ease }}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="payout-title">Virement du gain</h2>
            {wallet ? (
              <>
                <p className="admin-dialog-copy">
                  {fcfa > 0
                    ? `${amount(fcfa, 2)} FCFA seraient envoyés vers ${wallet.label}. Le virement réel n'est pas ouvert dans cette version : rien n'a été envoyé.`
                    : `Il n'y a pas de gain à virer vers ${wallet.label}.`}
                </p>
                <div className="admin-dialog-actions">
                  <button type="button" className="ghost" onClick={() => onChoose("choose")}>
                    Changer
                  </button>
                  <button type="button" onClick={onClose}>
                    Fermer
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="admin-dialog-copy">Choisis le compte qui recevra le gain d&apos;entreprise.</p>
                <div className="admin-wallets">
                  {wallets.map((item) => (
                    <button key={item.id} type="button" className="ghost" onClick={() => onChoose(item.id)}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

type UserEditor = { kind: "create" } | { kind: "edit" | "delete"; user: AdminUser }

function UserDialog({
  editor,
  meId,
  motionOff,
  onClose,
  onDone,
}: {
  editor: UserEditor | null
  meId: string
  motionOff: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!editor) return
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [editor, onClose, pending])

  useEffect(() => {
    setError(null)
    setPending(false)
  }, [editor])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor || pending) return
    setPending(true)
    setError(null)
    const result =
      editor.kind === "delete"
        ? await supprimerUtilisateur(editor.user.id)
        : editor.kind === "edit"
          ? await modifierUtilisateur(new FormData(event.currentTarget))
          : await ajouterUtilisateur(new FormData(event.currentTarget))
    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    onDone()
  }

  const user = editor && editor.kind !== "create" ? editor.user : null
  const house = user ? isHouse(user) : false
  const self = user?.id === meId

  return (
    <AnimatePresence>
      {editor ? (
        <motion.div
          className="admin-dialog-backdrop"
          initial={{ opacity: motionOff ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: motionOff ? 1 : 0 }}
          transition={{ duration: motionOff ? 0 : 0.2 }}
          onClick={() => {
            if (!pending) onClose()
          }}
        >
          <motion.div
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-dialog-title"
            initial={motionOff ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={motionOff ? undefined : { opacity: 0, y: 16 }}
            transition={motionOff ? { duration: 0 } : { duration: 0.32, ease }}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="admin-dialog-title">
              {editor.kind === "create"
                ? "Ajouter un utilisateur"
                : editor.kind === "edit"
                  ? `Modifier ${user?.pseudo}`
                  : `Supprimer ${user?.pseudo}`}
            </h2>
            {editor.kind === "delete" && user ? (
              <form className="form" onSubmit={submit}>
                <p className="admin-dialog-copy">
                  Le compte de {user.pseudo} sera retiré. Ses parties déjà créées restent rattachées à la maison.
                </p>
                {error ? <p className="error">{error}</p> : null}
                <div className="admin-dialog-actions">
                  <button type="button" className="ghost" onClick={onClose} disabled={pending}>
                    Annuler
                  </button>
                  <button type="submit" className="admin-danger" disabled={pending}>
                    {pending ? "Suppression…" : "Supprimer"}
                  </button>
                </div>
              </form>
            ) : (
              <form className="form" onSubmit={submit} key={user?.id ?? "create"}>
                <label>
                  Pseudo
                  <input name="pseudo" defaultValue={user?.pseudo ?? ""} required readOnly={house} autoComplete="off" />
                </label>
                <label>
                  E-mail
                  <input name="email" type="email" defaultValue={user?.email ?? ""} required autoComplete="off" />
                </label>
                <label>
                  Mot de passe
                  <input
                    name="password"
                    type="password"
                    required={editor.kind === "create"}
                    minLength={editor.kind === "create" ? 8 : undefined}
                    autoComplete="new-password"
                    placeholder={editor.kind === "edit" ? "Laisser vide pour ne pas changer" : undefined}
                  />
                </label>
                <label>
                  Rôle
                  <select name="role" defaultValue={user?.role ?? ROLE_JOUEUR} disabled={house || self}>
                    <option value={ROLE_JOUEUR}>Joueur</option>
                    <option value={ROLE_MANAGER}>Admin</option>
                    {house ? <option value={ROLE_MAISON}>Maison</option> : null}
                  </select>
                </label>
                <div className="admin-dialog-amounts">
                  <label>
                    Poky
                    <input name="poky" inputMode="numeric" defaultValue={user?.poky ?? SIGNUP_POKY} required />
                  </label>
                  <label>
                    Lion
                    <input name="lion" inputMode="numeric" defaultValue={user?.lion ?? 0} required />
                  </label>
                </div>
                {user ? <input type="hidden" name="id" value={user.id} /> : null}
                {house ? <input type="hidden" name="role" value={ROLE_MAISON} /> : null}
                {self ? <input type="hidden" name="role" value={user?.role ?? ROLE_MANAGER} /> : null}
                {error ? <p className="error">{error}</p> : null}
                <div className="admin-dialog-actions">
                  <button type="button" className="ghost" onClick={onClose} disabled={pending}>
                    Annuler
                  </button>
                  <button type="submit" disabled={pending}>
                    {pending ? "Enregistrement…" : editor.kind === "create" ? "Ajouter" : "Enregistrer"}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function PenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3zM13.5 6.5l3 3"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M7 7l1 13h8l1-13"
      />
    </svg>
  )
}
