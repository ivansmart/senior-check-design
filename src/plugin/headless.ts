/// <reference types="@figma/plugin-typings" />
/**
 * Entrée "headless" : expose le moteur sur un global pour l'exécuter dans un
 * contexte Plugin API sans UI (tests d'intégration via use_figma).
 */
import { resolveActiveRules } from '../shared/rules-catalog';
import { DEFAULT_OPTIONS } from '../shared/types';
import { applyPlan } from './fix/apply';
import { ALL_RULES } from './rules';
import { runScan } from './scan/engine';

(globalThis as unknown as { SCD: unknown }).SCD = { runScan, applyPlan, resolveActiveRules, DEFAULT_OPTIONS, ALL_RULES };
