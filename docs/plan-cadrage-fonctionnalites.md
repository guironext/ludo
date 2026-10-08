# Ludo Poky — plan de cadrage et fonctionnalités

Version 1.0 — 21 septembre 2026  
Application : `/Users/mac/Desktop/ludo-poky`  
Statut : première version jouable, sans argent réel.

---

## A. Cadrage

### A.1 Problème

Un groupe veut jouer au Ludo à 1, 2, 3 ou 4, avec une mise claire et un gagnant unique. L’argent du pot doit être calculé au même endroit pour tout le monde, pas dans le navigateur de chaque joueur.

### A.2 Réponse produit

**Ludo Poky** est un Ludo en ligne. Chaque compte reçoit 500 poky. Les parties gratuites se paient en poky. Les salons Défi, Argent, Or et Platinium se paient en Lion. Le gagnant prend 80 % du pot, l’application 20 %. Les dés sont tirés sur le serveur.

### A.3 Public

| Rôle | Besoin principal | Support |
| --- | --- | --- |
| Joueur | S’inscrire, miser, jouer, convertir ses gains | Web |
| Créateur de salle | Choisir le niveau, inviter, lancer | Web |
| Maison (application) | Encaisser 20 %, financer la mise de l’ordinateur | Interne |

### A.4 Décisions figées

| Sujet | Décision |
| --- | --- |
| Emplacement | Projet séparé de Mi-SIKA |
| Bonus d’inscription | 500 poky, jouables en partie gratuite, non convertibles, non retirables |
| Partie gratuite | 50 poky par siège, y compris l’ordinateur. 1 à 4 joueurs |
| Défi, Argent, Or | 20 Lion, 2 à 4 joueurs. Même mise, salons distincts |
| Platinium | Mise choisie par le créateur, minimum 20 Lion, 2 à 4 joueurs |
| Partage | 80 % au gagnant, 20 % à la maison |
| Conversion | 50 poky gagnés = 1 Lion |
| Taux affiché | 1 000 Lion = 100 FCFA ≈ 0,15 € |
| Âge | 18 ans, case à cocher |
| Abandon | La mise reste dans le pot. Le dernier joueur encore en jeu gagne |
| Invitation | Code de salle. Places réservables par pseudo |
| Tour | 25 secondes, puis le serveur joue à la place du joueur |
| Retrait réel | Fermé. Seuil prévu : 10 000 Lion et une pièce d’identité |

### A.5 Dans cette version

- Inscription, connexion, déconnexion.
- Portefeuille poky / Lion et historique des mouvements.
- Conversion des poky gagnés en Lion.
- Salle, code, invitation, ordinateur pour remplir les places.
- Plateau, dés, captures, cases sûres, arrivée exacte, 6 qui fait rejouer, trois 6 qui passent le tour.
- Règlement automatique du pot.

### A.6 Hors de cette version

- Achat de poky ou de Lion en FCFA ou en euro.
- Retrait vers une carte Visa, un compte Stripe, Orange Money, Wave, MTN ou Moov.
- Vérification réelle de l’âge et de la pièce d’identité.
- Application iOS ou Android.
- Classement, chat, tournois, spectateurs.
- Reprise d’images ou de code du jeu Poki.

### A.7 Contraintes

- Tant qu’une licence de jeux d’argent et un prestataire accepté ne sont pas là, aucun virement réel ne part.
- Le bonus de bienvenue ne doit jamais pouvoir sortir du jeu.
- Un joueur ne doit pas pouvoir choisir son dé depuis son navigateur.

### A.8 Vagues

| Vague | Objectif | État |
| --- | --- | --- |
| **V0** | Jouer avec poky et Lion | Livrée dans le dossier du bureau |
| **V1** | Tenue de jeu | Historique de parties, litiges, comptes admin, délais d’abandon plus fins |
| **V2** | Argent réel | Achat et retrait, après autorisation et prestataire |

---

## B. Fonctionnalités

Légende : **P0** indispensable et déjà en place · **P1** prochaine vague · **P2** plus tard.

### B.1 Compte

| Fonction | Priorité | État |
| --- | --- | --- |
| Inscription avec pseudo, e-mail, mot de passe, confirmation 18 ans | P0 | Fait |
| 500 poky de bonus à l’inscription | P0 | Fait |
| Connexion et session | P0 | Fait |
| Pièce d’identité avant retrait | P1 | Plus tard |

### B.2 Portefeuille

| Fonction | Priorité | État |
| --- | --- | --- |
| Soldes poky, bonus, Lion | P0 | Fait |
| Conversion 50 poky gagnés = 1 Lion | P0 | Fait |
| Blocage de la conversion du bonus | P0 | Fait |
| Historique des mouvements | P0 | Fait |
| Écran de retrait affiché, bouton inactif | P0 | Fait |
| Achat et retrait en FCFA / euro | P2 | Fermé |

### B.3 Salles

| Fonction | Priorité | État |
| --- | --- | --- |
| Gratuit, Défi, Argent, Or, Platinium | P0 | Fait |
| 1 joueur contre l’ordinateur | P0 | Fait |
| 2, 3 ou 4 joueurs | P0 | Fait |
| Code de salle et invitation par pseudo | P0 | Fait |
| Compléter avec l’ordinateur | P0 | Fait |
| Annulation tant que la mise n’est pas prise | P0 | Fait |
| Débit de toutes les mises au lancement, y compris la maison pour l’ordinateur | P0 | Fait |

### B.4 Partie

| Fonction | Priorité | État |
| --- | --- | --- |
| Plateau 15×15, 4 pions, couloir coloré | P0 | Fait |
| Sortie de la maison avec un 6 | P0 | Fait |
| Dé serveur, tour de 25 s | P0 | Fait |
| Case sûre, capture, arrivée exacte | P0 | Fait |
| 6 : rejouer. Trois 6 : le tour passe | P0 | Fait |
| Abandon et victoire du dernier joueur | P0 | Fait |
| 80 % / 20 % crédités à la fin | P0 | Fait |

### B.5 Critères pour dire que V0 marche

- Un nouveau compte a 500 poky et 0 Lion.
- Une conversion échoue tant que ces 500 poky n’ont pas été gagnés en partie.
- Une partie gratuite contre l’ordinateur débite 50 poky et ouvre un pot de 100.
- Le gagnant d’une partie à deux reçoit 80, la maison 20.
- Un pseudo non invité ne prend pas une place réservée.
- Abandonner ne rend pas la mise.
