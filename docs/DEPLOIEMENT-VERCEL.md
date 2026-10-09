# Mettre Baobab Arena en ligne sur Vercel avec Postgres (Neon)

## Pourquoi ce changement ?

En local, le projet utilisait **SQLite** : un simple fichier, `prisma/dev.db`, sur ton Mac.
Sur Vercel, ce fichier n'existe pas (il n'est pas sur GitHub) et Vercel ne peut pas garder
de fichier entre deux requêtes. Résultat : en ligne, aucune inscription, partie ou mise ne
pouvait être enregistrée.

Le projet utilise maintenant **Postgres**, hébergé gratuitement chez **Neon**. La même base
sert au site en ligne, et peut aussi servir en local.

### Pourquoi `prisma db push` et pas les migrations ?

L'ancien dossier `prisma/migrations` était écrit pour SQLite (types `DATETIME`, verrou
`provider = "sqlite"`) et ne contenait qu'une seule petite migration : la base avait surtout
été créée avec `db push`. Il est inutilisable avec Postgres ; il a été déplacé dans
`~/Desktop/ludo/ludo-poky-sauvegarde-avant-postgres/migrations-sqlite`.

On crée donc les tables avec **`npx prisma db push`**, qui lit `prisma/schema.prisma` et crée
la base à l'identique. C'est simple et c'est ce que le projet faisait déjà (`npm run db:push`).
Plus tard, quand le site aura de vrais joueurs, on pourra passer aux migrations versionnées
(`npx prisma migrate dev --name init`) pour suivre chaque changement de structure.

Le build Vercel **ne touche jamais à la base** : il lance seulement `prisma generate && next build`.
Les changements de structure se font toujours à la main, depuis ton Mac, avec `db push`.

---

## Étape 1 — Créer la base Neon

1. Va sur <https://neon.tech> et crée un compte (connexion GitHub possible).
2. **Create project** : nom `baobab-arena`, version Postgres par défaut, région la plus
   proche de tes joueurs et de Vercel (par ex. **AWS Europe (Frankfurt)**).
