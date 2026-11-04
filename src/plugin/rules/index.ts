import { a11yRules } from './a11y';
import { a11yProRules } from './a11y-pro';
import { colorRules } from './colors';
import { componentRules } from './components';
import { componentProRules } from './components-pro';
import { craftRules } from './craft';
import { craftProRules } from './craft-pro';
import { handoffRules } from './handoff';
import { handoffProRules } from './handoff-pro';
import { layoutProRules } from './layout-pro';
import { radiusRules, spacingRules } from './spacing';
import { tokenRules } from './tokens';
import type { Rule } from './types';
import { typographyRules } from './typography';
import { typographyProRules } from './typography-pro';

export const ALL_RULES: Rule[] = [
  ...colorRules,
  ...typographyRules,
  ...typographyProRules,
  ...spacingRules,
  ...layoutProRules,
  ...radiusRules,
  ...componentRules,
  ...componentProRules,
  ...tokenRules,
  ...craftRules,
  ...craftProRules,
  ...a11yRules,
  ...a11yProRules,
  ...handoffRules,
  ...handoffProRules,
];
