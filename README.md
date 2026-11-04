# Senior Check Design

> Audit local, déterministe et gratuit de vos fichiers Figma — tokens, typographie, espacement, composants, accessibilité, craft et handoff. Sans IA, sans backend, sans plan Organization.

**Check designs** de Figma (réservé aux plans Organization/Enterprise) vérifie la dérive par rapport aux tokens. **Senior Check Design** couvre ce socle pour tout le monde, puis va plus loin : il répond à « ce design est-il cohérent, accessible, maintenable et prêt à être développé ? ».

## Installation (développement)

```bash
npm install
npm run build
```

Puis dans Figma Desktop : **Plugins → Development → Import plugin from manifest…** et choisir `manifest.json`.

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
- **Pied de page** : « Mettre à jour N couleurs sur M calques » et **Appliquer**. Sans sélection, seules les correspondances exactes sont appliquées ; une sélection explicite permet d'appliquer des correspondances proches ou choisies.
- **Bouton contraste** (dans la barre d'onglets, comme Check designs) : affiche ou masque les suggestions de contraste dans l'onglet Couleurs ; le niveau AA/AAA se règle dans les réglages.
- **Réglages** (icône curseurs) : périmètre, preset, niveau de contraste, nombre de calques par ligne, librairies, options d'analyse, règles, langue. Les changements relancent l'analyse.
- **Détails** (ⓘ) : explication pédagogique de chaque ligne (message, pourquoi, que faire, calques concernés), avec « Voir dans le canvas » et « Ignorer ».
- **Ce qui dépasse Check designs** : score Design Health dans l'en-tête, sévérités, trois onglets supplémentaires, export Markdown/CSV, annulation par toast en plus de `Cmd/Ctrl+Z`, thème clair/sombre et FR/EN.

### Presets

| Preset | Objectif |
| :-- | :-- |
| Quick check | Nettoyage rapide avant review |
| Handoff | Fichier prêt pour le dev |
| Design system | Santé de la librairie |
| Accessibilité | Contraste, cibles tactiles, états |
| Product Craft | États, feedback, motion |
| Strict | Audit senior complet (toutes les règles) |

Chaque règle peut être activée/désactivée par rapport au preset ; les réglages sont mémorisés (`clientStorage`). Les issues ignorées sont stockées **dans le fichier** (`setPluginData`) et donc partagées avec l'équipe.

### Règles (V1)

| Catégorie | Règle | Fix |
| :-- | :-- | :-- |
| Couleurs | `colors/hardcoded-fill`, `colors/hardcoded-stroke` — couleur non liée ; correspondance exacte (safe), proche/ambiguë (review), aucune | Lier à la variable / appliquer le style |
| Typographie | `typography/no-text-style` (style exact → safe), `typography/mixed-styles`, `typography/off-scale-size` | Appliquer le Text Style |
| Espacement | `spacing/off-scale-padding`, `spacing/off-scale-gap` — tokens d'espacement ou grille de base 4/8 px | Lier à la variable |
| Radius | `radius/not-tokenized` (uniquement si des tokens de radius existent) | Lier à la variable |
| Composants | `components/detached-instance`, `components/default-name`, `components/heavy-overrides`, `components/duplicate-component`, `components/no-description` | — |
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
