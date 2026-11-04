/// <reference types="@figma/plugin-typings" />
import type { RawIssue, ScanContext } from '../scan/context';

export interface Rule {
  id: string;
  /** Types de nodes concernés (filtre rapide). Vide = tous les types collectés. */
  types?: NodeType[];
  /** La règle s'applique aussi aux sous-calques d'instances (sinon ignorés par défaut). */
  insideInstances?: boolean;
  check?: (node: SceneNode, ctx: ScanContext) => Promise<RawIssue[] | void> | RawIssue[] | void;
  finalize?: (ctx: ScanContext) => Promise<RawIssue[] | void> | RawIssue[] | void;
}

/** Transforme une durée Figma (secondes dans l'API Plugin) en millisecondes, de façon défensive. */
export function toMs(duration: number): number {
  return Math.round(duration < 10 ? duration * 1000 : duration);
}
