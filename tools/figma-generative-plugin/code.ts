// Senior Check Design : chargeur.
//
// Ce plugin exécute le build versionné du dépôt GitHub ivansmart/senior-check-design
// (dossier dist/), épinglé sur un commit précis. L'interface (dist/ui.html) télécharge
// les deux fichiers du build depuis jsDelivr, puis les transmet ici : le moteur tourne
// dans ce bac à sable et affiche sa propre interface. Aucune donnée du fichier Figma
// ne quitte Figma : seul le code du plugin est téléchargé.

const BUILD_COMMIT = '1787885abe4026acc3598848872a8e551b146a5a'
const BUILD_BASE = 'https://cdn.jsdelivr.net/gh/ivansmart/senior-check-design@' + BUILD_COMMIT + '/dist/'

type LoaderMessage =
  | { type: 'loader-ready' }
  | { type: 'boot'; code: string; html: string }
  | { type: 'boot-failed'; message: string }

figma.showUI(__html__, { width: 680, height: 640, themeColors: true })

figma.ui.onmessage = (message: LoaderMessage) => {
  if (!message || typeof message !== 'object') return

  if (message.type === 'loader-ready') {
    figma.ui.postMessage({ type: 'loader-config', base: BUILD_BASE })
    return
  }

  if (message.type === 'boot') {
    try {
      // dist/code.js est une IIFE : elle installe son propre figma.ui.onmessage puis
      // appelle figma.showUI(__html__, …) avec l'interface réelle du plugin.
      const run = new Function('__html__', message.code) as (html: string) => void
      run(message.html)
    } catch (error) {
      figma.ui.postMessage({ type: 'boot-error', message: String(error) })
    }
    return
  }

  if (message.type === 'boot-failed') {
    figma.notify('Senior Check Design : chargement impossible. ' + message.message, { error: true, timeout: 6000 })
  }
}
