# Règles UI et UX

## 1. Objectif de ce document

Ce document définit les principes visuels et comportementaux de Gym Companion.

L’objectif n’est pas de figer une maquette complète, mais de garantir une expérience :

- cohérente ;
- rapide ;
- mobile-first ;
- accessible ;
- adaptée à une utilisation en salle ;
- lisible dans des conditions variées ;
- rassurante lors des problèmes réseau.

## 2. Identité du produit

Gym Companion doit transmettre :

- énergie ;
- progression ;
- précision ;
- simplicité ;
- fiabilité ;
- collaboration.

L’interface ne doit pas ressembler à un logiciel médical ni à un jeu excessivement gamifié.

Le produit peut être motivant sans devenir agressif ou culpabilisant.

## 2bis. Fondations UX — Performance / Training Log (jalon shell)

Direction artistique : **Performance / Training Log**.

L’UI évoque performance, progression, précision et entraînement — pas un dashboard SaaS
générique ni un outil administratif.

### Navigation globale

- Mobile : Accueil · Entraînement · Progression · Plus (sheet).
- Desktop (`md+`) : sidebar alimentée par la même config (`apps/web/src/app/navigation/nav-config.ts`).
- Séance active (`/workouts/active`) : mode focus — bottom nav et sidebar masquées.
- Branding « Gym Companion » : Accueil / sidebar desktop uniquement — pages internes = top bar compacte (`PageHeader`).

### Domaines

| Domaine | Hub | Contenu |
|---------|-----|---------|
| Accueil | `/` | Programme courant / empty state |
| Entraînement | `/training` | Planning, programmes, historique |
| Progression | `/progress` | Vue d’ensemble, records |
| Plus | sheet groupé / sidebar | Entraînement · Coaching · Compte |

### Design tokens (`global.css`)

| Token | Rôle | Valeur indicative |
|-------|------|-------------------|
| `--background` | fond app | `#F5F6F3` |
| `--surface` / `--card` | surfaces | `#FFFFFF` |
| `--foreground` | texte | `#11150F` |
| `--muted-foreground` | secondaire | `#687066` |
| `--border` | séparateurs | `#DEE3DA` |
| `--primary` | accent lime ponctuel | `#B7F34A` |
| `--primary-foreground` | texte sur accent | très sombre |
| `--success` / `--danger` | sémantique | verts / rouge maîtrisés |

L’accent lime reste **ponctuel** (CTA, progression positive, série validée, activité, record).
Ne pas peindre de grandes surfaces en lime. Ne pas hardcoder les hex dans les composants.

### Typographie & espacements

- Titre page ~28–32px ; section ~18–20px ; body ~15–16px ; secondary ~14–15px.
- Valeurs sportives : classe `.tabular-nums`.
- Échelle d’espacement : 4 / 8 / 12 / 16 / 24 / 32 ; padding-inline mobile = 16px.
- Contrôles : hauteur ~48–52px ; radius contrôles 10–14px ; surfaces 16–20px.
- Largeur minimale supportée : **320px**.

### Empty states

Composant `EmptyState` : icône optionnelle, titre, description courte, CTA principal,
action secondaire optionnelle. **Ne pas** dupliquer le même CTA hors du empty state.

## 3. Direction visuelle

### 3.1 Style général

- interface moderne ;
- cartes sobres ;
- hiérarchie typographique nette ;
- peu d’ombres lourdes ;
- bordures discrètes ;
- animations courtes ;
- informations principales très lisibles ;
- actions critiques clairement différenciées.

### 3.2 Couleurs

Palette **light-first** via tokens CSS (`--background`, `--primary`, etc.) — voir §2bis.

Rôles :

- `--primary` (lime) : CTA principal, indicateurs de progression ponctuels ;
- `--success` : réussite / sync confirmée (distinct du lime si besoin) ;
- `--warning` : attention, série partielle ;
- `--danger` : erreur, suppression ;
- `--muted-foreground` : secondaire / désactivé.

Ne plus utiliser bleu CTA + orange navigation active comme couple dominant.

### 3.3 Règle d’accessibilité

Une couleur ne doit jamais être le seul indicateur d’un état.

Exemple :

```text
Icône + libellé + couleur
```

et non :

```text
Couleur seule
```

## 4. Thème clair et sombre

Le thème sombre est pertinent pour une utilisation en salle.

L’application doit prendre en charge :

- thème système ;
- thème clair ;
- thème sombre.

Les deux thèmes doivent respecter les mêmes règles de contraste.

Le thème sombre ne doit pas utiliser un noir absolu sur toutes les surfaces. Des niveaux de surface permettent de conserver la hiérarchie.

## 5. Typographie

### 5.1 Police

