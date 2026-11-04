/// <reference types="@figma/plugin-typings" />
/**
 * Entrée "headless" réduite : expose l'aperçu avant/après pour un test
 * d'intégration via use_figma (le bundle complet dépasse la limite de taille).
 */
import { applyPlan } from './fix/apply';
import { renderPreview, sweepPreviewClones } from './preview';

(globalThis as unknown as { SCDP: unknown }).SCDP = { renderPreview, sweepPreviewClones, applyPlan };