3. Sur le tableau de bord du projet, clique **Connect**. Tu obtiens deux adresses :
   - **Pooled connection** (l'hôte contient `-pooler`) → ce sera **`DATABASE_URL`**
   - **Direct connection** (décoche « Connection pooling », pas de `-pooler`) → ce sera **`DIRECT_URL`**

   Elles ressemblent à :
   ```
   postgresql://neondb_owner:MOT_DE_PASSE@ep-xxxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
   postgresql://neondb_owner:MOT_DE_PASSE@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Ne colle jamais ces adresses dans un chat, un email ou sur GitHub : elles contiennent le mot de passe.

> Variante : dans Vercel, onglet **Storage → Create Database → Neon**. Vercel crée alors
> `DATABASE_URL` et `DATABASE_URL_UNPOOLED` tout seul. Il faut juste ajouter en plus
> **`DIRECT_URL`** avec la même valeur que `DATABASE_URL_UNPOOLED`.

Conseil : dans Neon, crée une **branche `dev`** (menu *Branches*) pour travailler en local
sans toucher aux données réelles. Chaque branche a ses propres adresses.

---

## Étape 2 — Brancher ton Mac sur Neon

Ouvre `~/Desktop/ludo-poky/.env` dans VS Code (pas dans le chat) :

1. Remplace la valeur de `DATABASE_URL=` (actuellement `file:./dev.db`) par l'adresse **pooled**.
2. Décommente la ligne `# DIRECT_URL=...` ajoutée en bas du fichier et mets l'adresse **directe**.
3. Le fichier `.env.local` contient aussi une ligne `DATABASE_URL=`. Next.js la lit **en priorité**
   sur `.env` : mets-y la même adresse pooled (ou supprime cette ligne de `.env.local`).

Prisma (les commandes `npx prisma ...`) lit `.env` ; le site (`npm run dev`) lit `.env.local` puis `.env`.

---

## Étape 3 — Créer les tables dans Neon

Dans le Terminal :

```bash
cd ~/Desktop/ludo-poky
npx prisma db push
```

Tu dois voir « Your database is now in sync with your Prisma schema ».

---

## Étape 4 — Copier les données de `dev.db` vers Neon

Le script `scripts/migrate-sqlite-to-postgres.mjs` copie les joueurs, portefeuilles, parties,
invitations et défis, **en gardant les mêmes id** (donc les liens Clerk ↔ joueur restent valables
avec les mêmes clés Clerk). Il ouvre `dev.db` en lecture seule et écrit tout dans **une seule
transaction** : si quelque chose échoue, rien n'est écrit dans Neon.

Arrête d'abord `npm run dev` (pour que `dev.db` ne bouge plus), puis :

```bash
# 1. Vérification : lit seulement dev.db, ne se connecte pas à Neon
npm run db:migrate-data -- --dry-run

# 2. Copie réelle vers la base de DIRECT_URL (ou DATABASE_URL)
npm run db:migrate-data
```

- Si la base Neon contient déjà des données, le script s'arrête sans rien copier.
- `--force` ajoute seulement les lignes manquantes (il ne supprime ni ne remplace jamais rien).
- Il faut Node 22.13 ou plus récent (tu as Node 24 : c'est bon).
- Pour copier vers la base de production alors que `.env` pointe sur la branche `dev`, on peut
  passer l'adresse juste pour cette commande :
  `DIRECT_URL="adresse-directe-prod" npm run db:migrate-data`

Vérifie le résultat avec `npx prisma studio` (onglet User : la maison, l'admin, les joueurs).

---

## Étape 5 — Les variables d'environnement sur Vercel

Vercel → ton projet → **Settings → Environment Variables**. Ajoute pour **Production**
(et **Preview** si tu veux) :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | adresse Neon **pooled** (avec `-pooler`) |
| `DIRECT_URL` | adresse Neon **directe** (sans `-pooler`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk → API Keys (`pk_test_...` ou `pk_live_...`) |
| `CLERK_SECRET_KEY` | Clerk → API Keys (`sk_test_...` ou `sk_live_...`) |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Clerk → Webhooks → ton endpoint → Signing Secret (`whsec_...`) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/connexion` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/inscription` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/apres-connexion` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/apres-connexion` |

Recopie les valeurs Clerk depuis ton `.env.local` (mêmes noms). Les variables `AUTH_SECRET` et
`MANAGER_*` ne sont plus utilisées par le site depuis le passage à Clerk.

Le build Vercel est déjà prêt : `npm install` lance `prisma generate` (script `postinstall`)
et `npm run build` lance `prisma generate && next build`.

---

## Étape 6 — Clerk : domaine Vercel et webhook

### Domaine
- **Avec les clés de développement** (`pk_test_`) : le site fonctionne directement sur
  `https://ton-projet.vercel.app`, rien à ajouter. Clerk affiche juste l'avertissement
  « development keys » et limite le nombre d'utilisateurs : bien pour tester.
- **Pour la vraie mise en ligne** : dans Clerk, crée l'instance **Production**. Clerk exige
  **ton propre nom de domaine** (par ex. `baobab-arena.com`, pas `vercel.app`) : ajoute-le dans
  Clerk → *Domains*, crée les enregistrements DNS demandés, puis ajoute le même domaine dans
  Vercel → *Settings → Domains*. Remplace ensuite les deux clés par `pk_live_` / `sk_live_`.
  Les comptes Clerk de développement n'existent pas en production : chaque joueur se réinscrit
  avec **le même email confirmé** et retrouve automatiquement son joueur et son solde.

### Webhook
1. Clerk → **Webhooks → Add Endpoint**.
2. URL : `https://ton-domaine/api/webhooks` (par ex. `https://ton-projet.vercel.app/api/webhooks`).
3. Événements : `user.created`, `user.updated`, `user.deleted`.
4. Copie le **Signing Secret** (`whsec_...`) dans la variable Vercel `CLERK_WEBHOOK_SIGNING_SECRET`.

Attention : chaque instance Clerk (dev / prod) a ses propres clés et son propre webhook.

---

## Étape 7 — Envoyer sur GitHub et redéployer

1. Débloque git si besoin : `sudo xcodebuild -license` puis `agree`.
2. Envoie le code :
   ```bash
   cd ~/Desktop/ludo-poky
   git add -A
   git status            # vérifie qu'aucun .env ni dev.db n'apparaît
   git commit -m "Passage à Postgres (Neon) pour Vercel"
   git push
   ```
3. Vercel redéploie tout seul après le push. Si tu as modifié les variables sans pousser de code :
   Vercel → **Deployments** → `…` sur le dernier → **Redeploy**.
4. Teste en ligne : inscription, connexion avec `guironext@gmail.com` (→ `/maison`) et
   `guirogerard@gmail.com` (→ `/admin`), une partie gratuite.

---

## En cas de problème

| Message | Cause probable |
|---|---|
| `Environment variable not found: DIRECT_URL` | `DIRECT_URL` manque dans `.env` (local) ou dans Vercel |
| `the URL must start with the protocol postgresql://` | `DATABASE_URL` vaut encore `file:./dev.db` (dans `.env` ou `.env.local`) |
| `Can't reach database server` | adresse mal copiée, ou base Neon en veille (réessaie après quelques secondes) |
| `The table "public.User" does not exist` | l'étape 3 (`npx prisma db push`) n'a pas été faite sur cette base |
| Erreur 500 sur Vercel | Vercel → Deployments → ton déploiement → **Logs** |

## Revenir en arrière

Tout l'état précédent (projet SQLite + `dev.db` + anciennes migrations) est dans
`~/Desktop/ludo/ludo-poky-sauvegarde-avant-postgres/`.