Utiliser une police sans-serif lisible et disponible sans dépendance complexe.

### 5.2 Hiérarchie

Niveaux recommandés :

- titre de page ;
- titre de section ;
- titre de carte ;
- valeur principale ;
- texte courant ;
- texte secondaire ;
- libellé technique.

### 5.3 Valeurs importantes

Les valeurs utilisées pendant une séance doivent être particulièrement visibles :

- charge ;
- répétitions ;
- temps restant ;
- numéro de série ;
- station ;
- objectif.

### 5.4 Nombres tabulaires

Les chronomètres et séries de valeurs peuvent utiliser des chiffres tabulaires afin d’éviter les changements de largeur.

## 6. Grille et espacements

Utiliser une échelle cohérente d’espacement.

Recommandations :

- marges latérales mobiles confortables ;
- espacement réduit dans les écrans de séance ;
- espacement plus généreux dans les pages d’analyse ;
- contenu principal limité en largeur sur desktop ;
- aucune information essentielle collée aux bords de l’écran.

## 7. Zones tactiles

Les actions principales doivent posséder une zone tactile confortable.

Les icônes seules doivent être placées dans un bouton suffisamment grand.

Les actions proches ne doivent pas provoquer facilement une erreur de sélection.

Exemples sensibles :

- terminer une séance ;
- supprimer une série ;
- quitter une salle ;
- modifier la charge ;
- passer à l’exercice suivant.

## 8. Navigation mobile

### 8.1 Barre inférieure

La barre inférieure doit rester :

- visible hors séance active ;
- exactement **4** emplacements (Accueil, Entraînement, Progression, Plus) ;
- icône + label, zones tactiles ≥ 44×44 px ;
- état actif identifiable (indicateur lime discret — pas de gros contour) ;
- compatible `safe-area-inset-bottom` ;
- sans overflow horizontal ni scroll.

### 8.2 Menu Plus

Ouvre un sheet mobile (safe-area) groupé — pas une liste plate :

- **Entraînement** : Exercices, Séances partagées
- **Coaching** : Coach
- **Compte** : Profil

Chaque entrée : icône + label + description courte + `>`.
Fermeture Escape / overlay / navigation.
Pas de destination « Paramètres » tant qu’aucune page n’existe.
Pas de faux badge « invitations reçues » (ancien flux email supprimé).

### 8.3 Navigation pendant une séance

Sur `/workouts/active` (mode focus) :

- la barre principale globale est **masquée** ;
- header minimal côté page ;
- maximiser la surface de saisie des séries.

Une navigation dédiée séance (précédent / liste / suivant) pourra compléter ce mode
dans un jalon UX ultérieur. L’utilisateur doit pouvoir revenir sans perdre la séance.

## 9. Boutons

### 9.1 Variantes

Variantes recommandées :

- `primary` ;
- `secondary` ;
- `outline` ;
- `ghost` ;
- `destructive` ;
- `success`, uniquement si réellement nécessaire.

### 9.2 Action principale

Une page ne doit généralement contenir qu’une action principale visuellement dominante.

### 9.3 Actions destructrices

Les actions destructrices doivent :

- utiliser une formulation explicite ;
- demander confirmation lorsque la conséquence est importante ;
- ne pas être placées trop près de l’action principale ;
- expliquer ce qui sera supprimé.

### 9.4 Chargement

Lorsqu’un bouton déclenche une opération :

- il affiche un état de chargement ;
- il bloque les doubles soumissions ;
- son libellé reste compréhensible ;
- l’interface ne doit pas sembler figée.

## 10. Icônes

Utiliser Lucide React.

Les icônes doivent :

- soutenir un libellé ;
- rester cohérentes ;
- ne pas remplacer du texte important ;
- disposer d’un label accessible lorsqu’elles sont seules.

Une même action doit utiliser la même icône dans toute l’application.

## 11. Cartes

Les cartes sont utilisées pour regrouper :

- une séance ;
- un exercice ;
- un programme ;
- un résumé ;
- une invitation ;
- une mesure.

Une carte ne doit pas contenir trop d’actions concurrentes.

Sur mobile, éviter les cartes imbriquées profondément.

## 12. Listes

Les listes longues doivent permettre :

- recherche ;
- filtrage ;
- états de chargement ;
- pagination ou chargement progressif ;
- état vide ;
- accès clair au détail.

Les informations secondaires ne doivent pas rendre chaque ligne trop haute.

## 13. Formulaires

### 13.1 Principes

- libellé toujours visible ;
- exemple ou unité lorsque nécessaire ;
- validation proche du champ ;
- message d’erreur concret ;
- clavier mobile adapté au type de donnée ;
- valeurs préremplies lorsque possible ;
- sauvegarde de brouillon pour les formulaires longs.

