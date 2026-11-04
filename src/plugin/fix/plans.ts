/// <reference types="@figma/plugin-typings" />

/** Plans de correction : sérialisables, exécutés par apply.ts. */
export type FixPlan =
  | { kind: 'bind-paint-variable'; nodeId: string; prop: 'fills' | 'strokes'; index: number; variableId: string }
  | { kind: 'apply-paint-style'; nodeId: string; prop: 'fills' | 'strokes'; styleId: string }
  | { kind: 'apply-text-style'; nodeId: string; styleId: string }
  | { kind: 'bind-number'; nodeId: string; fields: VariableBindableNodeField[]; variableId: string }
  | { kind: 'round-size'; nodeId: string }
  | { kind: 'round-position'; nodeId: string }
  | { kind: 'set-hover-duration'; nodeId: string; durationMs: number };
