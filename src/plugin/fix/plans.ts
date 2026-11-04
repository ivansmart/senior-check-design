/// <reference types="@figma/plugin-typings" />

/** Plans de correction : sérialisables, exécutés par apply.ts. */
export type FixPlan =
  | { kind: 'bind-paint-variable'; nodeId: string; prop: 'fills' | 'strokes'; index: number; variableId: string }
  | { kind: 'apply-paint-style'; nodeId: string; prop: 'fills' | 'strokes'; styleId: string }
  | { kind: 'apply-text-style'; nodeId: string; styleId: string }
  | { kind: 'bind-number'; nodeId: string; fields: VariableBindableNodeField[]; variableId: string }
  | { kind: 'round-size'; nodeId: string }
  | { kind: 'round-position'; nodeId: string }
  | { kind: 'set-hover-duration'; nodeId: string; durationMs: number }
  // Pro
  | { kind: 'set-number'; nodeId: string; field: 'itemSpacing' | 'counterAxisSpacing' | 'paddingLeft' | 'paddingRight' | 'paddingTop' | 'paddingBottom'; value: number }
  | { kind: 'set-line-height'; nodeId: string; px: number }
  | { kind: 'set-layout-sizing'; nodeId: string; axis: 'horizontal' | 'vertical'; value: 'FILL' | 'HUG' | 'FIXED' }
  | { kind: 'set-axis-sizing'; nodeId: string; axis: 'primary' | 'counter'; value: 'AUTO' | 'FIXED' }
  | { kind: 'set-hover-easing'; nodeId: string; easing: string }
  | { kind: 'cap-transition-duration'; nodeId: string; maxMs: number };