### 13.2 Saisie numérique

Les champs de charge, répétitions et temps doivent :

- ouvrir un clavier numérique approprié ;
- accepter les décimales lorsque nécessaire ;
- afficher l’unité ;
- proposer des incréments rapides ;
- empêcher les valeurs manifestement invalides.

### 13.3 Incréments rapides

Exemple pour une charge :

```text
-5 | -2,5 | 60 kg | +2,5 | +5
```

Les valeurs exactes dépendent de l’équipement et des unités.

### 13.4 Formulaires longs

Pour les programmes et recettes, utiliser :

- sections ;
- navigation par étapes ;
- résumé final ;
- avertissement avant abandon.

## 14. Bottom sheets, drawers et modales

### Bottom sheet

À privilégier sur mobile pour :

- choisir un statut ;
- afficher la liste de séance ;
- ajouter une série ;
- choisir un exercice ;
- afficher des actions secondaires.

### Drawer

Adapté aux filtres et paramètres rapides.

### Modale

À réserver aux confirmations courtes.

Une modale ne doit pas contenir un formulaire complexe ou une page entière.

## 15. Page de séance active / Focus Mode

La page `/workouts/active` est l’écran le plus important du produit. Elle tourne en **mode focus** : aucune bottom navigation globale, aucune sidebar.

### 15.1 Hiérarchie

Répondre immédiatement à trois questions :

1. Quel exercice suis-je en train de faire ?
2. Quelle série dois-je réaliser maintenant ?
3. Quelle action dois-je effectuer ensuite ?

Ordre visuel :

1. header sticky (quit ×, nom compact, menu …, progression) ;
2. navigation exercices compacte ;
3. nom de l’exercice courant ;
4. série suivante / cible ;
5. liste compacte des séries ;
6. CTA principal sticky (ou timer de repos) ;
7. actions secondaires uniquement dans le menu `…`.

Les métadonnées administratives (statut, programme, modèle, date, début) vivent dans la sheet **Détails de la séance**, pas dans le flux principal.

### 15.2 CTA principal

Toujours une seule action dominante :

| Contexte | CTA |
| --- | --- |
| Série à faire | `Enregistrer la série` |
| Repos en cours | Timer (état principal) |
| Exercice terminé + suivant | `Exercice suivant` |
| Dernier exercice terminé | `Terminer la séance` |

Le CTA respecte `safe-area-inset-bottom`. Pendant le repos, le timer occupe le bas de l’écran.

### 15.3 Séries

Représentation en lignes compactes, pas en cards empilées :

- `✓` terminée / partielle / échouée ;
- `●` série courante ;
- `○` à venir ;
- `—` ignorée / annulée.

Tap sur une série ouvrable pour consulter / modifier. Pas de boutons « Saisir / Ignorer / Échouée » répétés sur chaque ligne.

### 15.4 Bottom sheet d’enregistrement

Sur mobile, préférer un bottom sheet à une modale centrée.

- Titre : `Série N` + cible compacte (`8–10 reps · RIR 2`) ;
- Grille Charge / Répétitions (quand pertinent) ;
- Champs numériques `min-h-12`, `inputMode` adapté, `tabular-nums` ;
- Sticky : **Enregistrer** ;
- Secondaires discrets : Annuler · Ignorer la série ;
- Statut / notes dans « Plus d’options ».

Préserver le préremplissage métier existant (cibles, valeurs déjà saisies). Ne pas inventer de nouvelle recommandation.

### 15.5 Timer de repos

Compact, chiffre dominant (`text-5xl`, `tabular-nums`) :

```text
REPOS
01:57
[-15 s]   Pause   [+15 s]
Passer le repos
```

« Passer le repos » arrête la minuterie locale (comportement historique de stop). Pas de matrice 2×2 de gros boutons.

### 15.6 Navigation exercices

Compacte : `‹  Nom · Exercice N / M  ›` + pastilles de progression. Aucune flèche géante ni carousel de cards.

Le changement d’exercice ne modifie aucune règle métier.

### 15.7 Fin d’exercice / fin de séance

Quand toutes les séries de l’exercice sont traitées : message clair + CTA `Exercice suivant`.

Sur le dernier exercice : CTA `Terminer la séance` (confirmation via le dialogue lifecycle existant).

### 15.8 Offline / sync

Indicateur discret (`Hors ligne`, `Synchronisation…`). Ne jamais bloquer l’enregistrement local pour une raison visuelle. IndexedDB, queue, idempotence et conflits inchangés.

### 15.9 Desktop

Mode focus conservé (pas de sidebar). Largeur du contenu limitée (`max-w-xl`). Même hiérarchie que le mobile.

