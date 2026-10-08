/** Règles figées pour cette version. Le virement carte/banque n'est pas branché. */

export const SIGNUP_POKY = 500;
export const FREE_STAKE_POKY = 50;
export const LEVEL_STAKE_LION = 20;
export const PLATINUM_MIN_LION = 20;
/** Mise minimale d'un défi VIP (1 contre 1 entre joueurs). */
export const VIP_CHALLENGE_MIN_LION = 100;
/** Mise minimale d'une table VIP (ordinateur ou 2–4 joueurs). */
export const VIP_TABLE_MIN_LION = 5;
export const POKY_PER_LION = 50;
/** 1 Lion = 100 FCFA. */
export const FCFA_PER_LION = 100;
/** Lion obtenus pour 100 FCFA. */
export const LION_FOR_100_FCFA = 1;
/** Valeur en FCFA de 1 000 Lion. */
export const FCFA_FOR_1000_LION = FCFA_PER_LION * 1000;
/** Indicatif seulement : 100 FCFA ≈ 0,15 €, donc 1 Lion ≈ 0,15 €. */
export const EUR_FOR_100_FCFA = 0.15;
export const WINNER_SHARE_BPS = 8000;
export const HOUSE_SHARE_BPS = 2000;
export const MIN_AGE = 18;
/** Seuil prévu quand le retrait réel sera ouvert. 10 000 Lion = 1 000 000 FCFA. */
export const CASHOUT_MIN_LION = 10_000;
/**
 * Remboursement du bonus de bienvenue au premier retrait.
 * Dérivé des constantes : SIGNUP_POKY / POKY_PER_LION Lion (= FCFA_PER_LION × Lion FCFA).
 */
export const WELCOME_REPAY_LION = SIGNUP_POKY / POKY_PER_LION;
export const WELCOME_REPAY_FCFA = WELCOME_REPAY_LION * FCFA_PER_LION;
export const TURN_MS = 25_000;
export const HOUSE_PSEUDO = "maison";
export const MANAGER_PSEUDO = "manager";
export const ROLE_JOUEUR = "joueur";
export const ROLE_MANAGER = "manager";
export const ROLE_MAISON = "maison";

export const LEVELS = [
  {
    id: "gratuit",
    label: "Gratuit",
    currency: "poky" as const,
    stake: FREE_STAKE_POKY,
    custom: false,
    minPlayers: 1,
    maxPlayers: 4,
    blurb: "50 poky par joueur. Le bonus de bienvenue peut payer cette mise.",
  },
  {
    id: "defi",
    label: "Défi",
    currency: "lion" as const,
    stake: LEVEL_STAKE_LION,
    custom: false,
    minPlayers: 2,
    maxPlayers: 4,
    blurb: "Salon Défi public. Mise fixe de 20 Lion. Distinct des défis VIP (mise libre dès 100 Lion).",
  },
  {
    id: "argent",
    label: "Argent",
    currency: "lion" as const,
    stake: LEVEL_STAKE_LION,
    custom: false,
    minPlayers: 2,
    maxPlayers: 4,
    blurb: "Salon Argent. Même mise que Défi : 20 Lion. Les joueurs choisissent le salon.",
  },
  {
    id: "or",
    label: "Or",
    currency: "lion" as const,
    stake: LEVEL_STAKE_LION,
    custom: false,
    minPlayers: 2,
    maxPlayers: 4,
    blurb: "Salon Or. Même mise que Défi et Argent : 20 Lion.",
  },
  {
    id: "platinium",
    label: "Platinium",
    currency: "lion" as const,
    stake: PLATINUM_MIN_LION,
    custom: true,
    minPlayers: 2,
    maxPlayers: 4,
    blurb: "Le créateur fixe la mise, au minimum 20 Lion.",
  },
  {
    id: "vip",
    label: "VIP",
    currency: "lion" as const,
    stake: VIP_TABLE_MIN_LION,
    custom: true,
    minPlayers: 1,
    maxPlayers: 4,
    blurb: "Salon VIP. Mise libre dès 5 Lion. Ordinateur, 2, 3 ou 4 joueurs. Les défis VIP se jouent ici.",
  },
] as const;

export type LevelId = (typeof LEVELS)[number]["id"];

export function levelById(id: string) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

export function splitPot(pot: number) {
  const winner = Math.floor((pot * WINNER_SHARE_BPS) / 10_000);
  return { winner, house: pot - winner };
}

export function fcfaFromLion(lion: number) {
  return lion * FCFA_PER_LION;
}

export function eurFromLion(lion: number) {
  return (fcfaFromLion(lion) / 100) * EUR_FOR_100_FCFA;
}

export function welcomeRepayLion() {
  return WELCOME_REPAY_LION;
}
