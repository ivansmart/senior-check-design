# Chargeur pour « plugin génératif » Figma

Ces deux fichiers permettent d'exécuter Senior Check Design dans Figma **sans importer
le manifeste** : ils sont déployés comme un plugin génératif (bibliothèque personnelle
Figma) et chargent le build versionné `dist/` du dépôt depuis jsDelivr, épinglé sur un
commit précis (`BUILD_COMMIT` dans `code.ts`).

- `code.ts` : s'exécute dans le bac à sable du plugin. Il affiche `ui.html`, reçoit le
  contenu de `dist/code.js` et `dist/ui.html`, puis exécute le bundle du moteur, qui
  remplace l'interface par celle du plugin.
- `ui.html` : écran de chargement. Il télécharge les deux fichiers du build et les
  transmet au bac à sable. En cas d'échec, il affiche l'erreur et un bouton « Réessayer ».

Seul le code du plugin transite par le réseau ; aucune donnée du fichier Figma ne sort
de Figma. Le plugin « officiel » (import du `manifest.json`) reste, lui, strictement
hors ligne (`networkAccess: none`).

Pour mettre à jour le déploiement : changer `BUILD_COMMIT` après avoir poussé un nouveau
build dans `dist/`, puis renvoyer `code.ts` (et `ui.html` s'il a changé) via
`update_generative_plugin` du MCP Figma.