### 15.10 Échec / statut

L’action « Échec » / statut reste accessible via le sheet (options), sans mise en scène punitive.

Libellés préférables : série partielle, cible non atteinte, série interrompue.

### 15.11 Écran actif

L’application peut demander à maintenir l’écran actif pendant une séance, avec consentement et uniquement lorsque la plateforme le permet.

## 15bis. Program Builder

Les écrans `/programs/*` construisent et éditent la hiérarchie :

```text
Programme
  └── Séances (WorkoutTemplate)
        └── Exercices (WorkoutTemplateExercise)
              └── Séries cibles (WorkoutTemplateSet)
```

Objectif : permettre de comprendre et modifier une séance complète sur téléphone sans cards imbriquées.

### 15bis.1 Navigation

| Vue | Contenu |
| --- | --- |
| Liste | Lignes compactes (nom, objectif, nb séances, badge Actif/Archivé) + menu `…` secondaire |
| Détail programme | Header compact + liste des séances (pas le contenu de chaque séance) |
| Éditeur séance | `?templateId=` — exercices et séries en sections / lignes |

Tap sur une séance → éditeur focused. Retour via `‹` vers le détail programme.

### 15bis.2 Densité

Échelle d’espacement UX-1 : 4 / 8 / 12 / 16 / 24 / 32.

Sur ~390px, un exercice doit montrer nom + méta + 2–3 séries compactes sans un viewport de scroll vide.

Éviter : paddings 32px répétés, contrôles 70–80px permanents, cards dans cards.

### 15bis.3 TargetSetRow

Une série cible tient sur une ligne principale :

```text
1  Travail    8–10 reps · RIR 2     ⋮
```

Composant : `TargetSetRow` + `formatSetSummaryCompact`. Tap ou menu `…` : modifier / déplacer / supprimer (selon API existante). Pas de duplication inventée.

### 15bis.4 Menus contextuels

Les flèches haut/bas permanentes sont interdites dans le builder. Reorder via menu `…` :

- Déplacer vers le haut / bas
- Modifier
- Supprimer

Zones tactiles ≥ 44px, `aria-label`, focus-visible.

### 15bis.5 Ajout / édition de série

Bottom sheet (pattern UX-2) :

- Type, reps/durée/distance selon `measurementType`, charge si pertinent, RIR + repos
- « Plus d’options » : intensité, RPE
- CTA sticky unique ; Annuler secondaire

Ne pas changer les validations métier : seuls l’affichage et le regroupement des champs évoluent.

### 15bis.6 Recommandation de charge

Dans le builder uniquement : `LoadRecommendationCard variant="compact"` — une ligne (`Suggestion` + valeur + `Voir`). Pas de grande card vide si non supporté / indisponible. Le moteur et le détail complet restent inchangés.

### 15bis.7 Sticky

Pas de footer sticky permanent sur les pages liste / détail / éditeur. Sticky réservé aux sheets et étapes de validation.

### 15bis.8 Hors périmètre builder

Planning, Active Workout, Progression, Shared Workouts, catalogue global, Coach : inchangés par ce jalon.

## 16. Chronomètre

### 16.1 Affichage

Le temps restant doit être très lisible (chiffre dominant, `tabular-nums`).

En séance active, le timer est sticky en bas et remplace temporairement le CTA d’enregistrement.

### 16.2 États

- actif ;
- en pause ;
- terminé ;
- arrière-plan ;
- notification indisponible.

### 16.3 Actions

- pause / reprise ;
- ±15 secondes ;
- passer le repos (stop local).

Éviter une grille de gros boutons équivalents.

### 16.4 Fin du repos

Utiliser plusieurs signaux possibles :

- changement visuel ;
- vibration, si disponible et autorisée ;
- son facultatif ;
- notification.

L’utilisateur doit pouvoir désactiver chaque signal.

## 17. Séance partagée (UX-6)

Shared Workout = **coordination sociale**. Active Workout (UX-2) = **saisie des séries**.
Ne pas fusionner les deux écrans. CTA « Ouvrir ma séance » → `/workouts/:id` → Active.

Règles métier / realtime : voir `docs/10-realtime-workouts.md` (REST = vérité ; Socket = hint).

### 17.1 Liste (`/shared-workouts`)

- Header + CTA `+ Créer une salle` + action « Rejoindre avec un code » (sheet)
- **Mes salles** en lignes compactes (statut + N participants)
- Empty : un seul CTA Créer (pas de double si déjà en header)

### 17.2 Lobby / ACTIVE / TERMINAL (`/:roomId`)

Route unifiée. Header compact + menu `…` selon rôle.

