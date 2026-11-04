import { a11yRules } from './a11y';
import { colorRules } from './colors';
import { componentRules } from './components';
import { craftRules } from './craft';
import { handoffRules } from './handoff';
import { radiusRules, spacingRules } from './spacing';
import type { Rule } from './types';
import { typographyRules } from './typography';

export const ALL_RULES: Rule[] = [
  ...colorRules,
  ...typographyRules,
  ...spacingRules,
  ...radiusRules,
  ...componentRules,
  ...craftRules,
  ...a11yRules,
  ...handoffRules,
];
