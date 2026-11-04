# Senior Check Design

> Audit local, déterministe et gratuit de vos fichiers Figma : tokens, typographie, espacement, composants, accessibilité, craft et handoff. Sans IA, sans backend, sans plan Organization.

**Check designs** de Figma (réservé aux plans Organization/Enterprise) vérifie la dérive par rapport aux tokens. **Senior Check Design** couvre ce socle pour tout le monde, puis va plus loin : il répond à « ce design est-il cohérent, accessible, maintenable et prêt à être développé ? ».

## Installation (développement)

```bash
npm install
npm run build
```

Puis dans Figma Desktop : **Plugins → Development → Import plugin from manifest…** et choisir `manifest.json`.

Le manifeste déclare la permission `teamlibrary` : elle est nécessaire pour lire les variables des librairies activées dans le fichier. Sans elle (c'est le cas du chargeur « plugin génératif », dont le manifeste est figé), seules les variables locales sont utilisées et un avertissement l'explique.

Pour développer avec rebuild automatique :

```bash
npm run watch
```

Vérification complète (typecheck sandbox + UI, tests unitaires, build) :

```bash
npm run check
```

## Ce que le plugin fait

### Parcours (calqué sur « Check designs », puis étendu)

L'interface reprend la modale **Check designs** de Figma, puis l'étend :

- **Fenêtre unique** : l'analyse démarre à l'ouverture sur la sélection (sinon la page active). « Relancer » refait l'analyse sur la sélection courante ; un bandeau signale quand la sélection a changé.
- **Onglets** : *Couleurs · Dimensions · Typo · Composants* (les quatre onglets de Check designs), puis après un séparateur l'extension senior *Craft · A11y · Handoff*. Chaque onglet porte son compteur ; l'onglet ouvert est le premier qui contient des suggestions.
- **Lignes groupées par contexte** (« Frame › Fill », « Texte › Contraste », « Frame › Padding »…) : à gauche la valeur actuelle (pastille + valeur, nombre de calques concernés), à droite la suggestion avec badge **Match** (correspondance exacte), **Proche**, **Ambigu** ou **Manuel**, et un menu déroulant pour choisir une autre correspondance.
- **Sélection** : clic (recentre aussi le canvas sur les calques), Cmd/Ctrl-clic, Shift-clic, clic sur l'en-tête de section, `Cmd/Ctrl+A`.
- **Pied de page** : « Mettre à jour N couleurs sur M calques » et **Appliquer**. Sans sélection, le réglage **Appliquer sans sélection** décide de ce qui est inclus : *Exactes* (défaut), *+ proches* ou *Toutes* (ambiguës comprises, première proposition). Quand des correspondances proches sont exclues, un lien « Inclure N proches » les ajoute en un clic ; une sélection explicite reste toujours possible.
- **Comparer avant / après** (icône dans l'en-tête, raccourci `C`, fermé par défaut) : un volet s'ouvre à droite de la liste avec un canvas zoomable (molette pour déplacer, Ctrl/⌘ + molette ou pincement pour zoomer, double-clic pour ajuster, `0`/`1`/`+`/`-` au clavier). Trois modes, comme la comparaison du Dev Mode : **Côte à côte**, **Superposition** avec curseur d'opacité, **Différences** (pixels modifiés en magenta, pourcentage dans le pied du volet). L'aperçu reflète exactement ce que « Appliquer » ferait (lignes sélectionnées, sinon mode automatique) et se met à jour quand la sélection, l'onglet ou l'alternative choisie change. **Par défaut, il rend l'élément sélectionné sur le canvas** (un clic sur une ligne sélectionne ses calques, donc les montre) ; sans sélection, il rend les cadres racines des calques concernés. Le sélecteur du volet liste la sélection puis les cadres concernés, avec le nombre de corrections dans chacun, et permet de revenir à la sélection ; le réglage « Comparer : suivre l'élément sélectionné » désactive ce suivi. Techniquement, l'élément est cloné (ou son instance / composant englobant, un clone ne pouvant vivre dans une instance), déplacé hors écran sur sa page avec les mêmes modes de variables, les corrections sont appliquées sur le clone, les deux états sont exportés en PNG puis le clone est supprimé : le fichier n'est jamais modifié par l'aperçu.
- **Fenêtre** : « Voir dans le canvas » recadre la vue en tenant compte de la position de la fenêtre du plugin (`figma.ui.getPosition`) pour que le calque reste visible à côté d'elle, en dézoomant si besoin. La fenêtre se redimensionne par le bord droit, le bord bas ou le coin (la taille est mémorisée ; avec le volet ouvert, c'est lui qui s'élargit) et se replie sur son en-tête d'un clic (chevron) pour libérer le canvas.
- **Bouton contraste** (dans la barre d'onglets, comme Check designs) : affiche ou masque les suggestions de contraste dans l'onglet Couleurs ; le niveau AA/AAA se règle dans les réglages.
- **Réglages** (icône curseurs) : périmètre, preset, niveau de contraste, nombre de calques par ligne, librairies, options d'analyse, règles, langue. Les changements relancent l'analyse.
- **Détails** (ⓘ) : explication pédagogique de chaque ligne (message, pourquoi, que faire, calques concernés), avec « Voir dans le canvas » et « Ignorer ».
- **Ce qui dépasse Check designs** : score Design Health dans l'en-tête, sévérités, trois onglets supplémentaires, export Markdown/CSV, annulation par toast en plus de `Cmd/Ctrl+Z`, thème clair/sombre et FR/EN.

### Mode Classique / Pro (V2)

Signature de cette version : **Senior Check Design v2.0 by Ivan'Smart** (visible dans « À propos », en info-bulle du titre et en tête des exports).

Un commutateur **Classique · Pro** dans l'en-tête choisit le niveau d'exigence. **Classique** est l'audit de référence décrit ci-dessus. **Pro** active le vrai « Senior Check » : 36 règles supplémentaires, un onglet **Tokens**, le score **Craft Readiness**, des exports et des règles d'équipe. En mode Classique, les règles Pro sont ignorées même si un preset les liste ; le choix est mémorisé.

Ce que Pro ajoute, catégorie par catégorie (toutes les règles restent déterministes et locales) :

| Catégorie | Règles Pro |
| :-- | :-- |
| Tokens (onglet dédié) | alias cassé, alias circulaire, token jamais utilisé (périmètre fichier), tokens de même valeur, token primitif utilisé directement (suggère le sémantique de même valeur), mode non couvert, token sans scope |
| Typographie | styles quasi identiques, ligne trop longue, interligne incohérent (fix), casse de libellé incohérente |
| Dimensions | rythme presque identique (fix du gap), dimension fixe à passer en Fill ou en Hug (fix), textes qui se chevauchent |
| Composants | **rattachement des instances détachées** (voir ci-dessous), composant obsolète utilisé, variante jamais utilisée, conteneur sans rôle, composant sans lien de documentation, composant sans statut |
| Craft | état de succès manquant, action destructive sans confirmation ni annulation, erreur sans issue, message d'erreur générique, état en double, matrice d'états réduite, easing incohérent (fix), transition trop longue (fix), survol sans retour |
| Accessibilité | niveau de titre sauté, contraste d'icône et de bordure de champ (3:1), bouton icône sans libellé, statut porté par la couleur seule |
| Handoff | motif répété non composantisé, image recadrée à la main |

Les règles qui ne peuvent pas conclure sans convention (statut, lien de doc, scopes, modes) ne s'activent que si le fichier pratique déjà cette convention : elles signalent les écarts, pas l'absence de politique.

**Rattachement des instances détachées.** En mode Pro, une instance détachée n'est plus seulement signalée : le plugin retrouve le composant d'origine (local ou de librairie), compare l'arbre du calque détaché avec celui de chaque variante, et propose la variante qui reproduit le contenu avec le moins d'overrides. Au rattachement, l'instance est insérée à la même place, avec la même géométrie, puis les différences sont reportées automatiquement : textes, calques masqués ou renommés, opacité, remplissages et contours, police ou style de texte, échange d'instances imbriquées locales ; un calque présent dans le composant mais supprimé dans le détaché est simplement masqué. Sans aucune différence, la correction est « sûre » et incluse dans « Appliquer » ; avec des overrides elle est « proche » (à sélectionner ou à inclure). Quand la structure a divergé (calque ajouté à la main, police mixte), la ligne est marquée **Divergent** et n'est jamais appliquée sans consentement : le plugin propose un rattachement « rendu conservé », où l'instance reçoit les overrides reproductibles et les calques ajoutés restent au-dessus d'elle, à leur position exacte, dans un cadre qui porte le nom du calque d'origine. Le consentement se donne par ligne (« Inclure quand même » dans les détails, ou en sélectionnant la ligne) ou en bloc (lien « Inclure N divergentes » du pied de page, ou case des réglages Pro) ; avec l'option globale, chaque ligne reste retirable individuellement (« Incluse · retirer »). Ce choix est sensible : il n'est jamais mémorisé et repart décoché à chaque analyse et à chaque lancement. Dans tous les cas rien n'est modifié avant « Appliquer » ; le volet Comparer permet de juger le rendu avant.

**Composants recréés à la main.** La règle `components/lookalike-frame` (Pro) repère un cadre qui ressemble à un composant local sans en être une instance, même sans trace de détachement, avec des noms et une structure différents. La ressemblance est estimée sur les propriétés qui font le rendu (taille, fond, contour, rayons, mise en page, types d'enfants, couleurs et polices du contenu), pas sur les pixels : c'est déterministe et immédiat, et la ligne est marquée **Ressemblance** avec le score. Elle suit le même consentement que les divergentes (« Inclure quand même », lien du pied de page) et le même remplacement « rendu conservé ». Quand deux familles de composants obtiennent un score quasi égal (deux jeux visuellement identiques), le nom le plus proche du cadre l'emporte et l'autre famille reste proposée dans le menu de la ligne. Limites : composants locaux seulement (page courante en périmètre sélection ou page, tout le fichier en périmètre fichier) et cadres de moins de 1200 px de côté.

**Application en lot.** Chaque rattachement recalcule la correspondance sur l'état courant du calque au moment d'appliquer, et un lot s'applique dans un ordre sûr : d'abord les corrections de valeurs (couleurs, styles, tailles), puis les rattachements du plus profond au moins profond. Un calque n'est donc jamais remplacé avant ses propres corrections, et un parent rattaché retrouve ses enfants déjà rattachés. Le volet Comparer applique le même ordre sur ses clones.

**Règles : « Tout cocher ».** En tête de la liste des règles (réglages), une case « Tout cocher » active toutes les règles du mode en un clic ; la décocher revient aux règles du preset, le minimum pour avoir des résultats par défaut. Quand seule une partie des règles supplémentaires est cochée, la case est indéterminée.

**Thèmes.** Le plugin suit le thème choisi dans Figma ; le réglage « Thème du plugin » permet de forcer le clair ou le sombre. Le volet Comparer a son propre sélecteur (Auto, Clair, Sombre) : par défaut il suit le plugin, et l'on peut le passer en clair pour mieux lire certains composants sans changer le reste de l'interface, puis revenir à Auto. L'annulation par toast rend un calque détaché équivalent ; `Cmd/Ctrl + Z` restaure l'original à l'identique.

Fonctions Pro transverses :

- **Craft Readiness** : second score dans l'en-tête, séparé du Design Health, sur quatre axes (états interactifs 50, feedback 20, récupération 15, motion 15), rapporté au nombre de composants interactifs du périmètre.
- **Preset Preflight** : avant publication d'une librairie (tokens, composants, craft, handoff, contrastes).
- **Exports** : résumé de revue en Markdown pour un lead ou un PO, variables locales en JSON DTCG, en custom properties CSS (un bloc par mode) et en `theme.extend` Tailwind.
- **Règles d'équipe** : export et import d'un fichier JSON (mode, preset, règles activées ou désactivées, options) pour partager le même niveau d'exigence.
- **Simulation de vision** dans le volet Comparer : protanopie, deutéranopie, tritanopie, achromatopsie.
- Les lignes qui portent sur une variable ou un style (plutôt qu'un calque) s'affichent avec leur propre type ; « Voir dans le canvas » renvoie alors vers le panneau Variables.

### Presets

| Preset | Objectif |
| :-- | :-- |
| Quick check | Nettoyage rapide avant review |
| Handoff | Fichier prêt pour le dev |
| Design system | Santé de la librairie |
| Accessibilité | Contraste, cibles tactiles, états |
| Product Craft | États, feedback, motion |
| Preflight (Pro) | Avant publication d'une librairie : tokens, composants, craft, handoff, contrastes |
| Strict | Audit senior complet (toutes les règles) |

Chaque règle peut être activée/désactivée par rapport au preset ; les réglages sont mémorisés (`clientStorage`). Les issues ignorées sont stockées **dans le fichier** (`setPluginData`) et donc partagées avec l'équipe.

### Règles (V1)

| Catégorie | Règle | Fix |
| :-- | :-- | :-- |
| Couleurs | `colors/hardcoded-fill`, `colors/hardcoded-stroke` : couleur non liée ; correspondance exacte (safe), proche/ambiguë (review), aucune | Lier à la variable / appliquer le style |
| Typographie | `typography/no-text-style` (style exact → safe), `typography/mixed-styles`, `typography/off-scale-size` | Appliquer le Text Style |
| Espacement | `spacing/off-scale-padding`, `spacing/off-scale-gap` : tokens d'espacement ou grille de base 4/8 px | Lier à la variable |
| Radius | `radius/not-tokenized` (uniquement si des tokens de radius existent) | Lier à la variable |
| Composants | `components/detached-instance`, `components/default-name`, `components/heavy-overrides`, `components/duplicate-component`, `components/no-description` | aucune |
| Craft | `craft/missing-state` (hover, pressed, focus, disabled, error, selected selon le genre de composant), `craft/missing-loading-state`, `craft/missing-empty-state`, `craft/state-naming`, `craft/missing-hover-transition`, `craft/inconsistent-motion` | Harmoniser la durée (review) |
| A11y | `a11y/text-contrast` (WCAG AA, texte normal/large, fond composé), `a11y/contrast-not-verifiable`, `a11y/touch-target` (WCAG 2.5.8), `a11y/text-too-small` | Token conforme le plus proche (review) |
| Handoff | `handoff/fractional-size`, `handoff/fractional-position`, `handoff/stackable-without-autolayout` | Arrondir |

Niveaux de confiance des correspondances : **exact** (fix sûr), **close** et **ambiguous** (à valider, alternatives proposées), **none** (manuel). Le plugin n'applique jamais automatiquement une correspondance ambiguë et affiche « non vérifiable » plutôt qu'un faux résultat de contraste.

### Ce qu'il ne fait pas (volontairement)

- Pas d'IA, pas de réseau (`networkAccess: none`), pas de télémétrie.
- Pas d'analyse multi-fichiers (l'API Plugin est limitée au fichier ouvert).
- Pas d'écriture dans les librairies externes : on lie, on ne modifie pas la lib.
- Pas de certification WCAG : aide à l'audit, pas un label.
- Pas de jugement esthétique du motion : uniquement des incohérences mesurables.

## Architecture

```
manifest.json                documentAccess: dynamic-page, networkAccess: none
src/shared/                  code pur, partagé sandbox ↔ UI, testé avec node:test
  types.ts                   Issue, Settings, messages
  rules-catalog.ts           catalogue déclaratif des règles + presets
  color.ts                   hex/Lab/ΔE, contraste WCAG, composition alpha
  scale.ts                   exact / close / ambiguous / none
  names.ts                   noms par défaut, vocabulaire d'états, genre de composant
  score.ts                   Design Health
  report.ts                  export Markdown / CSV
src/plugin/                  sandbox Figma (dist/code.js)
  main.ts                    showUI, messages, settings, undo par lot
  scan/context.ts            index des variables (locales + librairies), styles
  scan/node-info.ts          ancêtres, visibilité effective, fond effectif
  scan/engine.ts             périmètre, collecte (findAllWithCriteria), lots, règles agrégées
  rules/*.ts                 une famille de règles par fichier
  fix/apply.ts               application des plans + closures d'annulation
src/ui/                      iframe (dist/ui.html, tout inliné)
  app.ts                     état, 3 écrans, détail, toasts, clavier, redimensionnement
  i18n.ts                    FR / EN (UI + copie pédagogique de chaque règle)
  styles.css                 variables de thème Figma, système de motion
```

### Principes d'implémentation

- **`findAllWithCriteria`** par type de node (indexé, bien plus rapide que `findAll`) ; parcours par lots de 120 avec `setTimeout(0)` pour garder Figma réactif ; annulation entre deux lots ; résultats partiels exploitables.
- **Instances** : par défaut, l'intérieur des instances n'est pas audité (les valeurs viennent du composant), sauf pour les règles d'accessibilité.
- **Variables de librairie** : lues via `teamLibrary` + `importVariableByKeyAsync` (plafond 800), avec avertissement explicite si une librairie est illisible.
- **Styles distants déjà utilisés** dans le fichier : appris à la volée (`getStyleByIdAsync`) pour pouvoir les suggérer.
- **Undo** : chaque fix retourne une closure de restauration exacte (fills, bindings, style + propriétés texte, taille, position, réactions) ; `commitUndo()` avant chaque lot.
- **UI** : vanilla TypeScript, thème Figma (`themeColors: true`), chiffres tabulaires, navigation clavier (`↑↓`, `↵`, `F`, `V`, `/`, `Esc`), `prefers-reduced-motion` respecté.

### Fidélité visuelle

Les métriques de l'interface sont relevées sur la capture officielle de Check designs (image 2x de la doc Figma) : header 40 px, barre d'onglets 40 px, onglets 24 px à rayon 5 px avec pastille de compteur 16 px, lignes de 24 px espacées de 8 px, cellules à rayon 5 px et padding 6 px, pastille couleur 14 px à rayon 2 px avec bordure `rgba(0,0,0,.1)`, flèche 9 px `#B2B2B2` centrée dans un espace de 32 px, badge Match 14 px (`#009951` sur bordure `#B9EBC6`), chevron 16 px, footer 40 px avec bouton 24 px et compteur sur fond `rgba(0,0,0,.2)`, texte Inter 11 px (titre et onglet actif en 600). Les couleurs passent par les variables de thème Figma (`themeColors: true`) avec ces valeurs en repli, d'où un rendu identique en clair et correct en sombre. La fenêtre fait 680 px par défaut pour loger les sept onglets (la modale de Figma en a quatre sur 480 px).

## Test d'intégration sur un vrai fichier

`src/plugin/headless.ts` expose le moteur (sans UI) sur un global `SCD`. `npm run build:headless` produit `dist/headless.min.js`, exécutable dans le contexte Plugin API d'un fichier Figma (par exemple via le MCP Figma `use_figma`) :

```js
// … contenu de dist/headless.min.js …
const out = await SCD.runScan(
  { scope: 'page', options: SCD.DEFAULT_OPTIONS, activeRules: SCD.resolveActiveRules('strict', [], []), ignoredIssueIds: new Set() },
  () => {}, () => false,
);
const entry = await SCD.applyPlan(out.result.issues[0].id, out.plans.get(out.result.issues[0].id).plan);
await entry.revert();
```

Ce test a été exécuté sur un fichier de fixture (tokens couleur/espacement/radius, text styles, carte avec valeurs codées en dur, component sets `State=Default/Hover` avec transitions 400 ms et 150 ms, instance détachée, texte à faible contraste, valeurs fractionnaires) : 71 issues détectées dans les 8 catégories, et les cinq familles de fix (liaison de couleur, application de Text Style, liaison de padding, arrondi, harmonisation de durée) appliquées puis annulées avec restauration exacte de l'état initial.

## Scripts

| Commande | Rôle |
| :-- | :-- |
| `npm run build` | Bundle sandbox + UI dans `dist/` |
| `npm run watch` | Rebuild à chaque modification |
| `npm run typecheck` | `tsc` sur le sandbox et sur l'UI |
| `npm test` | Tests unitaires de la logique pure |
| `npm run build:headless` | Bundle du moteur seul pour les tests d'intégration |
| `npm run check` | Les trois d'un coup |

## Licence

MIT

## Tester dans Figma sans importer le manifeste

Un chargeur pour « plugin génératif » Figma est fourni dans `tools/figma-generative-plugin/`.
Déployé dans la bibliothèque personnelle d'un compte Figma, il exécute le build `dist/`
du dépôt épinglé sur un commit précis, sans build ni import local. Voir le README de ce dossier.