**Lobby** : présence ●/○ + texte, code d’accès (owner : copier / rotater), ta séance (attente), CTA Démarrer (owner).

**ACTIVE** :
1. Toi (séance liée + exercice courant coarse + Ouvrir)
2. Participants (lignes privacy-safe)
3. Matériel (FIFO humain)

**Terminal** : lecture seule, pas d’équipement / lifecycle, retour liste.

**Bottom nav** : conservée sur room ACTIVE (pas de 2e focus mode).

### 17.3 Privacy (bloquant)

Ne jamais afficher pour un autre participant : poids, reps, RIR/RPE, notes, targets, PR.

Partagé uniquement (coarse) : nom, présence, exercice courant, processed/total sets, %, statut séance.

### 17.4 Présence

● En ligne / ○ Hors ligne + `aria-label`. Pas de socket id / jargon « Temps réel connecté ».

Socket down : bandeau « Temps réel indisponible » + **Actualiser** (refetch REST). Room utilisable sans Socket.

### 17.5 Matériel

Labels humains : Disponible / Utiliser · Utilisée par X · File d’attente · Ta position · Libérer / Quitter la file.
Pas d’IDs ni `requestedAt`.

### 17.6 Owner vs member

Owner : code d’accès (copier / rotater), renommer, démarrer, terminer, annuler.
Member : rejoindre via code (sheet liste), quitter, gérer sa séance et son équipement.
Ne pas simuler une permission absente serveur.

## 17bis. Exercices / Plus / Profil (UX-7)

Destinations secondaires via Plus. Même langage UX-1 (PageHeader, EmptyState, tokens).

### Catalogue (`/exercises`)

- Header compact + CTA `+ Créer` (pas pleine largeur)
- Recherche principale sticky (~48–52 px) ; debounce / URL / infinite query inchangés
- Filtres : action compacte → bottom sheet ; chips actives + Effacer
- Liste dense (lignes, pas grosses cards) : nom · muscle · équipement · mesure · favori
- Badge **Personnel** uniquement (pas de badge SYSTEM)
- Empty : « Aucun exercice ne correspond à ces critères. » + Effacer / Créer

### Détail (`/exercises/:id`)

- Header + favori ; résumé `Muscle · Équipement` (pas fiche `label: valeur`)
- Instructions repliables ; Préférences en sheet ; reset en text button
- Lien Progression si route existante ; pas de lien Coach inventé
- Gestion perso (edit/archive) inchangée côté permissions

### Menu Plus

Voir §8.2 — groupes Entraînement / Coaching / Compte.

### Profil (`/profile`)

- Vue identité + préférences en lignes ; **Modifier** ouvre le formulaire
- Déconnexion en action secondaire (pas bouton rouge permanent)
- Pas de inventer password / 2FA / suppression compte

## 18. États réseau

### 18.1 En ligne

Aucun indicateur permanent n’est nécessaire lorsque tout fonctionne normalement.

### 18.2 Hors ligne

Afficher un bandeau discret mais visible :

```text
Mode hors ligne — les changements seront synchronisés
```

### 18.3 Synchronisation

États possibles :

- synchronisé ;
- synchronisation en cours ;
- en attente ;
- échec ;
- conflit.

### 18.4 Séance partagée déconnectée

Socket down (LOBBY / ACTIVE) : bandeau discret « Temps réel indisponible » +
bouton **Actualiser** (refetch REST). La room reste utilisable ; pas de simulation
des changements des autres participants. Voir §17.4.

## 19. Gestion des erreurs

### 19.1 Messages

Un message d’erreur doit expliquer :

- ce qui s’est passé ;
- ce que l’utilisateur peut faire ;
- si ses données sont conservées.

Exemple :

```text
La série n’a pas encore été synchronisée. Elle reste enregistrée sur ce téléphone et sera renvoyée lorsque la connexion reviendra.
```

### 19.2 Erreurs techniques

Ne pas afficher directement :

- stack trace ;
- nom de table ;
- message Prisma ;
- détails de token ;
- identifiant interne inutile.

### 19.3 Récupération

Proposer selon le cas :

- réessayer ;
- actualiser ;
- revenir ;
- conserver localement ;
- contacter le support ;
- consulter le conflit.

## 20. Notifications internes

Utiliser des toasts pour :

- confirmation simple ;
- erreur non bloquante ;
- action annulable ;
- sauvegarde réussie.

Ne pas utiliser un toast comme seul moyen de communiquer une information importante.

Les erreurs de formulaire doivent rester visibles près du champ.

## 21. États vides

Un état vide doit :

- expliquer pourquoi la page est vide ;
- proposer une prochaine action ;
- éviter les illustrations excessives ;
- ne pas afficher plusieurs boutons concurrents.

