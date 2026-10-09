#!/usr/bin/env node
// Copie toutes les données de l'ancienne base SQLite (prisma/dev.db) vers la base
// Postgres pointée par DIRECT_URL (ou, à défaut, DATABASE_URL), en conservant les id.
//
// Utilisation (voir docs/DEPLOIEMENT-VERCEL.md) :
//   1. npx prisma db push                      (crée les tables vides dans Postgres)
//   2. npm run db:migrate-data -- --dry-run    (lit seulement dev.db, ne touche à rien)
//   3. npm run db:migrate-data                 (copie réelle)
//
// Options :
//   --dry-run        lit dev.db et affiche le nombre de lignes, sans se connecter à Postgres
//   --force          accepte une base cible non vide : ajoute seulement les lignes absentes
//                    (même id ou même pseudo/email déjà présent = ignorée). Ne supprime jamais rien.
//   --sqlite <path>  autre fichier SQLite (par défaut prisma/dev.db)
//
// Sécurité :
//   - dev.db est ouvert en LECTURE SEULE (module node:sqlite intégré à Node >= 22.13).
//   - Tout se fait dans une seule transaction Postgres : en cas d'erreur, rien n'est écrit.
//   - Si la base cible contient déjà des données, le script s'arrête (sauf --force).
//   - Les URL de base de données ne sont jamais affichées.

import { DatabaseSync } from "node:sqlite"
import path from "node:path"
import fs from "node:fs"
import { PrismaClient, Prisma } from "@prisma/client"

const args = process.argv.slice(2)
const DRY = args.includes("--dry-run")
const FORCE = args.includes("--force")
const sqliteArg = args.indexOf("--sqlite")
const sqlitePath = path.resolve(sqliteArg >= 0 ? args[sqliteArg + 1] : "prisma/dev.db")

// Ordre imposé par les clés étrangères : les parents d'abord.
//   Game.creatorId -> User ; WalletTx.userId -> User ; GamePlayer -> Game, User ;
//   Invite -> Game, User ; Challenge -> User, Game
const ORDER = ["User", "Game", "WalletTx", "GamePlayer", "Invite", "Challenge"]
const delegate = (model) => model[0].toLowerCase() + model.slice(1)

const models = Object.fromEntries(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]))
for (const name of ORDER) if (!models[name]) throw new Error(`Modèle ${name} introuvable dans le client Prisma`)
const missing = Object.keys(models).filter((m) => !ORDER.includes(m))
if (missing.length) throw new Error(`Modèles non gérés par le script : ${missing.join(", ")} (ajoute-les à ORDER)`)

function toDate(v) {
  if (v === null || v === undefined) return null
  if (typeof v === "number" || typeof v === "bigint") return new Date(Number(v)) // Prisma/SQLite : ms depuis 1970
  if (/^\d+$/.test(v)) return new Date(Number(v))
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) throw new Error(`Date illisible : ${v}`)
  return d
}

function convert(model, row) {
  const out = {}
  for (const f of models[model].fields) {
    if (f.kind !== "scalar" && f.kind !== "enum") continue
    if (!(f.name in row)) continue // colonne absente de l'ancienne base : la valeur par défaut s'applique
    const v = row[f.name]
    if (v === null || v === undefined) { out[f.name] = null; continue }
    switch (f.type) {
      case "DateTime": out[f.name] = toDate(v); break
      case "Boolean": out[f.name] = v === 1 || v === 1n || v === true || v === "1" || v === "true"; break
      case "Int": out[f.name] = Number(v); break
      case "BigInt": out[f.name] = BigInt(v); break
      case "Float": case "Decimal": out[f.name] = Number(v); break
      default: out[f.name] = typeof v === "bigint" ? v.toString() : v
    }
  }
  return out
}

if (!fs.existsSync(sqlitePath)) throw new Error(`Fichier SQLite introuvable : ${sqlitePath}`)
const sqlite = new DatabaseSync(sqlitePath, { readOnly: true })
const existingTables = new Set(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name))

const data = {}
for (const model of ORDER) {
  data[model] = existingTables.has(model)
    ? sqlite.prepare(`SELECT * FROM "${model}"`).all().map((r) => convert(model, r))
    : []
}
sqlite.close()

console.log(`Source SQLite : ${path.relative(process.cwd(), sqlitePath)} (lecture seule)`)
for (const model of ORDER) console.log(`  ${model.padEnd(11)} ${data[model].length} ligne(s)`)

if (DRY) {
  console.log("\n--dry-run : aucune connexion à Postgres, rien n'a été écrit.")
  process.exit(0)
}

const targetUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!targetUrl) throw new Error("DIRECT_URL ou DATABASE_URL manquant (URL Postgres de Neon).")
if (!/^postgres(ql)?:\/\//.test(targetUrl)) throw new Error("L'URL cible doit commencer par postgresql:// (on ne l'affiche pas).")

const prisma = new PrismaClient({ datasourceUrl: targetUrl })
const CHUNK = 500

try {
  const counts = {}
  for (const model of ORDER) counts[model] = await prisma[delegate(model)].count()
  const nonEmpty = ORDER.filter((m) => counts[m] > 0)
  if (nonEmpty.length && !FORCE) {
    console.log(`\nLa base cible contient déjà des données (${nonEmpty.map((m) => `${m}: ${counts[m]}`).join(", ")}).`)
    console.log("Rien n'a été copié. Relance avec --force pour ajouter seulement les lignes absentes.")
    process.exitCode = 1
  } else {
    const inserted = await prisma.$transaction(
      async (tx) => {
        const res = {}
        for (const model of ORDER) {
          res[model] = 0
          const rows = data[model]
          for (let i = 0; i < rows.length; i += CHUNK) {
            const r = await tx[delegate(model)].createMany({ data: rows.slice(i, i + CHUNK), skipDuplicates: FORCE })
            res[model] += r.count
          }
        }
        return res
      },
      { maxWait: 20_000, timeout: 300_000 },
    )
    console.log(`\nCopie terminée${FORCE ? " (--force : lignes déjà présentes ignorées)" : ""} :`)
    for (const model of ORDER) {
      const after = await prisma[delegate(model)].count()
      console.log(`  ${model.padEnd(11)} +${inserted[model]} insérée(s), total cible ${after}`)
    }
  }
} finally {
  await prisma.$disconnect()
}