Exemple :

```text
Tu n’as encore créé aucun programme.

Crée un programme pour préparer tes prochaines séances, ou démarre directement une séance libre.
```

## 22. Skeletons et chargement

Utiliser des skeletons lorsque la structure de la page est connue.

Utiliser un spinner pour une action locale ou courte.

Ne pas bloquer toute l’application lorsqu’une seule section se charge.

## 23. Feedback optimiste

Le feedback optimiste peut être utilisé lorsque l’action est facilement annulable.

Exemples :

- favori ;
- réorganisation locale ;
- ajout temporaire ;
- lecture d’une notification.

Pour une série ou une action partagée critique :

- afficher immédiatement l’action ;
- conserver un statut en attente ;
- attendre la confirmation serveur avant de la considérer comme définitive.

## 24. Animations

### 24.1 Durée

Les animations doivent rester courtes et fonctionnelles.

### 24.2 Usages utiles

- changement de station ;
- validation de série ;
- ouverture d’une bottom sheet ;
- progression ;
- apparition d’une erreur.

### 24.3 À éviter

- animations longues ;
- confettis systématiques ;
- mouvements gênant la saisie ;
- transitions retardant l’accès à l’information.

### 24.4 Réduction des mouvements

Respecter `prefers-reduced-motion`.

## 25. Graphiques

### 25.1 Objectif

Chaque graphique doit répondre à une question.

Exemples :

- ma charge progresse-t-elle ?
- mon volume augmente-t-il ?
- combien de fois ai-je réalisé cet exercice ?
- mon poids évolue-t-il sur plusieurs semaines ?

### 25.2 Mobile

- limiter le nombre de séries affichées ;
- utiliser des filtres ;
- permettre un détail au toucher ;
- éviter les légendes trop longues ;
- afficher une alternative textuelle.

### 25.3 Estimations

Une courbe estimée doit être différenciée d’une mesure réelle.

## 26. Nutrition

### 26.1 Présentation des calories

Ne pas présenter les calories comme un score moral.

Éviter les formulations comme :

```text
Mauvaise journée
```

Préférer :

```text
Objectif dépassé de 180 kcal
```

### 26.2 Dépense sportive

Afficher la dépense séparément et comme estimation.

### 26.3 Macros

Les protéines, glucides et lipides peuvent utiliser :

- valeur consommée ;
- objectif ;
- barre de progression ;
- pourcentage.

La couleur seule ne doit pas indiquer un dépassement.

### 26.4 Copie rapide

L’ajout alimentaire doit proposer :

- récents ;
- favoris ;
- repas sauvegardés ;
- copie d’hier.

## 27. Progression et motivation

### 27.0 Program Builder vs Progression

La construction des programmes (UX-3) et le suivi de progression (UX-4) sont des domaines séparés. Ce chapitre couvre `/progress`, `/records` et `/progress/exercises/:id`.

### 27.1 Hub Progression (`/progress`)

`/progress` affiche directement la vue d’ensemble (plus un simple hub à deux cartes). Lien secondaire vers Records.

Structure :

1. header (titre + lien Records) ;
2. chips de période (`1 mois` / `3 mois` / `6 mois` / `1 an` / `Tout`) ;
3. select métrique compact ;
4. tuiles de synthèse (2 colonnes mobile) ;
5. graphique principal (titre métrique + valeur récente + Recharts) ;
6. records récents (lignes compactes) ;
7. exercices les plus travaillés (lignes compactes → détail).

Chiffres importants en `tabular-nums`. Pas de gros selects empilés.

### 27.2 Records (`/records`)

Header motivant + éventuel bloc « Dernier record battu » (compact).

Liste groupée par exercice en lignes :

```text
Charge maximale
100 kg · 8 répétitions · Barre
12 août 2026                              Voir →
```

CTA Voir → `/progress/exercises/:id`. Pas de cards épaisses répétitives.

### 27.3 Détail exercice (`/progress/exercises/:id`)

```text
‹ Progression
Curl avec haltères
Biceps · Haltères
```

Puis : meilleure perf → chips période / métrique → graphique → dernières séances → records → e1RM / coach si déjà présents.

### 27.4 États vides

Progression / Records :

- un titre clair ;
- une phrase utile ;
- CTA principal (programmes) ;
- CTA secondaire discret (historique).

### 27.5 Records (valorisation)

Un record peut être valorisé avec :

- icône ;
- message ;
- comparaison ;
- animation légère.

### 27.6 Pas de culpabilisation

Une baisse de performance doit être présentée de manière neutre.

Exemple :

```text
Performance inférieure à la dernière séance
```

et non :

```text
Tu as régressé
```

### 27.7 Contexte

Lorsque pertinent, rappeler que les performances peuvent varier selon :

- fatigue ;
- exercice précédent ;
- équipement ;
- temps de repos ;
- conditions de séance.

## 27bis. Planning et Historique

Le domaine **Entraînement** se partage entre futur immédiat (Planning) et passé (Historique). Program Builder, Active Workout et Progression restent des surfaces distinctes.

### 27bis.1 Planning (`/planning`)

Répond à : « Qu’est-ce que je dois faire ? »

Structure :

1. `PageHeader` — Planning / Ta semaine d’entraînement ;
2. contexte programme compact (nom + ACTIF + N séances / semaine + Voir →) — **pas** de grosse card « Programme courant » ;
3. bloc **Aujourd’hui** (séance + démarrer, ou ligne légère « Aucune séance prévue ») ;
4. **semaine type** en 7 lignes compactes (`Lun · Pull A >` / `Repos`) ;
5. édition : tap jour → bottom sheet (choix séance / retirer) puis `PUT` replace atomique existant ; lien secondaire « Modifier le planning » pour multi-séances / jour.

Jour actuel identifiable par label « Aujourd’hui » + typo/accent discret, pas uniquement la couleur.

États vides :

- aucun programme actif → CTA principal Programmes ;
- schedule vide → « Planning non configuré » + un seul CTA « Configurer ma semaine ».

Métriques « aujourd’hui » : uniquement `exerciseCount` + durée estimée du contrat schedule (pas de séries inventées).

### 27bis.2 Historique (`/workouts`)

Répond à : « Qu’est-ce que j’ai fait ? »

Structure :

1. `PageHeader` — Historique / Tes séances passées ;
2. barre filtres compacte : chips statut + bouton période (sheet) ;
3. timeline groupée (Aujourd’hui / Hier / mois) en lignes compactes ;
4. empty state utilisateur (pas de jargon snapshots).

Filtres API inchangés (`status`, `from`, `to`). Pagination « Charger plus » conservée.

### 27bis.3 Résumé de séance (`/workouts/:id`)

Header résumé (nom · date · durée · programme/modèle · statut) — pas de dump `Label : valeur`.

Synthèse unique : compteurs utiles (masquer les zéros), barre de progression condensée, liste exercices compacte → séries read-only (`WorkoutSetCard`).

Métadonnées brutes (timestamps, motif, notes) dans une section repliable « Détails ».

Dette connue : une durée écoulée multi-jours peut être lisible mais absurde UX si `completedAt − startedAt` n’est pas une durée d’effort — ne pas « corriger » le métier dans UX-5.

## 28. Coach (UX-8)

Le Coach combine deux systèmes distincts. Ne jamais les mélanger dans une même
carte ou une même phrase d’attribution.

### 28.1 Déterministe vs IA

| | Coach Gym Companion | Explication / Chat IA |
|--|--|--|
| Source | moteurs charge / plateau / résumé | provider facultatif |
| Rôle | recommande, détecte, synthétise | explique, reformule, répond |
| Mutation | décisions apply/ignore hors chat | **aucune** (read-only) |

Ne jamais écrire « L’IA recommande 12,5 kg » si la valeur vient du moteur.

### 28.2 Overview (`/coach`)

- Header + description « Conseils basés sur ton entraînement »
- **À surveiller** : lignes denses (pas de cards) → progression exercice
- Section séparée **Poser une question** (IA) en bas ; soft-disable si `ai.available === false`

### 28.3 Synthèse exercice (progression)

Sections : État · Prochaine séance (kg fort) · Tendance · Explication IA séparée.
Liens secondaires (progression / programme) en lignes.

### 28.4 Recommandation de charge

Valeur forte + contexte. Appliquer / Ignorer explicites.
409 stale → « Cette recommandation a changé depuis son affichage. » + **Actualiser**.
Pas de fingerprint / clientCommandId visibles.

### 28.5 Plateau

Ton prudent : « Stagnation possible », « signal », pas de diagnostic certain.
Section **Tendance**, pas d’alerte dramatique.

### 28.6 Explication IA

Label clair « Explication IA ». Soft state si désactivée.
Loading / erreur isolés — le déterministe reste utilisable.
Mention : « Généré à partir de tes données d’entraînement. »

### 28.7 Chat (`/coach/chat`)

Questions sur l’historique, read-only. Suggestions initiales.
Composer compact + safe-area. Busy : « Coach réfléchit… ».
Rate limit / busy : messages humains (pas de jargon HTTP).
Une réponse `discussion` reste du texte simple ; une réponse `proposal` (jalon 8) s’affiche via la
carte dédiée §28.7bis — jamais de JSON brut ni de CTA « appliquer » sur un message `discussion`.

### 28.7bis Proposition structurée (jalon 8)

Une proposal (programme ou séance) s’affiche dans le fil comme une **carte distincte** du texte de
l’assistant, jamais comme un tableau large ni une modale longue (mobile-first, §7/§9) :

- résumé compact (nom, nombre de séances/exercices) + bouton « Voir le détail » ouvrant une
  **page dédiée ou un bottom sheet** avec la hiérarchie complète (programme → séances → exercices
  → séries cibles) ;
- deux actions explicites : **Accepter** et **Refuser** — jamais d’action silencieuse ni de
  minuteur d’auto-acceptation ;
- une proposal `WORKOUT` (séance seule) ouvre, avant confirmation finale, un sélecteur de
  **programme cible** (une séance appartient toujours à un programme) ;
- l’état (`PENDING` / `ACCEPTÉE` / `REFUSÉE` / `INVALIDE`) est visuellement distinct et persiste
  au rafraîchissement (source : API, jamais déduit localement) ;
- une proposal `INVALIDE` (ex. exercice devenu obsolète) affiche un message clair — pas de code
  d’erreur brut — et retire les CTA d’acceptation ;
- jamais de mention « L’IA a créé… » : le wording reste « L’IA propose… », l’action de création
  appartient explicitement à l’utilisateur (« Tu as créé… » après acceptation).

### 28.8 Style

Pas de violet IA / glow / mascotte. Même DA Performance / Training Log.
Différencier IA par label et wording, pas par une nouvelle identité.

## 29. Confidentialité

### 29.1 Données partagées

Avant une séance partagée, préciser quelles informations seront visibles :

- nom affiché ;
- présence ;
- station ;
- statut ;
- performances selon les paramètres.

### 29.2 Consentement IA

Avant une requête IA, afficher les catégories de données utilisées.

### 29.3 Écran verrouillé

Les notifications doivent rester discrètes par défaut.

## 30. Accessibilité

### 30.1 Standards

Viser au minimum WCAG 2.2 niveau AA pour les parcours principaux.

### 30.2 Navigation clavier

Toutes les actions principales doivent être accessibles au clavier.

### 30.3 Focus

- focus visible ;
- ordre logique ;
- retour du focus après fermeture d’une modale ;
- pas de piège clavier.

### 30.4 Lecteurs d’écran

- titres structurés ;
- labels de formulaire ;
- descriptions des icônes ;
- annonces pour les mises à jour importantes ;
- statut du chronomètre accessible sans annonce chaque seconde.

### 30.5 Contraste

Les textes et éléments interactifs doivent conserver un contraste suffisant.

### 30.6 Taille de texte

L’interface doit rester fonctionnelle avec un agrandissement du texte.

## 31. Responsive desktop

Le desktop permet :

- vues en colonnes ;
- historique plus dense ;
- comparaison de graphiques ;
- édition de programme plus confortable ;
- barre latérale.

Il ne doit pas introduire des fonctionnalités incompatibles avec la version mobile sans justification.

## 32. Composants shadcn/ui envisagés

Composants probables :

- Button ;
- Card ;
- Input ;
- Form ;
- Select ;
- Command ;
- Dialog ;
- AlertDialog ;
- Drawer ;
- Sheet ;
- Tabs ;
- Badge ;
- Progress ;
- DropdownMenu ;
- Tooltip ;
- Toast ou Sonner ;
- Skeleton ;
- Calendar ;
- Popover ;
- Switch ;
- Checkbox ;
- RadioGroup ;
- Slider ;
- Table, principalement desktop.

Les composants doivent être adaptés au besoin métier plutôt qu’utilisés tels quels sans réflexion.

## 33. Design tokens

Le thème doit centraliser :

- couleurs ;
- rayons ;
- ombres ;
- espacements ;
- hauteurs de contrôle ;
- typographie ;
- durées d’animation ;
- niveaux de surface ;
- statuts métier.

Exemples de tokens métier :

```text
status-success
status-partial
status-failed
status-skipped
status-pending
status-offline
status-conflict
```

## 34. Critères de validation UX

Une fonctionnalité mobile est considérée comme exploitable lorsque :

- l’action principale est immédiatement identifiable ;
- aucune donnée essentielle n’est coupée ;
- les zones tactiles sont confortables ;
- le clavier ne masque pas l’action de validation ;
- les erreurs sont compréhensibles ;
- l’état réseau est clair ;
- la navigation arrière ne fait pas perdre de données ;
- l’interface reste utilisable en thème sombre ;
- les actions principales sont accessibles sans précision excessive ;
- les technologies d’assistance peuvent identifier les contrôles.
