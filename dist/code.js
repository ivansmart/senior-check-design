"use strict";
(() => {
  // src/shared/rules-catalog.ts
  var WCAG = "https://www.w3.org/WAI/WCAG22/Understanding/";
  var RULES = [
    // Couleurs
    { id: "colors/hardcoded-fill", category: "colors", severity: "error" },
    { id: "colors/hardcoded-stroke", category: "colors", severity: "error" },
    // Typographie
    { id: "typography/no-text-style", category: "typography", severity: "error" },
    { id: "typography/mixed-styles", category: "typography", severity: "info" },
    { id: "typography/off-scale-size", category: "typography", severity: "warning" },
    { id: "typography/near-duplicate-styles", category: "typography", severity: "info", aggregate: true, tier: "pro" },
    { id: "typography/line-length", category: "typography", severity: "info", tier: "pro" },
    { id: "typography/line-height-inconsistent", category: "typography", severity: "warning", aggregate: true, tier: "pro" },
    { id: "typography/label-case", category: "typography", severity: "info", aggregate: true, tier: "pro" },
    // Espacement et layout
    { id: "spacing/off-scale-padding", category: "spacing", severity: "warning" },
    { id: "spacing/off-scale-gap", category: "spacing", severity: "warning" },
    { id: "spacing/rhythm-near-miss", category: "spacing", severity: "info", aggregate: true, tier: "pro" },
    { id: "spacing/fixed-should-fill", category: "spacing", severity: "warning", tier: "pro" },
    { id: "spacing/fixed-should-hug", category: "spacing", severity: "info", tier: "pro" },
    { id: "spacing/text-overlap", category: "spacing", severity: "warning", tier: "pro" },
    // Radius
    { id: "radius/not-tokenized", category: "radius", severity: "warning" },
    // Composants
    { id: "components/detached-instance", category: "components", severity: "warning" },
    { id: "components/default-name", category: "components", severity: "info" },
    { id: "components/heavy-overrides", category: "components", severity: "info" },
    { id: "components/duplicate-component", category: "components", severity: "info", aggregate: true },
    { id: "components/no-description", category: "components", severity: "info" },
    { id: "components/deprecated-in-use", category: "components", severity: "warning", tier: "pro" },
    { id: "components/orphan-variant", category: "components", severity: "info", aggregate: true, tier: "pro" },
    { id: "components/useless-nesting", category: "components", severity: "info", tier: "pro" },
    { id: "components/no-doc-link", category: "components", severity: "info", aggregate: true, tier: "pro" },
    { id: "components/no-status", category: "components", severity: "info", aggregate: true, tier: "pro" },
    // Architecture des tokens (Pro)
    { id: "tokens/broken-alias", category: "tokens", severity: "error", aggregate: true, tier: "pro" },
    { id: "tokens/circular-alias", category: "tokens", severity: "error", aggregate: true, tier: "pro" },
    { id: "tokens/orphan", category: "tokens", severity: "info", aggregate: true, tier: "pro" },
    { id: "tokens/duplicate-value", category: "tokens", severity: "info", aggregate: true, tier: "pro" },
    { id: "tokens/primitive-bound", category: "tokens", severity: "warning", tier: "pro" },
    { id: "tokens/mode-gap", category: "tokens", severity: "info", aggregate: true, tier: "pro" },
    { id: "tokens/unscoped", category: "tokens", severity: "info", aggregate: true, tier: "pro" },
    // Craft & interaction
    { id: "craft/missing-state", category: "craft", severity: "warning" },
    { id: "craft/missing-loading-state", category: "craft", severity: "warning" },
    { id: "craft/missing-empty-state", category: "craft", severity: "warning" },
    { id: "craft/state-naming", category: "craft", severity: "info", aggregate: true },
    { id: "craft/missing-hover-transition", category: "craft", severity: "info" },
    { id: "craft/inconsistent-motion", category: "craft", severity: "warning", aggregate: true },
    { id: "craft/missing-success-state", category: "craft", severity: "info", tier: "pro" },
    { id: "craft/destructive-without-confirm", category: "craft", severity: "warning", aggregate: true, tier: "pro" },
    { id: "craft/error-without-recovery", category: "craft", severity: "warning", tier: "pro" },
    { id: "craft/generic-error-message", category: "craft", severity: "info", tier: "pro" },
    { id: "craft/duplicate-state", category: "craft", severity: "warning", tier: "pro" },
    { id: "craft/state-matrix-thin", category: "craft", severity: "info", tier: "pro" },
    { id: "craft/inconsistent-easing", category: "craft", severity: "warning", aggregate: true, tier: "pro" },
    { id: "craft/transition-too-long", category: "craft", severity: "warning", tier: "pro" },
    { id: "craft/non-reversible-hover", category: "craft", severity: "warning", tier: "pro" },
    // Accessibilité
    { id: "a11y/text-contrast", category: "a11y", severity: "error", docUrl: `${WCAG}contrast-minimum.html` },
    { id: "a11y/contrast-not-verifiable", category: "a11y", severity: "info" },
    { id: "a11y/touch-target", category: "a11y", severity: "warning", docUrl: `${WCAG}target-size-minimum.html` },
    { id: "a11y/text-too-small", category: "a11y", severity: "info" },
    { id: "a11y/heading-skip", category: "a11y", severity: "info", aggregate: true, tier: "pro", docUrl: `${WCAG}info-and-relationships.html` },
    { id: "a11y/icon-contrast", category: "a11y", severity: "warning", tier: "pro", docUrl: `${WCAG}non-text-contrast.html` },
    { id: "a11y/border-contrast", category: "a11y", severity: "warning", tier: "pro", docUrl: `${WCAG}non-text-contrast.html` },
    { id: "a11y/icon-only-without-label", category: "a11y", severity: "warning", tier: "pro", docUrl: `${WCAG}name-role-value.html` },
    { id: "a11y/color-only-status", category: "a11y", severity: "info", tier: "pro", docUrl: `${WCAG}use-of-color.html` },
    // Handoff
    { id: "handoff/fractional-size", category: "handoff", severity: "info" },
    { id: "handoff/fractional-position", category: "handoff", severity: "info" },
    { id: "handoff/stackable-without-autolayout", category: "handoff", severity: "info" },
    { id: "handoff/repeated-pattern", category: "handoff", severity: "info", tier: "pro" },
    { id: "handoff/image-crop", category: "handoff", severity: "info", tier: "pro" }
  ];
  var RULE_BY_ID = Object.fromEntries(RULES.map((r) => [r.id, r]));
  var ALL_RULE_IDS = RULES.map((r) => r.id);
  var CLASSIC_RULE_IDS = RULES.filter((r) => !r.tier).map((r) => r.id);
  var PRO_RULE_IDS = RULES.filter((r) => r.tier === "pro").map((r) => r.id);
  var byCategory = (...cats) => RULES.filter((r) => cats.includes(r.category)).map((r) => r.id);
  var byPrefix = (...prefixes) => ALL_RULE_IDS.filter((id) => prefixes.some((p) => id.startsWith(p)));
  var unique = (ids) => [...new Set(ids)];
  var PRESETS = {
    quick: [
      "colors/hardcoded-fill",
      "colors/hardcoded-stroke",
      "typography/no-text-style",
      "spacing/off-scale-padding",
      "spacing/off-scale-gap",
      "components/detached-instance",
      "components/default-name"
    ],
    handoff: unique([
      ...byCategory("colors", "typography", "spacing", "radius", "handoff"),
      "components/detached-instance",
      "components/default-name",
      "components/heavy-overrides",
      "components/deprecated-in-use",
      "components/useless-nesting"
    ]),
    "design-system": unique([
      ...byCategory("colors", "typography", "spacing", "radius", "components", "tokens"),
      "craft/state-naming",
      "craft/missing-state",
      "craft/duplicate-state",
      "craft/state-matrix-thin"
    ]),
    a11y: unique([...byCategory("a11y"), "craft/missing-state"]),
    craft: unique([...byCategory("craft"), "a11y/touch-target", "a11y/icon-only-without-label"]),
    preflight: unique([
      ...byCategory("tokens", "components", "craft", "handoff"),
      ...byPrefix("colors/", "radius/"),
      "typography/no-text-style",
      "typography/near-duplicate-styles",
      "typography/line-height-inconsistent",
      "spacing/off-scale-padding",
      "spacing/off-scale-gap",
      "spacing/fixed-should-fill",
      "a11y/text-contrast",
      "a11y/icon-contrast",
      "a11y/touch-target"
    ]),
    strict: ALL_RULE_IDS
  };
  function resolveActiveRules(preset, disabled, enabled, mode = "pro") {
    var _a;
    const set = new Set((_a = PRESETS[preset]) != null ? _a : PRESETS.quick);
    for (const id of enabled) if (RULE_BY_ID[id]) set.add(id);
    for (const id of disabled) set.delete(id);
    if (mode === "classic") for (const id of PRO_RULE_IDS) set.delete(id);
    return set;
  }

  // src/shared/tokens-export.ts
  var segments = (name) => name.split("/").map((s) => s.trim()).filter(Boolean);
  var kebab = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  function findVariable(model, collection, name) {
    const col = model.collections.find((c) => c.name === collection);
    const v = col == null ? void 0 : col.variables.find((x) => x.name === name);
    return col && v ? { col, v } : null;
  }
  function resolveValue(model, col, v, modeId, depth = 0) {
    var _a, _b, _c, _d;
    const value = (_a = v.valuesByMode[modeId]) != null ? _a : v.valuesByMode[col.defaultModeId];
    if (!value) return null;
    if (value.kind !== "alias") return value;
    if (depth > 12) return null;
    const target = findVariable(model, value.collection, value.name);
    if (!target) return null;
    const modeName = (_b = col.modes.find((m) => m.id === modeId)) == null ? void 0 : _b.name;
    const targetMode = (_d = (_c = target.col.modes.find((m) => m.name === modeName)) == null ? void 0 : _c.id) != null ? _d : target.col.defaultModeId;
    return resolveValue(model, target.col, target.v, targetMode, depth + 1);
  }
  function plain(value) {
    switch (value.kind) {
      case "color":
        return value.hex;
      case "number":
        return value.value;
      case "string":
        return value.value;
      case "boolean":
        return value.value;
      case "alias":
        return `{${[kebab(value.collection), ...segments(value.name).map(kebab)].join(".")}}`;
    }
  }
  var dtcgType = (t) => t === "COLOR" ? "color" : t === "FLOAT" ? "number" : t === "STRING" ? "string" : "boolean";
  function toDtcg(model) {
    var _a, _b;
    const root = {};
    for (const col of model.collections) {
      const group = {};
      for (const v of col.variables) {
        let node = group;
        const path = segments(v.name).map(kebab);
        for (const seg of path.slice(0, -1)) {
          node[seg] = (_a = node[seg]) != null ? _a : {};
          node = node[seg];
        }
        const def = v.valuesByMode[col.defaultModeId];
        const token = { $type: dtcgType(v.type), $value: def ? plain(def) : null };
        if (v.description) token.$description = v.description;
        const modes = {};
        for (const m of col.modes) {
          const mv = v.valuesByMode[m.id];
          if (mv) modes[m.name] = plain(mv);
        }
        token.$extensions = { "com.figma": { scopes: v.scopes, ...col.modes.length > 1 ? { modes } : {} } };
        node[(_b = path[path.length - 1]) != null ? _b : kebab(v.name)] = token;
      }
      root[kebab(col.name)] = group;
    }
    return JSON.stringify(root, null, 2) + "\n";
  }
  var cssVar = (collection, name) => `--${kebab(collection)}-${segments(name).map(kebab).join("-")}`;
  function cssValue(value, type) {
    switch (value.kind) {
      case "alias":
        return `var(${cssVar(value.collection, value.name)})`;
      case "number":
        return type === "FLOAT" ? `${value.value}px` : String(value.value);
      case "color":
        return value.hex;
      case "string":
        return JSON.stringify(value.value);
      case "boolean":
        return value.value ? "1" : "0";
    }
  }
  function toCss(model) {
    const lines = [];
    lines.push(":root {");
    for (const col of model.collections) {
      for (const v of col.variables) {
        const value = v.valuesByMode[col.defaultModeId];
        if (value) lines.push(`  ${cssVar(col.name, v.name)}: ${cssValue(value, v.type)};`);
      }
    }
    lines.push("}");
    for (const col of model.collections) {
      for (const mode of col.modes) {
        if (mode.id === col.defaultModeId) continue;
        lines.push("");
        lines.push(`[data-theme="${kebab(mode.name)}"] {`);
        for (const v of col.variables) {
          const value = v.valuesByMode[mode.id];
          if (value) lines.push(`  ${cssVar(col.name, v.name)}: ${cssValue(value, v.type)};`);
        }
        lines.push("}");
      }
    }
    return lines.join("\n") + "\n";
  }
  function setPath(root, path, value) {
    let node = root;
    for (const seg of path.slice(0, -1)) {
      const next = node[seg];
      if (typeof next !== "object" || next === null) node[seg] = {};
      node = node[seg];
    }
    const last = path[path.length - 1];
    if (typeof node[last] === "object") node[last].DEFAULT = value;
    else node[last] = value;
  }
  var tailwindBucket = (v) => {
    const s = new Set(v.scopes);
    if (s.has("CORNER_RADIUS") || /radius|corner|round/i.test(v.name)) return "borderRadius";
    if (s.has("FONT_SIZE") || /font.?size|text.?size|type.?scale/i.test(v.name)) return "fontSize";
    if (s.has("GAP") || s.has("WIDTH_HEIGHT") || /spac|gap|pad|inset|size|grid/i.test(v.name)) return "spacing";
    return "other";
  };
  function toTailwind(model) {
    const colors = {};
    const spacing = {};
    const borderRadius = {};
    const fontSize = {};
    const other = {};
    for (const col of model.collections) {
      for (const v of col.variables) {
        const resolved = resolveValue(model, col, v, col.defaultModeId);
        if (!resolved || resolved.kind === "alias") continue;
        const path = segments(v.name).map(kebab);
        if (v.type === "COLOR" && resolved.kind === "color") {
          setPath(colors, path[0] === "color" || path[0] === "colors" ? path.slice(1) : path, resolved.hex);
        } else if (v.type === "FLOAT" && resolved.kind === "number") {
          const bucket = tailwindBucket(v);
          const target = bucket === "spacing" ? spacing : bucket === "borderRadius" ? borderRadius : bucket === "fontSize" ? fontSize : other;
          setPath(target, [path.slice(1).join("-") || path[0]], `${resolved.value}px`);
        }
      }
    }
    const extend = {};
    if (Object.keys(colors).length) extend.colors = colors;
    if (Object.keys(spacing).length) extend.spacing = spacing;
    if (Object.keys(borderRadius).length) extend.borderRadius = borderRadius;
    if (Object.keys(fontSize).length) extend.fontSize = fontSize;
    if (Object.keys(other).length) extend.figmaNumbers = other;
    return `/** G\xE9n\xE9r\xE9 par Senior Check Design \xE0 partir des variables Figma locales. */
module.exports = {
  theme: {
    extend: ${JSON.stringify(extend, null, 2).replace(/\n/g, "\n    ")},
  },
};
`;
  }
  function countVariables(model) {
    return model.collections.reduce((n, c) => n + c.variables.length, 0);
  }

  // src/shared/types.ts
  var DEFAULT_OPTIONS = {
    ignoreHidden: true,
    ignoreLocked: true,
    scanInsideInstances: false,
    includeLibraries: true,
    baseGrid: 4,
    spacingTolerance: 2,
    minTouchTarget: 24,
    minFontSize: 12,
    contrastLevel: "AA"
  };
  var DEFAULT_SETTINGS = {
    locale: "fr",
    mode: "classic",
    preset: "quick",
    scope: "auto",
    options: DEFAULT_OPTIONS,
    showRowCounts: true,
    showContrast: true,
    disabledRules: [],
    enabledRules: [],
    autoApply: "exact",
    compareFollowsSelection: true,
    window: { width: 680, height: 640 }
  };

  // src/shared/color.ts
  var clamp01 = (v) => Math.min(1, Math.max(0, v));
  function rgbToHex(c, alpha) {
    const to = (v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, "0").toUpperCase();
    const base = `#${to(c.r)}${to(c.g)}${to(c.b)}`;
    if (alpha !== void 0 && alpha < 0.999) return `${base}${to(alpha)}`;
    return base;
  }
  function colorKey(c, alpha = 1) {
    return rgbToHex(c) + "@" + Math.round(clamp01(alpha) * 100);
  }
  function srgbToLinear(v) {
    v = clamp01(v);
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  function rgbToLab(c) {
    const r = srgbToLinear(c.r);
    const g = srgbToLinear(c.g);
    const b = srgbToLinear(c.b);
    let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
    let y = (r * 0.2126729 + g * 0.7151522 + b * 0.072175) / 1;
    let z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
    const f = (t) => t > 8856e-6 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    x = f(x);
    y = f(y);
    z = f(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  function deltaE(a, b) {
    const [l1, a1, b1] = rgbToLab(a);
    const [l2, a2, b2] = rgbToLab(b);
    return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
  }
  function relativeLuminance(c) {
    return 0.2126 * srgbToLinear(c.r) + 0.7152 * srgbToLinear(c.g) + 0.0722 * srgbToLinear(c.b);
  }
  function contrastRatio(fg, bg) {
    const l1 = relativeLuminance(fg);
    const l2 = relativeLuminance(bg);
    const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
    return (hi + 0.05) / (lo + 0.05);
  }
  function composite(fg, alpha, bg) {
    const a = clamp01(alpha);
    return {
      r: fg.r * a + bg.r * (1 - a),
      g: fg.g * a + bg.g * (1 - a),
      b: fg.b * a + bg.b * (1 - a)
    };
  }
  function isLargeText(fontSize, bold) {
    return fontSize >= 24 || bold && fontSize >= 18.66;
  }
  function evaluateContrast(ratio, large) {
    const aa = large ? 3 : 4.5;
    const aaa = large ? 4.5 : 7;
    const passesAA = ratio >= aa;
    const passesAAA = ratio >= aaa;
    const level = passesAAA ? "AAA" : passesAA ? large ? "AA-large" : "AA" : "fail";
    return { level, passesAA, passesAAA };
  }
  function formatRatio(ratio) {
    return `${(Math.round(ratio * 100) / 100).toFixed(2).replace(/\.?0+$/, "")}:1`;
  }
  function isBoldStyle(style) {
    return /bold|black|heavy|extra\s*bold|semi\s*bold|demi|700|800|900/i.test(style);
  }

  // src/plugin/export/tokens-model.ts
  var EXPORTABLE = /* @__PURE__ */ new Set(["COLOR", "FLOAT", "STRING", "BOOLEAN"]);
  async function buildTokenModel() {
    const [collections, variables] = await Promise.all([figma.variables.getLocalVariableCollectionsAsync(), figma.variables.getLocalVariablesAsync()]);
    const byId = new Map(variables.map((v) => [v.id, v]));
    const colById = new Map(collections.map((c) => [c.id, c]));
    const convert = (value) => {
      var _a;
      if (typeof value === "object" && value !== null && "type" in value && value.type === "VARIABLE_ALIAS") {
        const target = byId.get(value.id);
        const col = target ? colById.get(target.variableCollectionId) : void 0;
        return target ? { kind: "alias", collection: (_a = col == null ? void 0 : col.name) != null ? _a : "", name: target.name } : { kind: "string", value: "(alias inaccessible)" };
      }
      if (typeof value === "object" && value !== null && "r" in value) {
        const c = value;
        return { kind: "color", hex: rgbToHex({ r: c.r, g: c.g, b: c.b }, "a" in c ? c.a : 1) };
      }
      if (typeof value === "number") return { kind: "number", value: Math.round(value * 1e3) / 1e3 };
      if (typeof value === "boolean") return { kind: "boolean", value };
      return { kind: "string", value: String(value) };
    };
    return {
      collections: collections.map((c) => ({
        name: c.name,
        modes: c.modes.map((m) => ({ id: m.modeId, name: m.name })),
        defaultModeId: c.defaultModeId,
        variables: variables.filter((v) => v.variableCollectionId === c.id && EXPORTABLE.has(v.resolvedType)).map((v) => ({
          name: v.name,
          type: v.resolvedType,
          description: v.description || void 0,
          scopes: [...v.scopes],
          valuesByMode: Object.fromEntries(Object.entries(v.valuesByMode).map(([mode, value]) => [mode, convert(value)]))
        }))
      }))
    };
  }

  // src/plugin/fix/apply.ts
  var FixError = class extends Error {
    constructor(reason) {
      super(reason);
      this.reason = reason;
    }
  };
  var clone = (v) => JSON.parse(JSON.stringify(v));
  async function getNode(id) {
    const node = await figma.getNodeByIdAsync(id);
    if (!node || node.type === "DOCUMENT" || node.type === "PAGE") throw new FixError("node-missing");
    if (node.removed) throw new FixError("node-missing");
    return node;
  }
  async function getVariable(id) {
    const v = await figma.variables.getVariableByIdAsync(id);
    if (!v) throw new FixError("variable-missing");
    return v;
  }
  function getPaints(node, prop) {
    const value = node[prop];
    if (!value || value === figma.mixed) throw new FixError("mixed-paints");
    return value;
  }
  async function loadFontsFor(node) {
    const fontName = node.fontName;
    if (fontName === figma.mixed) {
      const fonts = node.getRangeAllFontNames(0, node.characters.length);
      await Promise.all(fonts.map((f) => figma.loadFontAsync(f)));
    } else {
      await figma.loadFontAsync(fontName);
    }
  }
  async function applyPlan(issueId, plan) {
    var _a, _b, _c, _d;
    switch (plan.kind) {
      case "bind-paint-variable": {
        const node = await getNode(plan.nodeId);
        const variable = await getVariable(plan.variableId);
        const before = clone(getPaints(node, plan.prop));
        const paints = clone(before);
        const target = paints[plan.index];
        if (!target || target.type !== "SOLID") throw new FixError("paint-changed");
        paints[plan.index] = figma.variables.setBoundVariableForPaint(target, "color", variable);
        node[plan.prop] = paints;
        return {
          issueId,
          revert: async () => {
            const n = await getNode(plan.nodeId);
            n[plan.prop] = before;
          }
        };
      }
      case "apply-paint-style": {
        const node = await getNode(plan.nodeId);
        const before = clone(getPaints(node, plan.prop));
        const beforeStyle = plan.prop === "fills" ? node.fillStyleId : node.strokeStyleId;
        if (beforeStyle === figma.mixed) throw new FixError("mixed-paints");
        if (plan.prop === "fills") await node.setFillStyleIdAsync(plan.styleId);
        else await node.setStrokeStyleIdAsync(plan.styleId);
        return {
          issueId,
          revert: async () => {
            const n = await getNode(plan.nodeId);
            if (plan.prop === "fills") {
              await n.setFillStyleIdAsync(beforeStyle);
              if (!beforeStyle) n.fills = before;
            } else {
              await n.setStrokeStyleIdAsync(beforeStyle);
              if (!beforeStyle) n.strokes = before;
            }
          }
        };
      }
      case "apply-text-style": {
        const node = await getNode(plan.nodeId);
        if (node.type !== "TEXT") throw new FixError("node-type");
        const style = await figma.getStyleByIdAsync(plan.styleId);
        if (!style || style.type !== "TEXT") throw new FixError("style-missing");
        if (node.fontName === figma.mixed || node.fontSize === figma.mixed) throw new FixError("mixed-text");
        const before = {
          textStyleId: node.textStyleId,
          fontName: node.fontName,
          fontSize: node.fontSize,
          lineHeight: node.lineHeight,
          letterSpacing: node.letterSpacing,
          textDecoration: node.textDecoration,
          textCase: node.textCase
        };
        await Promise.all([loadFontsFor(node), figma.loadFontAsync(style.fontName)]);
        await node.setTextStyleIdAsync(plan.styleId);
        return {
          issueId,
          revert: async () => {
            const n = await getNode(plan.nodeId);
            await Promise.all([loadFontsFor(n), figma.loadFontAsync(before.fontName)]);
            await n.setTextStyleIdAsync(before.textStyleId);
            if (!before.textStyleId) {
              n.fontName = before.fontName;
              n.fontSize = before.fontSize;
              n.lineHeight = before.lineHeight;
              n.letterSpacing = before.letterSpacing;
              n.textDecoration = before.textDecoration;
              n.textCase = before.textCase;
            }
          }
        };
      }
      case "bind-number": {
        const node = await getNode(plan.nodeId);
        const variable = await getVariable(plan.variableId);
        const host = node;
        const before = plan.fields.map((f) => ({ field: f, value: host[f] }));
        for (const f of plan.fields) node.setBoundVariable(f, variable);
        return {
          issueId,
          revert: async () => {
            const n = await getNode(plan.nodeId);
            for (const { field, value } of before) {
              n.setBoundVariable(field, null);
              if (typeof value === "number") n[field] = value;
            }
          }
        };
      }
      case "round-size": {
        const node = await getNode(plan.nodeId);
        if (!("resizeWithoutConstraints" in node)) throw new FixError("node-type");
        const before = { w: node.width, h: node.height };
        const w = Math.max(0.01, Math.round(node.width));
        const h = Math.max(0.01, Math.round(node.height));
        node.resizeWithoutConstraints(w, h);
        return {
          issueId,
          revert: async () => {
            const n = await getNode(plan.nodeId);
            n.resizeWithoutConstraints(before.w, before.h);
          }
        };
      }
      case "round-position": {
        const node = await getNode(plan.nodeId);
        const before = { x: node.x, y: node.y };
        node.x = Math.round(node.x);
        node.y = Math.round(node.y);
        return {
          issueId,
          revert: async () => {
            const n = await getNode(plan.nodeId);
            n.x = before.x;
            n.y = before.y;
          }
        };
      }
      case "set-hover-duration": {
        const node = await getNode(plan.nodeId);
        if (!("reactions" in node)) throw new FixError("node-type");
        const before = clone(node.reactions);
        const next = clone(before);
        let touched = false;
        for (const r of next) {
          const t = (_a = r.trigger) == null ? void 0 : _a.type;
          if (t !== "ON_HOVER" && t !== "MOUSE_ENTER") continue;
          const actions = (_b = r.actions) != null ? _b : r.action ? [r.action] : [];
          for (const a of actions) {
            if (a.type === "NODE" && a.transition && "duration" in a.transition) {
              const current = a.transition.duration;
              const inSeconds = current < 10;
              a.transition.duration = inSeconds ? plan.durationMs / 1e3 : plan.durationMs;
              touched = true;
            }
          }
          if (r.actions) r.actions = actions;
          else if (r.action) r.action = actions[0];
        }
        if (!touched) throw new FixError("no-transition");
        await node.setReactionsAsync(next);
        return {
          issueId,
          revert: async () => {
            const n = await getNode(plan.nodeId);
            await n.setReactionsAsync(before);
          }
        };
      }
      // ---- Pro ------------------------------------------------------------
      case "set-number": {
        const node = await getNode(plan.nodeId);
        if (!(plan.field in node) || typeof node[plan.field] !== "number") throw new FixError("node-type");
        const before = node[plan.field];
        node[plan.field] = plan.value;
        return {
          issueId,
          revert: async () => {
            const n = await getNode(plan.nodeId);
            n[plan.field] = before;
          }
        };
      }
      case "set-line-height": {
        const node = await getNode(plan.nodeId);
        if (node.type !== "TEXT") throw new FixError("node-type");
        if (node.lineHeight === figma.mixed) throw new FixError("mixed-text");
        const before = node.lineHeight;
        await loadFontsFor(node);
        node.lineHeight = { unit: "PIXELS", value: plan.px };
        return {
          issueId,
          revert: async () => {
            const n = await getNode(plan.nodeId);
            await loadFontsFor(n);
            n.lineHeight = before;
          }
        };
      }
      case "set-layout-sizing": {
        const node = await getNode(plan.nodeId);
        if (!("layoutSizingHorizontal" in node)) throw new FixError("node-type");
        const host = node;
        const before = plan.axis === "horizontal" ? host.layoutSizingHorizontal : host.layoutSizingVertical;
        const size = { w: host.width, h: host.height };
        if (plan.axis === "horizontal") host.layoutSizingHorizontal = plan.value;
        else host.layoutSizingVertical = plan.value;
        return {
          issueId,
          revert: async () => {
            const n = await getNode(plan.nodeId);
            if (plan.axis === "horizontal") n.layoutSizingHorizontal = before;
            else n.layoutSizingVertical = before;
            if (before === "FIXED" && "resize" in n) n.resize(size.w, size.h);
          }
        };
      }
      case "set-axis-sizing": {
        const node = await getNode(plan.nodeId);
        if (!("primaryAxisSizingMode" in node)) throw new FixError("node-type");
        const host = node;
        const before = plan.axis === "primary" ? host.primaryAxisSizingMode : host.counterAxisSizingMode;
        const size = { w: host.width, h: host.height };
        if (plan.axis === "primary") host.primaryAxisSizingMode = plan.value;
        else host.counterAxisSizingMode = plan.value;
        return {
          issueId,
          revert: async () => {
            const n = await getNode(plan.nodeId);
            if (plan.axis === "primary") n.primaryAxisSizingMode = before;
            else n.counterAxisSizingMode = before;
            if (before === "FIXED") n.resize(size.w, size.h);
          }
        };
      }
      case "set-hover-easing":
      case "cap-transition-duration": {
        const node = await getNode(plan.nodeId);
        if (!("reactions" in node)) throw new FixError("node-type");
        const before = clone(node.reactions);
        const next = clone(before);
        let touched = false;
        for (const r of next) {
          const t = (_c = r.trigger) == null ? void 0 : _c.type;
          const hoverOnly = plan.kind === "set-hover-easing";
          if (hoverOnly && t !== "ON_HOVER" && t !== "MOUSE_ENTER") continue;
          const actions = (_d = r.actions) != null ? _d : r.action ? [r.action] : [];
          for (const a of actions) {
            if (a.type !== "NODE" || !a.transition || !("duration" in a.transition)) continue;
            const tr = a.transition;
            if (plan.kind === "set-hover-easing") {
              tr.easing = { type: plan.easing };
              touched = true;
            } else {
              const inSeconds = tr.duration < 10;
              const ms = inSeconds ? tr.duration * 1e3 : tr.duration;
              if (ms > plan.maxMs) {
                tr.duration = inSeconds ? plan.maxMs / 1e3 : plan.maxMs;
                touched = true;
              }
            }
          }
          if (r.actions) r.actions = actions;
          else if (r.action) r.action = actions[0];
        }
        if (!touched) throw new FixError("no-transition");
        await node.setReactionsAsync(next);
        return {
          issueId,
          revert: async () => {
            const n = await getNode(plan.nodeId);
            await n.setReactionsAsync(before);
          }
        };
      }
    }
  }

  // src/plugin/preview.ts
  var MAX_EDGE = 1400;
  var PREVIEW_TAG = "scd:preview-clone";
  var FAR = 2e5;
  var isScene = (n) => Boolean(n) && n.type !== "PAGE" && n.type !== "DOCUMENT";
  function pageOf(node) {
    let p = node;
    while (p && p.type !== "PAGE") p = p.parent;
    return p != null ? p : null;
  }
  function topLevelRootOf(node) {
    let n = node;
    while (n.parent && n.parent.type !== "PAGE" && n.parent.type !== "DOCUMENT" && n.parent.type !== "SECTION") n = n.parent;
    return n;
  }
  function cloneableRoot(node) {
    let root = node;
    let p = node.parent;
    while (p && isScene(p)) {
      if (p.type === "INSTANCE" || p.type === "COMPONENT") root = p;
      p = p.parent;
    }
    if (root.parent && root.parent.type === "COMPONENT_SET") root = root.parent;
    return root;
  }
  function isWithin(node, root) {
    let n = node;
    while (n && isScene(n)) {
      if (n.id === root.id) return true;
      n = n.parent;
    }
    return false;
  }
  function indexPath(root, node) {
    const path = [];
    let n = node;
    while (n.id !== root.id) {
      const parent = n.parent;
      if (!parent || !("children" in parent)) return null;
      const idx = parent.children.indexOf(n);
      if (idx < 0) return null;
      path.unshift(idx);
      n = parent;
    }
    return path;
  }
  function follow(root, path) {
    let n = root;
    for (const i of path) {
      if (!("children" in n)) return null;
      const child = n.children[i];
      if (!child) return null;
      n = child;
    }
    return n;
  }
  function exportPng(node, scale) {
    return node.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: scale } });
  }
  async function copyResolvedModes(from, to) {
    try {
      for (const [collectionId, modeId] of Object.entries(from.resolvedVariableModes)) {
        const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
        if (collection) to.setExplicitVariableModeForCollection(collection, modeId);
      }
    } catch {
    }
  }
  function selectionRoots() {
    const selection = figma.currentPage.selection;
    const ids = new Set(selection.map((n) => n.id));
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const node of selection) {
      let nested = false;
      let p = node.parent;
      while (p && isScene(p)) {
        if (ids.has(p.id)) {
          nested = true;
          break;
        }
        p = p.parent;
      }
      if (nested) continue;
      const root = cloneableRoot(node);
      if (seen.has(root.id)) continue;
      seen.add(root.id);
      out.push(root);
    }
    return out;
  }
  async function renderRoot(root, located) {
    if (!("width" in root) || root.width <= 0 || root.height <= 0) return null;
    const page = pageOf(root);
    if (!page) return null;
    const inside = located.filter(({ node }) => isWithin(node, root));
    const scale = Math.min(4, MAX_EDGE / Math.max(root.width, root.height));
    const before = await exportPng(root, scale);
    let clone2 = null;
    let applied = 0;
    let failed = 0;
    try {
      const paths = inside.map(({ item, node }) => ({ item, path: indexPath(root, node) }));
      clone2 = root.clone();
      clone2.setPluginData(PREVIEW_TAG, "1");
      clone2.name = root.name;
      page.appendChild(clone2);
      clone2.x = FAR;
      clone2.y = FAR;
      clone2.locked = true;
      await copyResolvedModes(root, clone2);
      for (const { item, path } of paths) {
        const target = path ? follow(clone2, path) : null;
        if (!target) {
          failed++;
          continue;
        }
        try {
          await applyPlan(item.issueId, { ...item.plan, nodeId: target.id });
          applied++;
        } catch {
          failed++;
        }
      }
      const after = await exportPng(clone2, scale);
      return { rootId: root.id, name: root.name, width: root.width, height: root.height, scale, before, after, applied, failed, issueIds: inside.map((g) => g.item.issueId) };
    } finally {
      if (clone2 && !clone2.removed) clone2.remove();
    }
  }
  async function renderPreview(req) {
    var _a, _b;
    const located = [];
    for (const item of req.items) {
      const node = await figma.getNodeByIdAsync(item.nodeId);
      if (!isScene(node) || node.removed) continue;
      located.push({ item, node });
    }
    const countIn = (root) => located.filter(({ node }) => isWithin(node, root)).length;
    const byCount = (a, b) => countIn(b) - countIn(a);
    const selected = req.followSelection || req.rootId ? selectionRoots() : [];
    const selectedIds = new Set(selected.map((r) => r.id));
    const frameRoots = /* @__PURE__ */ new Map();
    for (const { node } of located) {
      const root = cloneableRoot(topLevelRootOf(node));
      if (!selectedIds.has(root.id)) frameRoots.set(root.id, root);
    }
    const frames = [...frameRoots.values()].sort(byCount);
    const roots = [
      ...selected.map((r) => ({ id: r.id, name: r.name, count: countIn(r), kind: "selection" })),
      ...frames.map((r) => ({ id: r.id, name: r.name, count: countIn(r), kind: "frame" }))
    ];
    let toRender;
    if (req.rootId) {
      let root = (_b = (_a = selected.find((r) => r.id === req.rootId)) != null ? _a : frameRoots.get(req.rootId)) != null ? _b : null;
      if (!root) {
        const node = await figma.getNodeByIdAsync(req.rootId);
        if (isScene(node) && !node.removed) root = cloneableRoot(node);
      }
      toRender = root ? [root] : [];
    } else if (req.followSelection && selected.length) {
      toRender = [...selected].sort(byCount).slice(0, req.maxRoots);
    } else {
      toRender = frames.slice(0, req.maxRoots);
    }
    const out = [];
    let rendered = 0;
    for (const root of toRender) {
      const frame = await renderRoot(root, located);
      if (!frame) continue;
      out.push(frame);
      rendered += frame.issueIds.length;
    }
    return { frames: out, skipped: Math.max(0, located.length - rendered), roots };
  }
  function sweepPreviewClones() {
    let removed = 0;
    const visit = (nodes) => {
      for (const n of nodes) {
        if (n.getPluginData(PREVIEW_TAG)) {
          n.remove();
          removed++;
        } else if (n.type === "SECTION") visit(n.children);
      }
    };
    visit(figma.currentPage.children);
    return removed;
  }

  // src/shared/names.ts
  var DEFAULT_NAME_RE = /^(Frame|Group|Rectangle|Ellipse|Polygon|Star|Line|Arrow|Vector|Image|Text|Component|Section|Slice|Union|Subtract|Intersect|Exclude|Boolean(?: Group)?|Instance|Mask(?: group)?)(?:\s+\d+)?(?:\s+copy(?:\s+\d+)?)?$/i;
  function isDefaultName(name) {
    return DEFAULT_NAME_RE.test(name.trim());
  }
  function normalizeStateValue(value) {
    return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/^(state|status|etat)[-_:= ]*/, "").replace(/^[:._-]+/, "").replace(/[\s_.-]+/g, "-").trim();
  }
  var STATE_ALIASES = {
    default: ["default", "rest", "idle", "normal", "enabled", "base", "defaut", "repos"],
    hover: ["hover", "hovered", "mouse-over", "mouseover", "over", "survol"],
    pressed: ["pressed", "active", "press", "down", "mouse-down", "clicked", "appuye", "actif"],
    focus: ["focus", "focused", "focus-visible", "focussed", "keyboard", "focalise"],
    disabled: ["disabled", "inactive", "off-disabled", "unavailable", "desactive", "inactif"],
    loading: ["loading", "busy", "pending", "spinner", "progress", "chargement"],
    error: ["error", "invalid", "danger", "erreur", "invalide"],
    success: ["success", "valid", "done", "succes", "valide"],
    selected: ["selected", "checked", "on", "active-selected", "selectionne", "coche", "true"],
    unselected: ["unselected", "unchecked", "off", "non-coche", "false"],
    empty: ["empty", "no-results", "no-result", "nothing", "vide", "aucun-resultat"],
    filled: ["filled", "with-value", "value", "rempli"],
    readonly: ["readonly", "read-only", "lecture-seule"]
  };
  var aliasToCanonical = /* @__PURE__ */ new Map();
  for (const [canon, aliases] of Object.entries(STATE_ALIASES)) {
    for (const a of aliases) aliasToCanonical.set(a, canon);
  }
  function canonicalState(value) {
    const norm = normalizeStateValue(value);
    if (aliasToCanonical.has(norm)) return aliasToCanonical.get(norm);
    const parts = norm.split(/[+/,&]/).map((p) => p.replace(/^-+|-+$/g, "").trim());
    if (parts.length > 1) {
      for (const p of parts) if (aliasToCanonical.has(p)) return aliasToCanonical.get(p);
    }
    return null;
  }
  function isStateProperty(propName, values) {
    const n = normalizeStateValue(propName);
    if (/^(state|status|interaction|etat|mode-interaction)$/.test(n)) return true;
    const recognized = values.filter((v) => canonicalState(v) !== null).length;
    return recognized >= 2 && recognized >= values.length / 2;
  }
  var KIND_PATTERNS = [
    ["icon-button", /icon[\s_-]?(button|btn)|btn[\s_-]?icon|icon-only/i],
    ["button", /\b(button|btn|cta)\b|bouton/i],
    ["link", /\blink\b|lien/i],
    ["search", /search|recherche/i],
    ["input", /\b(input|text[\s_-]?field|textfield|textarea|field|champ)\b/i],
    ["select", /\b(select|dropdown|combobox|combo[\s_-]?box|picker)\b/i],
    ["checkbox", /checkbox|check[\s_-]?box|case/i],
    ["radio", /\bradio\b/i],
    ["toggle", /toggle|switch|interrupteur/i],
    ["chip", /\b(chip|tag|pill|filter)\b|badge-filter/i],
    ["tab", /\btabs?\b|onglet|segment/i],
    ["table", /\btable\b|data[\s_-]?grid|tableau/i],
    ["list", /\blist\b|liste|feed|results|resultats/i],
    ["card", /\bcard\b|carte|tile/i]
  ];
  function inferComponentKind(name, description = "") {
    const hay = `${name} ${description}`;
    for (const [kind, re] of KIND_PATTERNS) if (re.test(hay)) return kind;
    return "unknown";
  }
  var EXPECTED_STATES = {
    button: [
      { state: "hover", severity: "warning" },
      { state: "pressed", severity: "warning" },
      { state: "focus", severity: "error" },
      { state: "disabled", severity: "warning" }
    ],
    "icon-button": [
      { state: "hover", severity: "warning" },
      { state: "pressed", severity: "warning" },
      { state: "focus", severity: "error" },
      { state: "disabled", severity: "warning" }
    ],
    link: [
      { state: "hover", severity: "warning" },
      { state: "focus", severity: "error" }
    ],
    input: [
      { state: "focus", severity: "error" },
      { state: "error", severity: "error" },
      { state: "disabled", severity: "warning" }
    ],
    search: [
      { state: "focus", severity: "error" },
      { state: "disabled", severity: "warning" }
    ],
    select: [
      { state: "focus", severity: "error" },
      { state: "error", severity: "error" },
      { state: "disabled", severity: "warning" }
    ],
    checkbox: [
      { state: "selected", severity: "error" },
      { state: "focus", severity: "error" },
      { state: "disabled", severity: "warning" }
    ],
    radio: [
      { state: "selected", severity: "error" },
      { state: "focus", severity: "error" },
      { state: "disabled", severity: "warning" }
    ],
    toggle: [
      { state: "selected", severity: "error" },
      { state: "focus", severity: "error" },
      { state: "disabled", severity: "warning" }
    ],
    chip: [
      { state: "selected", severity: "error" },
      { state: "hover", severity: "warning" }
    ],
    tab: [
      { state: "selected", severity: "error" },
      { state: "hover", severity: "warning" },
      { state: "focus", severity: "error" }
    ]
  };
  var ACTION_VERB_RE = /\b(submit|pay|payer|paiement|checkout|send|envoyer|save|enregistrer|sauvegarder|upload|televerser|importer|export|download|telecharger|confirm|confirmer|order|commander|buy|acheter|sign ?in|sign ?up|log ?in|connexion|inscription|continue|continuer|next|suivant|apply|appliquer|publish|publier|generate|generer|search|rechercher|add to cart|ajouter au panier|delete|supprimer|primary|principal)\b/i;
  function looksLikeLongAction(text) {
    return ACTION_VERB_RE.test(text);
  }
  var EMPTY_STATE_KINDS = ["list", "table", "search"];
  var PRIMITIVE_TOKEN_RE = /(^|\/|\.)(blue|red|green|gray|grey|neutral|orange|yellow|purple|violet|pink|teal|cyan|indigo|slate|zinc|stone|amber|lime|emerald|sky|rose|fuchsia|brown|black|white|magenta|mint)[-_/. ]?(\d{1,4}|lightest|lighter|light|dark|darker|darkest|base)$/i;
  var PRIMITIVE_COLLECTION_RE = /primitive|core|base|palette|raw|foundation|global/i;
  var SEMANTIC_TOKEN_RE = /(^|\/|\.|-|_)(action|brand|text|surface|background|bg|border|stroke|icon|fg|foreground|accent|success|danger|error|warning|info|link|interactive|disabled|muted|inverse|overlay|focus|on)(\/|\.|-|_|$)/i;
  function looksPrimitiveToken(name, collection = "") {
    if (SEMANTIC_TOKEN_RE.test(name)) return false;
    return PRIMITIVE_TOKEN_RE.test(name) || PRIMITIVE_COLLECTION_RE.test(collection);
  }
  function looksSemanticToken(name) {
    return SEMANTIC_TOKEN_RE.test(name);
  }
  var DEPRECATED_RE = /\b(deprecated|obsolete|legacy|do not use|don['’]t use|ne pas utiliser|obsol[eè]te|à supprimer)\b|⚠️|⚠|🚫|❌|☠️/i;
  var STATUS_RE = /\b(draft|wip|work in progress|beta|alpha|stable|deprecated|ready|in review|experimental|brouillon|validé|valide)\b|🟢|🟡|🟠|🔴|✅|🚧|🧪/i;
  var DESTRUCTIVE_RE = /\b(delete|remove|supprimer|effacer|trash|retirer|destroy|clear all|tout effacer|unsubscribe|désinscrire|desinscrire|deactivate|désactiver|desactiver|close account|fermer le compte|reset|réinitialiser|reinitialiser|discard|abandonner)\b/i;
  var CONFIRM_RE = /\b(confirm|confirmation|dialog|modal|alert|undo|annuler|toast|snackbar|are you sure|êtes-vous sûr|es-tu sûr|sure\?)\b/i;
  var RECOVERY_RE = /\b(retry|réessayer|reessayer|try again|contact|support|back|retour|help|aide|reload|recharger|refresh|actualiser|go home|accueil|réinitialiser|reinitialiser|reset)\b/i;
  var GENERIC_ERROR_RE = /^(erreur|error|une erreur est survenue|une erreur s['’]est produite|something went wrong|an error occurred|an error has occurred|oops!?|oups!?|échec|echec|failed|erreur inconnue|unknown error|error\s*\d{3})[.!…]*$/i;
  var ERROR_NAME_RE = /\b(error|erreur|échec|echec|failed|failure|invalid)\b/i;
  var ICON_NAME_RE = /\b(icon|icône|icone|ico|glyph|symbol|pictogram|picto)\b/i;
  function headingLevel(styleName) {
    const m = /(^|\/|\s|-|_)(h|heading|title|titre|headline|display)[\s/_-]?([1-6])\b/i.exec(styleName);
    return m ? Number(m[3]) : null;
  }
  function labelCase(text) {
    const words = text.trim().split(/\s+/).filter((w) => /\p{L}/u.test(w));
    if (!words.length) return "other";
    const letters = words.join("");
    if (letters === letters.toUpperCase() && letters !== letters.toLowerCase()) return "upper";
    if (letters === letters.toLowerCase()) return "lower";
    const startsUpper = (w) => /^\p{Lu}/u.test(w);
    if (words.length >= 2 && words.every((w) => startsUpper(w) || w.length <= 2)) return "title";
    if (startsUpper(words[0]) && words.slice(1).every((w) => !startsUpper(w))) return "sentence";
    return "other";
  }
  function roleName(name) {
    return name.toLowerCase().replace(/\s*copy(\s*\d+)?$/i, "").replace(/[\s_-]*\d+$/, "").replace(/\s+/g, " ").trim();
  }

  // src/plugin/scan/node-info.ts
  function ancestors(node, ctx) {
    const cached = ctx.ancestorsCache.get(node.id);
    if (cached) return cached;
    const out = [];
    let p = node.parent;
    while (p && p.type !== "PAGE" && p.type !== "DOCUMENT") {
      out.push(p);
      p = p.parent;
    }
    ctx.ancestorsCache.set(node.id, out);
    return out;
  }
  function pageOf2(node) {
    let p = node;
    while (p && p.type !== "PAGE") p = p.parent;
    return p != null ? p : null;
  }
  function pathOf(node, ctx) {
    const anc = ancestors(node, ctx);
    const page = pageOf2(node);
    const names = anc.map((a) => a.name).reverse();
    return page ? [page.name, ...names] : names;
  }
  function isInsideInstance(node, ctx) {
    return ancestors(node, ctx).some((a) => a.type === "INSTANCE");
  }
  function isEffectivelyHidden(node, ctx) {
    if (!node.visible) return true;
    return ancestors(node, ctx).some((a) => !a.visible);
  }
  function isEffectivelyLocked(node, ctx) {
    if (node.locked) return true;
    return ancestors(node, ctx).some((a) => a.locked);
  }
  async function resolveSolidPaint(paint, consumer) {
    var _a, _b, _c, _d;
    const alias = (_a = paint.boundVariables) == null ? void 0 : _a.color;
    if (alias) {
      const variable = await figma.variables.getVariableByIdAsync(alias.id);
      if (variable) {
        try {
          const { value } = variable.resolveForConsumer(consumer);
          if (value && typeof value === "object" && "r" in value) {
            const v = value;
            const a = "a" in v && typeof v.a === "number" ? v.a : 1;
            return { rgb: { r: v.r, g: v.g, b: v.b }, alpha: ((_b = paint.opacity) != null ? _b : 1) * a, bound: true };
          }
        } catch {
        }
      }
      return { rgb: { r: paint.color.r, g: paint.color.g, b: paint.color.b }, alpha: (_c = paint.opacity) != null ? _c : 1, bound: true };
    }
    return { rgb: { r: paint.color.r, g: paint.color.g, b: paint.color.b }, alpha: (_d = paint.opacity) != null ? _d : 1, bound: false };
  }
  function hasFills(node) {
    return "fills" in node;
  }
  async function backgroundBehind(node, ctx) {
    const cached = ctx.backgroundCache.get(node.id);
    if (cached) return cached;
    const result = await computeBackground(node, ctx, 0);
    ctx.backgroundCache.set(node.id, result);
    return result;
  }
  async function computeBackground(node, ctx, depth) {
    const chain = ancestors(node, ctx);
    const layers = [];
    for (const anc of chain) {
      if ("opacity" in anc && typeof anc.opacity === "number" && anc.opacity < 0.99) return { kind: "complex", reason: "opacity" };
      if (!hasFills(anc)) continue;
      const fills = anc.fills;
      if (fills === figma.mixed) return { kind: "complex", reason: "mixed" };
      const visible = fills.filter((p) => {
        var _a;
        return p.visible !== false && ((_a = p.opacity) != null ? _a : 1) > 0;
      });
      if (!visible.length) continue;
      for (let i = visible.length - 1; i >= 0; i--) {
        const p = visible[i];
        if (p.type === "IMAGE" || p.type === "VIDEO") return { kind: "complex", reason: "image" };
        if (p.type !== "SOLID") return { kind: "complex", reason: "gradient" };
        const { rgb, alpha } = await resolveSolidPaint(p, anc);
        if (alpha >= 0.99) return { kind: "solid", rgb: flatten(layers, rgb) };
        layers.push({ rgb, alpha });
      }
    }
    const page = pageOf2(node);
    if (page) {
      const bg = page.backgrounds.find((p) => p.visible !== false && p.type === "SOLID");
      if (bg) return { kind: "solid", rgb: flatten(layers, { r: bg.color.r, g: bg.color.g, b: bg.color.b }) };
    }
    if (layers.length && depth === 0) {
      return { kind: "solid", rgb: flatten(layers, { r: 1, g: 1, b: 1 }) };
    }
    return { kind: "unknown" };
  }
  function flatten(layers, base) {
    let acc = base;
    for (let i = layers.length - 1; i >= 0; i--) acc = composite(layers[i].rgb, layers[i].alpha, acc);
    return acc;
  }
  function fontLabel(font, size, lineHeight) {
    const lh = lineHeight && lineHeight.unit !== "AUTO" ? lineHeight.unit === "PERCENT" ? `/${Math.round(lineHeight.value)}%` : `/${Math.round(lineHeight.value * 10) / 10}` : "";
    return `${font.family} ${font.style} ${Math.round(size * 10) / 10}${lh}`;
  }
  function hasAutoLayout(node) {
    return "layoutMode" in node && node.layoutMode !== "NONE";
  }
  function isInteractiveByReactions(node) {
    if (!("reactions" in node)) return false;
    return node.reactions.some((r) => {
      var _a;
      const t = (_a = r.trigger) == null ? void 0 : _a.type;
      return t === "ON_CLICK" || t === "ON_PRESS" || t === "ON_HOVER" || t === "MOUSE_DOWN" || t === "MOUSE_UP";
    });
  }

  // src/plugin/rules/match-color.ts
  var CLOSE_DELTA_E = 2.5;
  var AMBIGUOUS_GAP = 0.6;
  function scopeAllows(scopes, usage) {
    if (scopes.includes("ALL_SCOPES")) return true;
    switch (usage) {
      case "frame-fill":
        return scopes.includes("ALL_FILLS") || scopes.includes("FRAME_FILL");
      case "shape-fill":
        return scopes.includes("ALL_FILLS") || scopes.includes("SHAPE_FILL");
      case "text-fill":
        return scopes.includes("ALL_FILLS") || scopes.includes("TEXT_FILL");
      case "stroke":
        return scopes.includes("STROKE_COLOR");
    }
  }
  function tokenLabel(t) {
    return t.modeName && !t.isDefaultMode ? `${t.name} (${t.modeName})` : t.name;
  }
  function rank(t, usage) {
    return (scopeAllows(t.scopes, usage) ? 0 : 4) + (t.isDefaultMode ? 0 : 2) + (t.remote ? 1 : 0);
  }
  function matchColor(rgb, alpha, ctx, usage) {
    var _a, _b;
    const key = colorKey(rgb, alpha);
    const exactTokens = ((_a = ctx.colorByKey.get(key)) != null ? _a : []).slice().sort((a, b) => rank(a, usage) - rank(b, usage));
    const exactStyles = (_b = ctx.paintStyleByKey.get(key)) != null ? _b : [];
    if (exactTokens.length) {
      const best = exactTokens[0];
      const compatible = scopeAllows(best.scopes, usage);
      const alternatives = [
        ...exactTokens.slice(1, 4).map((t) => ({ token: t })),
        ...exactStyles.slice(0, 2).map((s) => ({ style: s }))
      ];
      return { confidence: compatible ? "exact" : "close", token: best, alternatives, scopeMismatch: !compatible };
    }
    if (exactStyles.length) {
      return { confidence: "exact", style: exactStyles[0], alternatives: exactStyles.slice(1, 3).map((s) => ({ style: s })), scopeMismatch: false };
    }
    const scored = [];
    for (const t of ctx.colors) {
      if (Math.abs(t.alpha - alpha) > 0.02) continue;
      if (!scopeAllows(t.scopes, usage)) continue;
      const d = deltaE(rgb, t.rgb);
      if (d <= CLOSE_DELTA_E) scored.push({ token: t, d });
    }
    scored.sort((a, b) => a.d - b.d || rank(a.token, usage) - rank(b.token, usage));
    if (scored.length) {
      const [first, second] = scored;
      const ambiguous = !!second && second.d - first.d <= AMBIGUOUS_GAP && colorKey(second.token.rgb, second.token.alpha) !== colorKey(first.token.rgb, first.token.alpha);
      return {
        confidence: ambiguous ? "ambiguous" : "close",
        token: first.token,
        alternatives: scored.slice(1, 4).map((s) => ({ token: s.token })),
        scopeMismatch: false
      };
    }
    const styleScored = ctx.paintStyles.filter((s) => Math.abs(s.alpha - alpha) <= 0.02).map((s) => ({ style: s, d: deltaE(rgb, s.rgb) })).filter((s) => s.d <= CLOSE_DELTA_E).sort((a, b) => a.d - b.d);
    if (styleScored.length) {
      return { confidence: "close", style: styleScored[0].style, alternatives: styleScored.slice(1, 3).map((s) => ({ style: s.style })), scopeMismatch: false };
    }
    return { confidence: "none", alternatives: [], scopeMismatch: false };
  }
  function toSuggestion(match) {
    if (match.confidence === "none") return void 0;
    const alts = match.alternatives.map(
      (a) => a.token ? { id: `var:${a.token.id}`, label: tokenLabel(a.token), swatch: rgbToHex(a.token.rgb, a.token.alpha) } : { id: `style:${a.style.id}`, label: a.style.name, swatch: rgbToHex(a.style.rgb, a.style.alpha) }
    );
    if (match.token) {
      const t = match.token;
      return {
        kind: "variable",
        id: t.id,
        label: tokenLabel(t),
        swatch: rgbToHex(t.rgb, t.alpha),
        confidence: match.confidence,
        source: t.source === "Local" ? t.collection || "Local" : `${t.source} \xB7 ${t.collection}`,
        alternatives: alts.length ? alts : void 0
      };
    }
    const s = match.style;
    return {
      kind: "style",
      id: s.id,
      label: s.name,
      swatch: rgbToHex(s.rgb, s.alpha),
      confidence: match.confidence,
      source: s.remote ? "Library" : "Local",
      alternatives: alts.length ? alts : void 0
    };
  }

  // src/plugin/rules/a11y.ts
  var INTERACTIVE_KINDS = /* @__PURE__ */ new Set(["button", "icon-button", "link", "checkbox", "radio", "toggle", "chip", "tab", "select"]);
  async function instanceKind(node) {
    var _a;
    try {
      const main = await node.getMainComponentAsync();
      if (!main) return "unknown";
      const set = ((_a = main.parent) == null ? void 0 : _a.type) === "COMPONENT_SET" ? main.parent : null;
      return inferComponentKind(set ? set.name : main.name, (set != null ? set : main).description);
    } catch {
      return "unknown";
    }
  }
  var a11yRules = [
    {
      id: "a11y/text-contrast",
      types: ["TEXT"],
      insideInstances: true,
      check: async (node, ctx) => {
        var _a;
        const text = node;
        if (!text.characters.trim()) return;
        if (text.fontSize === figma.mixed || text.fontName === figma.mixed) return;
        const fills = text.fills;
        const notVerifiable = (reason) => ctx.activeRules.has("a11y/contrast-not-verifiable") ? [{ ruleId: "a11y/contrast-not-verifiable", node, currentValue: reason, fixSafety: "none", params: { reason } }] : [];
        if (fills === figma.mixed) return notVerifiable("mixed");
        const visible = fills.filter((p) => {
          var _a2;
          return p.visible !== false && ((_a2 = p.opacity) != null ? _a2 : 1) > 0;
        });
        if (!visible.length) return;
        if (visible.length > 1 || visible[0].type !== "SOLID") return notVerifiable(visible[0].type === "IMAGE" ? "image" : "gradient");
        const bg = await backgroundBehind(text, ctx);
        if (bg.kind === "complex") return notVerifiable(bg.reason);
        if (bg.kind === "unknown") return;
        const fg = await resolveSolidPaint(visible[0], text);
        const alpha = fg.alpha * ((_a = text.opacity) != null ? _a : 1);
        const effectiveFg = alpha < 0.99 ? composite(fg.rgb, alpha, bg.rgb) : fg.rgb;
        const ratio = contrastRatio(effectiveFg, bg.rgb);
        const size = text.fontSize;
        const large = isLargeText(size, isBoldStyle(text.fontName.style));
        const result = evaluateContrast(ratio, large);
        const aaa = ctx.options.contrastLevel === "AAA";
        if (aaa ? result.passesAAA : result.passesAA) return;
        const required = aaa ? large ? 4.5 : 7 : large ? 3 : 4.5;
        let best;
        for (const t of ctx.colors) {
          if (t.alpha < 0.99) continue;
          if (!(t.scopes.includes("ALL_SCOPES") || t.scopes.includes("ALL_FILLS") || t.scopes.includes("TEXT_FILL"))) continue;
          if (contrastRatio(t.rgb, bg.rgb) < required) continue;
          const d = deltaE(t.rgb, fg.rgb);
          if (d > 30) continue;
          if (!best || d < best.d) best = { id: t.id, label: tokenLabel(t), swatch: rgbToHex(t.rgb), d };
        }
        const index = fills.indexOf(visible[0]);
        return [
          {
            ruleId: "a11y/text-contrast",
            node,
            currentValue: formatRatio(ratio),
            swatch: rgbToHex(effectiveFg),
            suggestion: best ? { kind: "variable", id: best.id, label: best.label, swatch: best.swatch, confidence: "close" } : void 0,
            fixSafety: best ? "review" : "none",
            params: {
              ratio: formatRatio(ratio),
              required: `${required}:1`,
              fg: rgbToHex(effectiveFg),
              bg: rgbToHex(bg.rgb),
              large: large ? 1 : 0,
              size: Math.round(size * 10) / 10,
              level: ctx.options.contrastLevel
            },
            plan: best && index >= 0 ? { kind: "bind-paint-variable", nodeId: node.id, prop: "fills", index, variableId: best.id } : void 0
          }
        ];
      }
    },
    { id: "a11y/contrast-not-verifiable", types: ["TEXT"], insideInstances: true },
    {
      id: "a11y/touch-target",
      types: ["INSTANCE", "FRAME", "COMPONENT"],
      check: async (node, ctx) => {
        var _a;
        let interactive = isInteractiveByReactions(node);
        let kind = "unknown";
        if (node.type === "INSTANCE") {
          kind = await instanceKind(node);
          if (INTERACTIVE_KINDS.has(kind)) interactive = true;
        } else if (node.type === "COMPONENT") {
          const set = ((_a = node.parent) == null ? void 0 : _a.type) === "COMPONENT_SET" ? node.parent : null;
          kind = inferComponentKind(set ? set.name : node.name, (set != null ? set : node).description);
          if (INTERACTIVE_KINDS.has(kind)) interactive = true;
        }
        if (!interactive) return;
        if (kind === "link") return;
        const min = ctx.options.minTouchTarget;
        const w = Math.round(node.width * 10) / 10;
        const h = Math.round(node.height * 10) / 10;
        if (w >= min && h >= min) return;
        return [
          {
            ruleId: "a11y/touch-target",
            node,
            currentValue: `${w} \xD7 ${h} px`,
            suggestion: { kind: "value", id: String(min), label: `\u2265 ${min} \xD7 ${min} px`, confidence: "exact" },
            fixSafety: "none",
            params: { width: w, height: h, min, kind }
          }
        ];
      }
    },
    {
      id: "a11y/text-too-small",
      types: ["TEXT"],
      insideInstances: true,
      check: (node, ctx) => {
        const text = node;
        if (!text.characters.trim() || text.fontSize === figma.mixed) return;
        const size = text.fontSize;
        if (size >= ctx.options.minFontSize) return;
        return [
          {
            ruleId: "a11y/text-too-small",
            node,
            severity: size < 10 ? "warning" : "info",
            currentValue: `${Math.round(size * 10) / 10} px`,
            suggestion: { kind: "value", id: String(ctx.options.minFontSize), label: `\u2265 ${ctx.options.minFontSize} px`, confidence: "exact" },
            fixSafety: "none",
            params: { size: Math.round(size * 10) / 10, min: ctx.options.minFontSize }
          }
        ];
      }
    }
  ];

  // src/plugin/rules/a11y-pro.ts
  var INTERACTIVE_KINDS2 = /* @__PURE__ */ new Set(["button", "icon-button", "link", "checkbox", "radio", "toggle", "chip", "tab", "select"]);
  var FIELD_KINDS = /* @__PURE__ */ new Set(["input", "select", "checkbox", "radio", "toggle", "search"]);
  var NON_TEXT_MIN = 3;
  var STATUS_TOKEN_RE = /(error|danger|success|warning|invalid|negative|positive|critical)/i;
  var GENERIC_ICON_BUTTON_RE = /^(icon[\s_-]?(button|btn)|button|btn|icon|action)$/i;
  var singleSolid = (paints) => {
    if (paints === figma.mixed) return null;
    const visible = paints.filter((p) => {
      var _a;
      return p.visible !== false && ((_a = p.opacity) != null ? _a : 1) > 0;
    });
    return visible.length === 1 && visible[0].type === "SOLID" ? visible[0] : null;
  };
  async function kindOfNode(node) {
    var _a;
    if (node.type === "INSTANCE") {
      try {
        const main = await node.getMainComponentAsync();
        if (main) {
          const set = ((_a = main.parent) == null ? void 0 : _a.type) === "COMPONENT_SET" ? main.parent : null;
          return inferComponentKind(set ? set.name : main.name, (set != null ? set : main).description);
        }
      } catch {
      }
    }
    return inferComponentKind(node.name, "description" in node ? node.description : "");
  }
  function inInteractiveContext(node, ctx) {
    return ancestors(node, ctx).some((a) => INTERACTIVE_KINDS2.has(inferComponentKind(a.name)) || isInteractiveByReactions(a));
  }
  var a11yProRules = [
    {
      id: "a11y/heading-skip",
      types: ["TEXT"],
      check: (node, ctx) => {
        var _a, _b, _c;
        const text = node;
        if (typeof text.textStyleId !== "string" || !text.textStyleId) return;
        const style = ctx.textStyles.find((s) => s.id === text.textStyleId);
        if (!style) return;
        const level = headingLevel(style.name);
        if (!level) return;
        const chain = ancestors(text, ctx);
        const root = (_a = chain[chain.length - 1]) != null ? _a : text;
        ctx.headings.push({ node: text, level, rootId: root.id, y: (_c = (_b = text.absoluteBoundingBox) == null ? void 0 : _b.y) != null ? _c : text.y });
      },
      finalize: (ctx) => {
        var _a;
        const byRoot = /* @__PURE__ */ new Map();
        for (const h of ctx.headings) byRoot.set(h.rootId, [...(_a = byRoot.get(h.rootId)) != null ? _a : [], h]);
        const out = [];
        for (const list of byRoot.values()) {
          if (list.length < 2) continue;
          list.sort((a, b) => a.y - b.y);
          let prev = list[0].level;
          for (const h of list.slice(1)) {
            if (h.level > prev + 1) {
              out.push({ ruleId: "a11y/heading-skip", node: h.node, currentValue: `H${prev} \u2192 H${h.level}`, fixSafety: "none", params: { level: h.level, prev, expected: prev + 1 } });
            }
            prev = h.level;
          }
        }
        return out;
      }
    },
    {
      id: "a11y/icon-contrast",
      types: ["VECTOR", "BOOLEAN_OPERATION"],
      insideInstances: true,
      check: async (node, ctx) => {
        if (node.width < 8 || node.height < 8) return;
        const iconish = ICON_NAME_RE.test(node.name) || ancestors(node, ctx).slice(0, 2).some((a) => ICON_NAME_RE.test(a.name));
        if (!iconish && !inInteractiveContext(node, ctx)) return;
        const paint = singleSolid(node.fills);
        if (!paint) return;
        const bg = await backgroundBehind(node, ctx);
        if (bg.kind !== "solid") return;
        const fg = await resolveSolidPaint(paint, node);
        if (fg.alpha < 0.99) return;
        const ratio = contrastRatio(fg.rgb, bg.rgb);
        if (ratio >= NON_TEXT_MIN) return;
        return [
          {
            ruleId: "a11y/icon-contrast",
            node,
            currentValue: formatRatio(ratio),
            swatch: rgbToHex(fg.rgb),
            fixSafety: "none",
            params: { ratio: formatRatio(ratio), required: "3:1", fg: rgbToHex(fg.rgb), bg: rgbToHex(bg.rgb) }
          }
        ];
      }
    },
    {
      id: "a11y/border-contrast",
      types: ["FRAME", "INSTANCE", "COMPONENT", "RECTANGLE"],
      check: async (node, ctx) => {
        const kind = await kindOfNode(node);
        if (!FIELD_KINDS.has(kind)) return;
        const host = node;
        const weight = typeof host.strokeWeight === "number" ? host.strokeWeight : 1;
        if (weight < 1) return;
        const paint = singleSolid(host.strokes);
        if (!paint) return;
        const bg = await backgroundBehind(node, ctx);
        if (bg.kind !== "solid") return;
        const stroke = await resolveSolidPaint(paint, node);
        if (stroke.alpha < 0.99) return;
        const ratio = contrastRatio(stroke.rgb, bg.rgb);
        if (ratio >= NON_TEXT_MIN) return;
        return [
          {
            ruleId: "a11y/border-contrast",
            node,
            currentValue: formatRatio(ratio),
            swatch: rgbToHex(stroke.rgb),
            fixSafety: "none",
            params: { ratio: formatRatio(ratio), required: "3:1", stroke: rgbToHex(stroke.rgb), bg: rgbToHex(bg.rgb), kind }
          }
        ];
      }
    },
    {
      id: "a11y/icon-only-without-label",
      types: ["INSTANCE", "FRAME", "COMPONENT"],
      check: async (node) => {
        var _a;
        if (node.type === "COMPONENT" && ((_a = node.parent) == null ? void 0 : _a.type) === "COMPONENT_SET") return;
        const kind = await kindOfNode(node);
        const interactive = kind === "icon-button" || isInteractiveByReactions(node) || kind === "button" && node.width <= 64;
        if (!interactive) return;
        const host = node;
        const texts = host.findAllWithCriteria({ types: ["TEXT"] }).filter((t) => t.characters.trim());
        if (texts.length) return;
        const glyphs = host.findAllWithCriteria({ types: ["VECTOR", "BOOLEAN_OPERATION", "ELLIPSE", "RECTANGLE", "INSTANCE"] });
        if (!glyphs.length) return;
        const name = node.name.replace(/.*\//, "").trim();
        if (!isDefaultName(node.name) && !GENERIC_ICON_BUTTON_RE.test(name) && name.length > 2) return;
        return [{ ruleId: "a11y/icon-only-without-label", node, currentValue: node.name, fixSafety: "none", params: { name: node.name } }];
      }
    },
    {
      id: "a11y/color-only-status",
      types: ["TEXT"],
      insideInstances: true,
      check: (node, ctx) => {
        var _a, _b;
        const text = node;
        const paint = singleSolid(text.fills);
        const id = (_b = (_a = paint == null ? void 0 : paint.boundVariables) == null ? void 0 : _a.color) == null ? void 0 : _b.id;
        if (!id) return;
        const token = ctx.colorById.get(id);
        if (!token || !STATUS_TOKEN_RE.test(token.name)) return;
        const parent = text.parent;
        if (!parent || !("children" in parent)) return;
        const hasIcon = parent.children.some((c) => c.id !== text.id && (ICON_NAME_RE.test(c.name) || c.type === "VECTOR" || c.type === "BOOLEAN_OPERATION"));
        if (hasIcon) return;
        return [{ ruleId: "a11y/color-only-status", node, currentValue: token.name, swatch: rgbToHex(token.rgb), fixSafety: "none", params: { token: token.name } }];
      }
    }
  ];

  // src/plugin/rules/colors.ts
  var PAINT_TYPES = [
    "FRAME",
    "RECTANGLE",
    "ELLIPSE",
    "POLYGON",
    "STAR",
    "VECTOR",
    "LINE",
    "TEXT",
    "COMPONENT",
    "INSTANCE",
    "BOOLEAN_OPERATION"
  ];
  function usageFor(node, prop) {
    if (prop === "strokes") return "stroke";
    if (node.type === "TEXT") return "text-fill";
    if (node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE") return "frame-fill";
    return "shape-fill";
  }
  async function checkPaints(node, prop, ctx, ruleId) {
    var _a, _b;
    const host = node;
    const paints = host[prop];
    if (!paints || paints === figma.mixed) return [];
    const styleId = prop === "fills" ? host.fillStyleId : host.strokeStyleId;
    if (styleId && styleId !== figma.mixed) return [];
    if (styleId === figma.mixed) return [];
    const issues2 = [];
    const list = paints;
    for (let i = 0; i < list.length; i++) {
      const paint = list[i];
      if (paint.type !== "SOLID" || paint.visible === false || ((_a = paint.opacity) != null ? _a : 1) === 0) continue;
      if ((_b = paint.boundVariables) == null ? void 0 : _b.color) continue;
      const { rgb, alpha } = await resolveSolidPaint(paint, node);
      const match = matchColor(rgb, alpha, ctx, usageFor(node, prop));
      const suggestion = toSuggestion(match);
      const hex = rgbToHex(rgb, alpha);
      const hasTokens = ctx.colors.length > 0 || ctx.paintStyles.length > 0;
      let severity = "warning";
      let fixSafety = "none";
      if (match.confidence === "exact") {
        severity = "error";
        fixSafety = "safe";
      } else if (match.confidence === "close" || match.confidence === "ambiguous") {
        fixSafety = "review";
      } else if (!hasTokens) {
        severity = "info";
      }
      let plan;
      const alternativePlans = {};
      if (match.token) plan = { kind: "bind-paint-variable", nodeId: node.id, prop, index: i, variableId: match.token.id };
      else if (match.style) plan = { kind: "apply-paint-style", nodeId: node.id, prop, styleId: match.style.id };
      for (const alt of match.alternatives) {
        if (alt.token) alternativePlans[`var:${alt.token.id}`] = { kind: "bind-paint-variable", nodeId: node.id, prop, index: i, variableId: alt.token.id };
        else if (alt.style) alternativePlans[`style:${alt.style.id}`] = { kind: "apply-paint-style", nodeId: node.id, prop, styleId: alt.style.id };
      }
      issues2.push({
        ruleId,
        node,
        slot: `${prop}[${i}]`,
        severity,
        currentValue: hex,
        swatch: hex,
        suggestion,
        fixSafety,
        params: {
          prop,
          confidence: match.confidence,
          scopeMismatch: match.scopeMismatch ? 1 : 0,
          hasTokens: hasTokens ? 1 : 0
        },
        plan,
        alternativePlans: Object.keys(alternativePlans).length ? alternativePlans : void 0
      });
    }
    return issues2;
  }
  var colorRules = [
    {
      id: "colors/hardcoded-fill",
      types: PAINT_TYPES,
      check: (node, ctx) => checkPaints(node, "fills", ctx, "colors/hardcoded-fill")
    },
    {
      id: "colors/hardcoded-stroke",
      types: PAINT_TYPES,
      check: (node, ctx) => checkPaints(node, "strokes", ctx, "colors/hardcoded-stroke")
    }
  ];

  // src/plugin/rules/components.ts
  var STYLE_FIELDS = /* @__PURE__ */ new Set([
    "fills",
    "strokes",
    "strokeWeight",
    "cornerRadius",
    "topLeftRadius",
    "topRightRadius",
    "bottomLeftRadius",
    "bottomRightRadius",
    "paddingLeft",
    "paddingRight",
    "paddingTop",
    "paddingBottom",
    "itemSpacing",
    "counterAxisSpacing",
    "fontSize",
    "fontName",
    "lineHeight",
    "letterSpacing",
    "effects",
    "layoutMode",
    "opacity",
    "textStyleId",
    "fillStyleId",
    "strokeStyleId",
    "effectStyleId",
    "width",
    "height"
  ]);
  var HEAVY_OVERRIDES_THRESHOLD = 4;
  var normalizeComponentName = (name) => name.toLowerCase().replace(/\s*copy(\s*\d+)?$/i, "").replace(/\s+\d+$/, "").replace(/\s+/g, " ").trim();
  var componentRules = [
    {
      id: "components/detached-instance",
      types: ["FRAME"],
      check: (node) => {
        const frame = node;
        if (!frame.detachedInfo) return;
        return [
          {
            ruleId: "components/detached-instance",
            node,
            currentValue: frame.name,
            fixSafety: "none",
            params: { origin: frame.detachedInfo.type }
          }
        ];
      }
    },
    {
      id: "components/default-name",
      types: ["FRAME", "GROUP", "SECTION", "COMPONENT", "COMPONENT_SET"],
      check: (node, ctx) => {
        var _a;
        if (!isDefaultName(node.name)) return;
        if (node.type === "COMPONENT" && ((_a = node.parent) == null ? void 0 : _a.type) === "COMPONENT_SET") return;
        void ctx;
        return [
          {
            ruleId: "components/default-name",
            node,
            currentValue: node.name,
            fixSafety: "none",
            params: { type: node.type.toLowerCase() }
          }
        ];
      }
    },
    {
      id: "components/heavy-overrides",
      types: ["INSTANCE"],
      check: (node) => {
        const inst = node;
        let count = 0;
        const fields = /* @__PURE__ */ new Set();
        for (const o of inst.overrides) {
          for (const f of o.overriddenFields) {
            if (STYLE_FIELDS.has(f)) {
              count++;
              fields.add(f);
            }
          }
        }
        if (count < HEAVY_OVERRIDES_THRESHOLD) return;
        return [
          {
            ruleId: "components/heavy-overrides",
            node,
            currentValue: `${count}`,
            fixSafety: "none",
            params: { count, fields: [...fields].slice(0, 6).join(", ") }
          }
        ];
      }
    },
    {
      id: "components/no-description",
      types: ["COMPONENT", "COMPONENT_SET"],
      check: (node, ctx) => {
        var _a, _b;
        if (node.type === "COMPONENT" && ((_a = node.parent) == null ? void 0 : _a.type) === "COMPONENT_SET") return;
        if (ancestors(node, ctx).some((a) => a.type === "COMPONENT" || a.type === "COMPONENT_SET")) return;
        const desc = (_b = node.description) != null ? _b : "";
        if (desc.trim()) return;
        return [
          {
            ruleId: "components/no-description",
            node,
            currentValue: node.name,
            fixSafety: "none"
          }
        ];
      }
    },
    {
      id: "components/duplicate-component",
      types: ["COMPONENT", "COMPONENT_SET"],
      check: (node, ctx) => {
        var _a;
        if (node.type === "COMPONENT" && ((_a = node.parent) == null ? void 0 : _a.type) === "COMPONENT_SET") return;
        ctx.localComponents.push({ node, name: node.name });
      },
      finalize: (ctx) => {
        var _a;
        const groups = /* @__PURE__ */ new Map();
        for (const c of ctx.localComponents) {
          const key = normalizeComponentName(c.name);
          if (!key || isDefaultName(c.name)) continue;
          groups.set(key, [...(_a = groups.get(key)) != null ? _a : [], c]);
        }
        const out = [];
        for (const list of groups.values()) {
          if (list.length < 2) continue;
          for (const c of list) {
            out.push({
              ruleId: "components/duplicate-component",
              node: c.node,
              currentValue: c.name,
              fixSafety: "none",
              params: { count: list.length, others: list.filter((o) => o !== c).map((o) => o.name).slice(0, 3).join(", ") }
            });
          }
        }
        return out;
      }
    }
  ];

  // src/plugin/rules/components-pro.ts
  var MAX_ORPHAN_LOOKUPS = 200;
  function isTopLevelComponent(node) {
    var _a;
    if (node.type === "COMPONENT" && ((_a = node.parent) == null ? void 0 : _a.type) === "COMPONENT_SET") return false;
    return node.type === "COMPONENT" || node.type === "COMPONENT_SET";
  }
  var hasVisible = (paints) => paints !== figma.mixed && paints.some((p) => {
    var _a;
    return p.visible !== false && ((_a = p.opacity) != null ? _a : 1) > 0;
  });
  var componentProRules = [
    {
      id: "components/deprecated-in-use",
      types: ["INSTANCE"],
      check: async (node) => {
        var _a, _b, _c;
        const inst = node;
        let main = null;
        try {
          main = await inst.getMainComponentAsync();
        } catch {
          return;
        }
        if (!main) return;
        const set = ((_a = main.parent) == null ? void 0 : _a.type) === "COMPONENT_SET" ? main.parent : null;
        const hay = `${main.name} ${(_b = main.description) != null ? _b : ""} ${set ? `${set.name} ${(_c = set.description) != null ? _c : ""}` : ""}`;
        if (!DEPRECATED_RE.test(hay)) return;
        return [{ ruleId: "components/deprecated-in-use", node, currentValue: set ? set.name : main.name, fixSafety: "none", params: { component: set ? set.name : main.name } }];
      }
    },
    {
      id: "components/orphan-variant",
      finalize: async (ctx) => {
        const out = [];
        let lookups = 0;
        for (const s of ctx.componentSets) {
          if (s.node.remote) continue;
          for (const child of s.node.children) {
            if (child.type !== "COMPONENT") continue;
            if (++lookups > MAX_ORPHAN_LOOKUPS) return out;
            try {
              const instances = await child.getInstancesAsync();
              if (instances.length) continue;
            } catch {
              continue;
            }
            out.push({ ruleId: "components/orphan-variant", node: child, currentValue: child.name, fixSafety: "none", params: { variant: child.name, component: s.name } });
          }
        }
        return out;
      }
    },
    {
      id: "components/useless-nesting",
      types: ["GROUP", "FRAME"],
      check: (node) => {
        var _a;
        if (((_a = node.parent) == null ? void 0 : _a.type) === "PAGE") return;
        const children = node.children.filter((c) => c.visible);
        if (children.length !== 1) return;
        const only = children[0];
        if (node.type === "FRAME") {
          const frame = node;
          if (frame.layoutMode !== "NONE" || frame.clipsContent || frame.detachedInfo || frame.reactions.length) return;
          if (hasVisible(frame.fills) || hasVisible(frame.strokes) || frame.effects.some((e) => e.visible)) return;
          if (Math.abs(only.width - frame.width) > 1 || Math.abs(only.height - frame.height) > 1 || Math.abs(only.x) > 1 || Math.abs(only.y) > 1) return;
        }
        return [{ ruleId: "components/useless-nesting", node, currentValue: node.name, fixSafety: "none", params: { type: node.type === "GROUP" ? "group" : "frame", child: only.name } }];
      }
    },
    {
      id: "components/no-doc-link",
      types: ["COMPONENT", "COMPONENT_SET"],
      check: (node, ctx) => {
        var _a;
        if (!isTopLevelComponent(node) || ancestors(node, ctx).some((a) => a.type === "COMPONENT" || a.type === "COMPONENT_SET")) return;
        const comp = node;
        if (comp.documentationLinks.length || /https?:\/\//i.test((_a = comp.description) != null ? _a : "")) {
          ctx.docLinkSeen = true;
          return;
        }
        ctx.componentsForDocs.push(comp);
      },
      finalize: (ctx) => {
        if (!ctx.docLinkSeen) return;
        return ctx.componentsForDocs.map((c) => ({ ruleId: "components/no-doc-link", node: c, currentValue: c.name, fixSafety: "none", params: { component: c.name } }));
      }
    },
    {
      id: "components/no-status",
      types: ["COMPONENT", "COMPONENT_SET"],
      check: (node, ctx) => {
        if (!isTopLevelComponent(node) || ancestors(node, ctx).some((a) => a.type === "COMPONENT" || a.type === "COMPONENT_SET")) return;
        if (!ctx.localComponents.some((c) => c.node.id === node.id)) ctx.localComponents.push({ node, name: node.name });
      },
      finalize: (ctx) => {
        var _a, _b, _c;
        const all = ctx.localComponents;
        if (all.length < 3) return;
        const withStatus = all.filter((c) => {
          var _a2;
          return STATUS_RE.test(`${c.name} ${(_a2 = c.node.description) != null ? _a2 : ""}`);
        });
        if (withStatus.length / all.length < 0.3) return;
        const sample = (_c = (_b = STATUS_RE.exec(`${withStatus[0].name} ${(_a = withStatus[0].node.description) != null ? _a : ""}`)) == null ? void 0 : _b[0]) != null ? _c : "";
        return all.filter((c) => !withStatus.includes(c)).map((c) => ({ ruleId: "components/no-status", node: c.node, currentValue: c.name, fixSafety: "none", params: { component: c.name, example: sample } }));
      }
    }
  ];

  // src/plugin/rules/types.ts
  function toMs(duration) {
    return Math.round(duration < 10 ? duration * 1e3 : duration);
  }

  // src/plugin/rules/craft.ts
  var capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function collectStates(set) {
    var _a;
    const defs = set.componentPropertyDefinitions;
    const canonical = /* @__PURE__ */ new Set();
    let stateProp = null;
    let stateValues = [];
    for (const [name, def] of Object.entries(defs)) {
      const options = (_a = def.variantOptions) != null ? _a : [];
      if (def.type === "VARIANT" && !stateProp && isStateProperty(name, options)) {
        stateProp = name;
        stateValues = options;
        for (const v of options) {
          const c2 = canonicalState(v);
          if (c2) canonical.add(c2);
        }
        continue;
      }
      const c = canonicalState(name);
      if (c && (def.type === "BOOLEAN" || def.type === "VARIANT")) canonical.add(c);
    }
    return { stateProp, stateValues, canonical };
  }
  function hoverTransitions(set) {
    var _a, _b;
    const out = [];
    for (const child of set.children) {
      if (!("reactions" in child)) continue;
      for (const r of child.reactions) {
        const t = (_a = r.trigger) == null ? void 0 : _a.type;
        if (t !== "ON_HOVER" && t !== "MOUSE_ENTER") continue;
        const actions = (_b = r.actions) != null ? _b : r.action ? [r.action] : [];
        for (const a of actions) {
          if (a.type === "NODE" && a.navigation === "CHANGE_TO" && a.transition && "duration" in a.transition) {
            out.push({ nodeId: child.id, duration: toMs(a.transition.duration), easing: a.transition.easing.type });
          }
        }
      }
    }
    return out;
  }
  function defaultVariantsHaveHover(set, stateProp) {
    const defaults = set.children.filter((c) => {
      var _a;
      if (c.type !== "COMPONENT") return false;
      const v = (_a = c.variantProperties) == null ? void 0 : _a[stateProp];
      return v !== void 0 && canonicalState(v) === "default";
    });
    if (!defaults.length) return null;
    return defaults.some(
      (d) => d.reactions.some((r) => {
        var _a;
        const t = (_a = r.trigger) == null ? void 0 : _a.type;
        return t === "ON_HOVER" || t === "MOUSE_ENTER";
      })
    );
  }
  function textsInside(set) {
    const first = set.children[0];
    if (!first || !("findAllWithCriteria" in first)) return "";
    const texts = first.findAllWithCriteria({ types: ["TEXT"] }).slice(0, 6);
    return texts.map((t) => t.characters).join(" ");
  }
  var craftRules = [
    {
      id: "craft/missing-state",
      types: ["COMPONENT_SET"],
      check: (node, ctx) => {
        var _a;
        const set = node;
        const { stateProp, stateValues, canonical } = collectStates(set);
        const kind = inferComponentKind(set.name, set.description);
        const transitions = hoverTransitions(set);
        if (transitions.length) ctx.anySetHasReactions = true;
        const info = { node: set, name: set.name, kind, stateProp, stateValues, hoverDurations: transitions };
        ctx.componentSets.push(info);
        const out = [];
        if (!stateProp) return out;
        const expected = EXPECTED_STATES[kind];
        if (expected) {
          for (const e of expected) {
            if (canonical.has(e.state)) continue;
            out.push({
              ruleId: "craft/missing-state",
              node,
              slot: e.state,
              severity: e.severity,
              currentValue: stateValues.join(" \xB7 "),
              suggestion: { kind: "value", id: e.state, label: `${stateProp}=${capitalize(e.state)}`, confidence: "none" },
              fixSafety: "none",
              params: { state: e.state, kind, component: set.name, prop: stateProp }
            });
          }
        }
        if (ctx.activeRules.has("craft/missing-loading-state") && (kind === "button" || kind === "icon-button") && !canonical.has("loading")) {
          if (looksLikeLongAction(set.name) || looksLikeLongAction(set.description) || looksLikeLongAction(textsInside(set))) {
            out.push({
              ruleId: "craft/missing-loading-state",
              node,
              currentValue: stateValues.join(" \xB7 "),
              suggestion: { kind: "value", id: "loading", label: `${stateProp}=Loading`, confidence: "none" },
              fixSafety: "none",
              params: { component: set.name, prop: stateProp }
            });
          }
        }
        if (ctx.activeRules.has("craft/duplicate-state")) {
          const byCanon = /* @__PURE__ */ new Map();
          for (const v of stateValues) {
            const c = canonicalState(v);
            if (c) byCanon.set(c, [...(_a = byCanon.get(c)) != null ? _a : [], v]);
          }
          for (const [c, values] of byCanon) {
            if (values.length < 2) continue;
            out.push({
              ruleId: "craft/duplicate-state",
              node,
              slot: c,
              currentValue: values.join(" \xB7 "),
              fixSafety: "none",
              params: { state: c, values: values.join(", "), component: set.name, prop: stateProp }
            });
          }
        }
        if (ctx.activeRules.has("craft/state-matrix-thin") && expected && canonical.size < 3) {
          out.push({
            ruleId: "craft/state-matrix-thin",
            node,
            currentValue: stateValues.join(" \xB7 "),
            fixSafety: "none",
            params: { count: canonical.size, component: set.name, kind, prop: stateProp }
          });
        }
        if (ctx.activeRules.has("craft/missing-success-state") && (kind === "button" || kind === "icon-button") && !canonical.has("success")) {
          if (looksLikeLongAction(set.name) || looksLikeLongAction(textsInside(set))) {
            out.push({
              ruleId: "craft/missing-success-state",
              node,
              currentValue: stateValues.join(" \xB7 "),
              suggestion: { kind: "value", id: "success", label: `${stateProp}=Success`, confidence: "none" },
              fixSafety: "none",
              params: { component: set.name, prop: stateProp }
            });
          }
        }
        if (ctx.activeRules.has("craft/missing-empty-state") && EMPTY_STATE_KINDS.includes(kind) && !canonical.has("empty")) {
          out.push({
            ruleId: "craft/missing-empty-state",
            node,
            currentValue: stateValues.join(" \xB7 "),
            suggestion: { kind: "value", id: "empty", label: `${stateProp}=Empty`, confidence: "none" },
            fixSafety: "none",
            params: { component: set.name, kind, prop: stateProp }
          });
        }
        return out;
      }
    },
    // Les règles ci-dessous partagent la collecte de craft/missing-state ; leur `check` est vide.
    { id: "craft/missing-loading-state", types: ["COMPONENT_SET"] },
    { id: "craft/missing-empty-state", types: ["COMPONENT_SET"] },
    { id: "craft/missing-success-state", types: ["COMPONENT_SET"] },
    { id: "craft/duplicate-state", types: ["COMPONENT_SET"] },
    { id: "craft/state-matrix-thin", types: ["COMPONENT_SET"] },
    {
      id: "craft/missing-hover-transition",
      types: ["COMPONENT_SET"],
      finalize: (ctx) => {
        if (!ctx.anySetHasReactions) return;
        const out = [];
        for (const s of ctx.componentSets) {
          if (!s.stateProp) continue;
          const canon = new Set(s.stateValues.map((v) => canonicalState(v)));
          if (!canon.has("hover") || !canon.has("default")) continue;
          const has = defaultVariantsHaveHover(s.node, s.stateProp);
          if (has === false) {
            out.push({
              ruleId: "craft/missing-hover-transition",
              node: s.node,
              currentValue: s.name,
              fixSafety: "none",
              params: { component: s.name }
            });
          }
        }
        return out;
      }
    },
    {
      id: "craft/state-naming",
      types: ["COMPONENT_SET"],
      finalize: (ctx) => {
        var _a, _b, _c;
        const sets = ctx.componentSets.filter((s) => s.stateProp);
        if (sets.length < 2) return;
        const out = [];
        const propCounts = /* @__PURE__ */ new Map();
        for (const s of sets) propCounts.set(s.stateProp, ((_a = propCounts.get(s.stateProp)) != null ? _a : 0) + 1);
        const majorityProp = [...propCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
        const spelling = /* @__PURE__ */ new Map();
        for (const s of sets) {
          for (const v of s.stateValues) {
            const c = canonicalState(v);
            if (!c) continue;
            const m = (_b = spelling.get(c)) != null ? _b : /* @__PURE__ */ new Map();
            m.set(v, ((_c = m.get(v)) != null ? _c : 0) + 1);
            spelling.set(c, m);
          }
        }
        const majoritySpelling = /* @__PURE__ */ new Map();
        for (const [c, m] of spelling) majoritySpelling.set(c, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]);
        for (const s of sets) {
          const problems = [];
          if (s.stateProp !== majorityProp && propCounts.size > 1) problems.push(`${s.stateProp} \u2192 ${majorityProp}`);
          for (const v of s.stateValues) {
            const c = canonicalState(v);
            if (!c) continue;
            const expected = majoritySpelling.get(c);
            if (expected !== v && normalizeStateValue(expected) !== normalizeStateValue(v) + "!") problems.push(`${v} \u2192 ${expected}`);
          }
          const unique2 = [...new Set(problems)].filter((p) => p.split(" \u2192 ")[0] !== p.split(" \u2192 ")[1]);
          if (!unique2.length) continue;
          out.push({
            ruleId: "craft/state-naming",
            node: s.node,
            currentValue: unique2.join(", "),
            fixSafety: "none",
            params: { component: s.name, changes: unique2.join(", ") }
          });
        }
        return out;
      }
    },
    {
      id: "craft/inconsistent-motion",
      types: ["COMPONENT_SET"],
      finalize: (ctx) => {
        var _a, _b, _c;
        const out = [];
        const byKind = /* @__PURE__ */ new Map();
        for (const s of ctx.componentSets) {
          for (const h of s.hoverDurations) {
            const key = s.kind === "unknown" ? `unknown:${s.name}` : s.kind;
            byKind.set(key, [...(_a = byKind.get(key)) != null ? _a : [], { set: s, nodeId: h.nodeId, duration: h.duration }]);
          }
        }
        for (const [kind, list] of byKind) {
          const counts = /* @__PURE__ */ new Map();
          for (const l of list) counts.set(l.duration, ((_b = counts.get(l.duration)) != null ? _b : 0) + 1);
          if (counts.size < 2) continue;
          const mode = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
          for (const l of list) {
            if (l.duration === mode) continue;
            const variant = (_c = l.set.node.children.find((c) => c.id === l.nodeId)) != null ? _c : l.set.node;
            out.push({
              ruleId: "craft/inconsistent-motion",
              node: variant,
              currentValue: `${l.duration} ms`,
              suggestion: { kind: "value", id: String(mode), label: `${mode} ms`, confidence: "close" },
              fixSafety: "review",
              params: { duration: l.duration, mode, kind: kind.replace(/^unknown:/, ""), component: l.set.name },
              plan: { kind: "set-hover-duration", nodeId: l.nodeId, durationMs: mode }
            });
          }
        }
        return out;
      }
    }
  ];

  // src/plugin/rules/craft-pro.ts
  var ACTION_KINDS = /* @__PURE__ */ new Set(["button", "icon-button", "link", "chip"]);
  var FIELD_KINDS2 = /* @__PURE__ */ new Set(["input", "select", "checkbox", "radio", "toggle", "search", "chip", "tab"]);
  var MAX_TRANSITION_MS = 500;
  var CAPPED_MS = 300;
  function nodeActions(node) {
    var _a, _b, _c;
    if (!("reactions" in node)) return [];
    const out = [];
    for (const r of node.reactions) {
      const actions = (_a = r.actions) != null ? _a : r.action ? [r.action] : [];
      for (const a of actions) out.push({ trigger: (_c = (_b = r.trigger) == null ? void 0 : _b.type) != null ? _c : "", action: a, reaction: r });
    }
    return out;
  }
  var craftProRules = [
    {
      id: "craft/destructive-without-confirm",
      types: ["TEXT", "FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE"],
      insideInstances: true,
      check: (node, ctx) => {
        var _a;
        if (node.type !== "TEXT") {
          if (CONFIRM_RE.test(node.name)) ctx.confirmPatternSeen = true;
          return;
        }
        const text = node.characters.trim();
        if (!text || text.length > 40 || !DESTRUCTIVE_RE.test(text)) return;
        const host = (_a = ancestors(node, ctx).find((a) => ACTION_KINDS.has(inferComponentKind(a.name)) || isInteractiveByReactions(a))) != null ? _a : node;
        if (!ctx.destructiveNodes.some((n) => n.id === host.id)) ctx.destructiveNodes.push(host);
      },
      finalize: (ctx) => {
        if (ctx.confirmPatternSeen) return;
        return ctx.destructiveNodes.map((n) => ({ ruleId: "craft/destructive-without-confirm", node: n, currentValue: n.name, fixSafety: "none", params: { label: n.name } }));
      }
    },
    {
      id: "craft/error-without-recovery",
      types: ["FRAME", "COMPONENT", "INSTANCE"],
      check: (node, ctx) => {
        var _a, _b;
        const isVariantError = node.type === "COMPONENT" && Object.values((_a = node.variantProperties) != null ? _a : {}).some((v) => canonicalState(v) === "error");
        if (!isVariantError && !ERROR_NAME_RE.test(node.name)) return;
        if (ancestors(node, ctx).some((a) => ERROR_NAME_RE.test(a.name))) return;
        if (node.width < 200 || node.height < 120) return;
        const kind = inferComponentKind(node.type === "COMPONENT" && ((_b = node.parent) == null ? void 0 : _b.type) === "COMPONENT_SET" ? node.parent.name : node.name);
        if (FIELD_KINDS2.has(kind)) return;
        const host = node;
        const texts = host.findAllWithCriteria({ types: ["TEXT"] });
        if (!texts.length) return;
        const recovery = texts.some((t) => RECOVERY_RE.test(t.characters)) || host.findAllWithCriteria({ types: ["INSTANCE", "FRAME", "COMPONENT"] }).some((c) => ACTION_KINDS.has(inferComponentKind(c.name)) || isInteractiveByReactions(c));
        if (recovery) return;
        return [{ ruleId: "craft/error-without-recovery", node, currentValue: node.name, fixSafety: "none", params: { name: node.name } }];
      }
    },
    {
      id: "craft/generic-error-message",
      types: ["TEXT"],
      insideInstances: true,
      check: (node) => {
        const text = node.characters.trim();
        if (!text || !GENERIC_ERROR_RE.test(text)) return;
        return [{ ruleId: "craft/generic-error-message", node, currentValue: text, fixSafety: "none", params: { text } }];
      }
    },
    {
      id: "craft/inconsistent-easing",
      finalize: (ctx) => {
        var _a, _b, _c;
        const out = [];
        const byKind = /* @__PURE__ */ new Map();
        for (const s of ctx.componentSets) {
          for (const h of s.hoverDurations) {
            const key = s.kind === "unknown" ? `unknown:${s.name}` : s.kind;
            byKind.set(key, [...(_a = byKind.get(key)) != null ? _a : [], { set: s, nodeId: h.nodeId, easing: h.easing }]);
          }
        }
        for (const [kind, list] of byKind) {
          const counts = /* @__PURE__ */ new Map();
          for (const l of list) counts.set(l.easing, ((_b = counts.get(l.easing)) != null ? _b : 0) + 1);
          if (counts.size < 2) continue;
          const mode = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
          for (const l of list) {
            if (l.easing === mode) continue;
            const variant = (_c = l.set.node.children.find((c) => c.id === l.nodeId)) != null ? _c : l.set.node;
            out.push({
              ruleId: "craft/inconsistent-easing",
              node: variant,
              currentValue: l.easing,
              suggestion: { kind: "value", id: mode, label: mode, confidence: "close" },
              fixSafety: "review",
              params: { easing: l.easing, mode, kind: kind.replace(/^unknown:/, ""), component: l.set.name },
              plan: { kind: "set-hover-easing", nodeId: l.nodeId, easing: mode }
            });
          }
        }
        return out;
      }
    },
    {
      id: "craft/transition-too-long",
      types: ["COMPONENT", "FRAME", "INSTANCE"],
      check: (node) => {
        let max = 0;
        for (const { action } of nodeActions(node)) {
          if (action.type !== "NODE" || !action.transition || !("duration" in action.transition)) continue;
          max = Math.max(max, toMs(action.transition.duration));
        }
        if (max <= MAX_TRANSITION_MS) return;
        return [
          {
            ruleId: "craft/transition-too-long",
            node,
            currentValue: `${max} ms`,
            suggestion: { kind: "value", id: String(CAPPED_MS), label: `\u2264 ${CAPPED_MS} ms`, confidence: "close" },
            fixSafety: "review",
            params: { duration: max, max: MAX_TRANSITION_MS, capped: CAPPED_MS },
            plan: { kind: "cap-transition-duration", nodeId: node.id, maxMs: CAPPED_MS }
          }
        ];
      }
    },
    {
      id: "craft/non-reversible-hover",
      types: ["COMPONENT"],
      check: (node) => {
        const set = node.parent;
        if (!set || set.type !== "COMPONENT_SET") return;
        const out = [];
        for (const { trigger, action } of nodeActions(node)) {
          if (trigger !== "MOUSE_ENTER" || action.type !== "NODE" || action.navigation !== "CHANGE_TO" || !action.destinationId) continue;
          const destination = set.children.find((c) => c.id === action.destinationId);
          if (!destination || !("reactions" in destination)) continue;
          const back = destination.reactions.some((r) => {
            var _a;
            return ((_a = r.trigger) == null ? void 0 : _a.type) === "MOUSE_LEAVE";
          });
          if (back) continue;
          out.push({
            ruleId: "craft/non-reversible-hover",
            node,
            slot: destination.id,
            currentValue: `${node.name} \u2192 ${destination.name}`,
            fixSafety: "none",
            params: { component: set.name, from: node.name, to: destination.name }
          });
        }
        return out;
      }
    }
  ];

  // src/shared/scale.ts
  var EPS = 0.01;
  function matchScale(value, candidates, tolerance) {
    if (!candidates.length) return { confidence: "none", candidates: [] };
    const sorted = candidates.map((c) => ({ c, d: Math.abs(c.value - value) })).sort((a, b) => a.d - b.d);
    const [first, second] = sorted;
    if (first.d < EPS) return { confidence: "exact", best: first.c, candidates: [first.c] };
    const within = sorted.filter((s) => s.d <= tolerance + EPS);
    if (!within.length) return { confidence: "none", candidates: [] };
    if (within.length >= 2 && second && Math.abs(second.d - first.d) <= 1 + EPS) {
      return { confidence: "ambiguous", best: first.c, candidates: within.slice(0, 3).map((s) => s.c) };
    }
    return { confidence: "close", best: first.c, candidates: within.slice(0, 3).map((s) => s.c) };
  }
  function isOnGrid(value, grid) {
    if (grid <= 0) return true;
    const r = Math.abs(value) % grid;
    return r < EPS || Math.abs(r - grid) < EPS;
  }
  function isInteger(value, eps = 0.01) {
    return Math.abs(value - Math.round(value)) < eps;
  }
  function px(value) {
    const rounded = Math.round(value * 100) / 100;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace(/0+$/, "")} px`;
  }

  // src/plugin/rules/handoff.ts
  var SIZE_TYPES = ["FRAME", "RECTANGLE", "ELLIPSE", "INSTANCE", "COMPONENT", "TEXT"];
  function parentHasAutoLayout(node) {
    const p = node.parent;
    return !!p && p.type !== "PAGE" && hasAutoLayout(p) && node.layoutPositioning !== "ABSOLUTE";
  }
  function detectStack(children) {
    if (children.length < 2) return null;
    const byX = [...children].sort((a, b) => a.x - b.x);
    let row = true;
    for (let i = 1; i < byX.length && row; i++) {
      const prev = byX[i - 1];
      const cur = byX[i];
      if (cur.x < prev.x + prev.width - 1) row = false;
      if (cur.y > prev.y + prev.height - 1 || prev.y > cur.y + cur.height - 1) row = false;
    }
    if (row) return "row";
    const byY = [...children].sort((a, b) => a.y - b.y);
    let column = true;
    for (let i = 1; i < byY.length && column; i++) {
      const prev = byY[i - 1];
      const cur = byY[i];
      if (cur.y < prev.y + prev.height - 1) column = false;
      if (cur.x > prev.x + prev.width - 1 || prev.x > cur.x + cur.width - 1) column = false;
    }
    return column ? "column" : null;
  }
  var handoffRules = [
    {
      id: "handoff/fractional-size",
      types: SIZE_TYPES,
      check: (node) => {
        if (node.type === "TEXT" && node.textAutoResize === "WIDTH_AND_HEIGHT") return;
        if ("rotation" in node && Math.abs(node.rotation) > 0.01) return;
        let checkW = true;
        let checkH = true;
        if (parentHasAutoLayout(node) && "layoutSizingHorizontal" in node) {
          checkW = node.layoutSizingHorizontal === "FIXED";
          checkH = node.layoutSizingVertical === "FIXED";
        }
        if (hasAutoLayout(node)) {
          if (node.layoutSizingHorizontal !== "FIXED") checkW = false;
          if (node.layoutSizingVertical !== "FIXED") checkH = false;
        }
        if (node.type === "TEXT" && node.textAutoResize === "HEIGHT") checkH = false;
        const badW = checkW && !isInteger(node.width);
        const badH = checkH && !isInteger(node.height);
        if (!badW && !badH) return;
        return [
          {
            ruleId: "handoff/fractional-size",
            node,
            currentValue: `${px(node.width).replace(" px", "")} \xD7 ${px(node.height)}`,
            suggestion: { kind: "value", id: "round", label: `${Math.round(node.width)} \xD7 ${Math.round(node.height)} px`, confidence: "exact" },
            fixSafety: "safe",
            params: { width: px(node.width), height: px(node.height) },
            plan: { kind: "round-size", nodeId: node.id }
          }
        ];
      }
    },
    {
      id: "handoff/fractional-position",
      types: SIZE_TYPES,
      check: (node) => {
        if (parentHasAutoLayout(node)) return;
        if ("rotation" in node && Math.abs(node.rotation) > 0.01) return;
        if (isInteger(node.x) && isInteger(node.y)) return;
        return [
          {
            ruleId: "handoff/fractional-position",
            node,
            currentValue: `x ${px(node.x).replace(" px", "")} \xB7 y ${px(node.y)}`,
            suggestion: { kind: "value", id: "round", label: `x ${Math.round(node.x)} \xB7 y ${Math.round(node.y)} px`, confidence: "exact" },
            fixSafety: "safe",
            params: { x: px(node.x), y: px(node.y) },
            plan: { kind: "round-position", nodeId: node.id }
          }
        ];
      }
    },
    {
      id: "handoff/stackable-without-autolayout",
      types: ["FRAME"],
      check: (node) => {
        const frame = node;
        if (frame.layoutMode !== "NONE") return;
        const kids = frame.children.filter((c) => c.visible);
        if (kids.length < 2 || kids.length > 12) return;
        if (kids.some((k) => "rotation" in k && Math.abs(k.rotation) > 0.01)) return;
        const stack = detectStack(kids.map((k) => ({ x: k.x, y: k.y, width: k.width, height: k.height })));
        if (!stack) return;
        return [
          {
            ruleId: "handoff/stackable-without-autolayout",
            node,
            currentValue: `${kids.length} ${stack}`,
            suggestion: { kind: "value", id: stack, label: stack === "row" ? "Auto layout \u2192" : "Auto layout \u2193", confidence: "close" },
            fixSafety: "none",
            params: { count: kids.length, direction: stack }
          }
        ];
      }
    }
  ];

  // src/plugin/rules/handoff-pro.ts
  var MIN_REPEATS = 3;
  function signature(node, depth) {
    const base = `${node.type}:${roleName(node.name)}:${Math.round(node.width / 4)}x${Math.round(node.height / 4)}`;
    if (depth === 0 || !("children" in node)) return base;
    const kids = node.children.slice(0, 12).map((c) => signature(c, depth - 1));
    return `${base}[${kids.join(",")}]`;
  }
  var handoffProRules = [
    {
      id: "handoff/repeated-pattern",
      types: ["FRAME", "GROUP", "SECTION", "COMPONENT"],
      check: (node) => {
        var _a;
        const children = node.children.filter((c) => c.visible && (c.type === "FRAME" || c.type === "GROUP") && "children" in c && c.children.length >= 2);
        if (children.length < MIN_REPEATS) return;
        const groups = /* @__PURE__ */ new Map();
        for (const c of children) {
          const sig = signature(c, 2);
          groups.set(sig, [...(_a = groups.get(sig)) != null ? _a : [], c]);
        }
        const out = [];
        for (const list of groups.values()) {
          if (list.length < MIN_REPEATS) continue;
          out.push({
            ruleId: "handoff/repeated-pattern",
            node: list[0],
            currentValue: `${list.length} \xD7 ${list[0].name}`,
            fixSafety: "none",
            params: { count: list.length, name: list[0].name, parent: node.name }
          });
        }
        return out;
      }
    },
    {
      id: "handoff/image-crop",
      types: ["RECTANGLE", "FRAME", "ELLIPSE", "POLYGON", "INSTANCE", "COMPONENT"],
      check: (node) => {
        const fills = node.fills;
        if (fills === figma.mixed) return;
        const cropped = fills.some((p) => p.type === "IMAGE" && p.visible !== false && p.scaleMode === "CROP");
        if (!cropped) return;
        return [{ ruleId: "handoff/image-crop", node, currentValue: "Crop", fixSafety: "none", params: { name: node.name } }];
      }
    }
  ];

  // src/plugin/rules/layout-pro.ts
  var CHILD_TYPES = ["FRAME", "COMPONENT", "INSTANCE", "RECTANGLE", "TEXT", "GROUP", "ELLIPSE", "VECTOR", "BOOLEAN_OPERATION"];
  var EPS2 = 0.6;
  function visibleChildren(parent) {
    return parent.children.filter((c) => c.visible && "layoutPositioning" in c && c.layoutPositioning !== "ABSOLUTE");
  }
  var layoutProRules = [
    {
      id: "spacing/rhythm-near-miss",
      types: ["FRAME", "COMPONENT", "INSTANCE"],
      check: (node, ctx) => {
        if (!hasAutoLayout(node) || node.layoutMode === "NONE" || isDefaultName(node.name)) return;
        if (visibleChildren(node).length < 2) return;
        ctx.autoLayoutFrames.push({ node, role: roleName(node.name), mode: node.layoutMode, gap: node.itemSpacing });
      },
      finalize: (ctx) => {
        var _a, _b;
        const groups = /* @__PURE__ */ new Map();
        for (const f of ctx.autoLayoutFrames) {
          const key = `${f.role}|${f.mode}`;
          groups.set(key, [...(_a = groups.get(key)) != null ? _a : [], f]);
        }
        const out = [];
        for (const list of groups.values()) {
          if (list.length < 3) continue;
          const gaps = list.map((f) => f.gap);
          const min = Math.min(...gaps);
          const max = Math.max(...gaps);
          if (max === min || max - min > 6) continue;
          const counts = /* @__PURE__ */ new Map();
          for (const g of gaps) counts.set(g, ((_b = counts.get(g)) != null ? _b : 0) + 1);
          const mode = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
          for (const f of list) {
            if (f.gap === mode) continue;
            out.push({
              ruleId: "spacing/rhythm-near-miss",
              node: f.node,
              currentValue: `${f.gap} px`,
              suggestion: { kind: "value", id: String(mode), label: `${mode} px`, confidence: "close" },
              fixSafety: "review",
              params: { gap: f.gap, mode, role: f.node.name, count: list.length },
              plan: { kind: "set-number", nodeId: f.node.id, field: "itemSpacing", value: mode }
            });
          }
        }
        return out;
      }
    },
    {
      id: "spacing/fixed-should-fill",
      types: CHILD_TYPES,
      check: (node) => {
        const parent = node.parent;
        if (!parent || !hasAutoLayout(parent) || parent.layoutMode === "NONE") return;
        if (!("layoutSizingHorizontal" in node) || node.layoutPositioning === "ABSOLUTE") return;
        const p = parent;
        const child = node;
        const out = [];
        if (p.layoutMode === "VERTICAL" && child.layoutSizingHorizontal === "FIXED") {
          const inner = p.width - p.paddingLeft - p.paddingRight;
          if (Math.abs(child.width - inner) < EPS2 && inner > 0) {
            out.push({
              ruleId: "spacing/fixed-should-fill",
              node,
              slot: "horizontal",
              currentValue: `${Math.round(child.width)} px`,
              suggestion: { kind: "value", id: "FILL", label: "Fill", confidence: "exact" },
              fixSafety: "review",
              params: { axis: "width", size: Math.round(child.width), parent: p.name },
              plan: { kind: "set-layout-sizing", nodeId: node.id, axis: "horizontal", value: "FILL" }
            });
          }
        }
        if (p.layoutMode === "HORIZONTAL" && child.layoutSizingVertical === "FIXED") {
          const inner = p.height - p.paddingTop - p.paddingBottom;
          if (Math.abs(child.height - inner) < EPS2 && inner > 0 && visibleChildren(p).length > 1) {
            out.push({
              ruleId: "spacing/fixed-should-fill",
              node,
              slot: "vertical",
              currentValue: `${Math.round(child.height)} px`,
              suggestion: { kind: "value", id: "FILL", label: "Fill", confidence: "exact" },
              fixSafety: "review",
              params: { axis: "height", size: Math.round(child.height), parent: p.name },
              plan: { kind: "set-layout-sizing", nodeId: node.id, axis: "vertical", value: "FILL" }
            });
          }
        }
        return out;
      }
    },
    {
      id: "spacing/fixed-should-hug",
      types: ["FRAME", "COMPONENT"],
      check: (node) => {
        if (!hasAutoLayout(node) || node.layoutMode === "NONE" || node.layoutWrap === "WRAP") return;
        const kids = visibleChildren(node);
        if (!kids.length) return;
        const horizontal = node.layoutMode === "HORIZONTAL";
        const out = [];
        if (node.primaryAxisSizingMode === "FIXED" && node.primaryAxisAlignItems !== "SPACE_BETWEEN") {
          const fills = kids.some((k) => (horizontal ? k.layoutSizingHorizontal : k.layoutSizingVertical) === "FILL");
          if (!fills) {
            const sum = kids.reduce((s, k) => s + (horizontal ? k.width : k.height), 0) + node.itemSpacing * (kids.length - 1);
            const hug = sum + (horizontal ? node.paddingLeft + node.paddingRight : node.paddingTop + node.paddingBottom);
            const actual = horizontal ? node.width : node.height;
            if (Math.abs(actual - hug) < EPS2) {
              out.push({
                ruleId: "spacing/fixed-should-hug",
                node,
                slot: "primary",
                currentValue: `${Math.round(actual)} px`,
                suggestion: { kind: "value", id: "HUG", label: "Hug", confidence: "exact" },
                fixSafety: "review",
                params: { axis: horizontal ? "width" : "height", size: Math.round(actual) },
                plan: { kind: "set-axis-sizing", nodeId: node.id, axis: "primary", value: "AUTO" }
              });
            }
          }
        }
        if (node.counterAxisSizingMode === "FIXED") {
          const fills = kids.some((k) => (horizontal ? k.layoutSizingVertical : k.layoutSizingHorizontal) === "FILL");
          if (!fills) {
            const max = Math.max(...kids.map((k) => horizontal ? k.height : k.width));
            const hug = max + (horizontal ? node.paddingTop + node.paddingBottom : node.paddingLeft + node.paddingRight);
            const actual = horizontal ? node.height : node.width;
            if (Math.abs(actual - hug) < EPS2) {
              out.push({
                ruleId: "spacing/fixed-should-hug",
                node,
                slot: "counter",
                currentValue: `${Math.round(actual)} px`,
                suggestion: { kind: "value", id: "HUG", label: "Hug", confidence: "exact" },
                fixSafety: "review",
                params: { axis: horizontal ? "height" : "width", size: Math.round(actual) },
                plan: { kind: "set-axis-sizing", nodeId: node.id, axis: "counter", value: "AUTO" }
              });
            }
          }
        }
        return out;
      }
    },
    {
      id: "spacing/text-overlap",
      types: ["TEXT"],
      check: (node) => {
        const parent = node.parent;
        if (!parent || parent.type === "PAGE" || parent.type === "DOCUMENT") return;
        if (hasAutoLayout(parent) && parent.layoutMode !== "NONE") return;
        const box = node.absoluteBoundingBox;
        if (!box) return;
        const siblings = parent.children;
        const index = siblings.indexOf(node);
        const out = [];
        for (let i = 0; i < index; i++) {
          const other = siblings[i];
          if (other.type !== "TEXT" || !other.visible) continue;
          const ob = other.absoluteBoundingBox;
          if (!ob) continue;
          const dx = Math.min(box.x + box.width, ob.x + ob.width) - Math.max(box.x, ob.x);
          const dy = Math.min(box.y + box.height, ob.y + ob.height) - Math.max(box.y, ob.y);
          if (dx > 2 && dy > 2) {
            out.push({
              ruleId: "spacing/text-overlap",
              node,
              slot: other.id,
              currentValue: `${Math.round(dx)} \xD7 ${Math.round(dy)} px`,
              fixSafety: "none",
              params: { other: other.name, dx: Math.round(dx), dy: Math.round(dy) }
            });
          }
        }
        return out;
      }
    }
  ];

  // src/plugin/rules/spacing.ts
  var LAYOUT_TYPES = ["FRAME", "COMPONENT"];
  var RADIUS_TYPES = ["FRAME", "COMPONENT", "RECTANGLE"];
  function floatLabel(t) {
    return t.name;
  }
  function describe(match) {
    if (!match.best) return void 0;
    const alts = match.candidates.slice(1).map((c) => ({ id: `var:${c.ref.id}`, label: floatLabel(c.ref), value: px(c.value) }));
    return {
      kind: "variable",
      id: match.best.ref.id,
      label: floatLabel(match.best.ref),
      value: px(match.best.value),
      confidence: match.confidence,
      source: match.best.ref.source === "Local" ? match.best.ref.collection || "Local" : `${match.best.ref.source} \xB7 ${match.best.ref.collection}`,
      alternatives: alts.length ? alts : void 0
    };
  }
  function evaluateNumber(ruleId, node, fields, value, scale, ctx, opts) {
    if (scale.length) {
      const match = matchScale(value, scale, opts.tolerance);
      if (match.confidence === "exact") {
        return {
          ruleId,
          node,
          slot: fields.join("+"),
          severity: "error",
          currentValue: px(value),
          suggestion: describe(match),
          fixSafety: "safe",
          params: { fields: fields.join(", "), label: opts.label, confidence: "exact" },
          plan: { kind: "bind-number", nodeId: node.id, fields, variableId: match.best.ref.id }
        };
      }
      const plan = match.best ? { kind: "bind-number", nodeId: node.id, fields, variableId: match.best.ref.id } : void 0;
      const alternativePlans = Object.fromEntries(
        match.candidates.slice(1).map((c) => [`var:${c.ref.id}`, { kind: "bind-number", nodeId: node.id, fields, variableId: c.ref.id }])
      );
      return {
        ruleId,
        node,
        slot: fields.join("+"),
        severity: "warning",
        currentValue: px(value),
        suggestion: describe(match),
        fixSafety: match.confidence === "none" ? "none" : "review",
        params: { fields: fields.join(", "), label: opts.label, confidence: match.confidence },
        plan,
        alternativePlans: Object.keys(alternativePlans).length ? alternativePlans : void 0
      };
    }
    if (opts.gridFallback && !isOnGrid(value, ctx.options.baseGrid)) {
      const lower = Math.floor(value / ctx.options.baseGrid) * ctx.options.baseGrid;
      const upper = lower + ctx.options.baseGrid;
      const nearest = value - lower < upper - value ? lower : upper;
      return {
        ruleId,
        node,
        slot: fields.join("+"),
        severity: "warning",
        currentValue: px(value),
        suggestion: { kind: "value", id: String(nearest), label: px(nearest), confidence: "close" },
        fixSafety: "none",
        params: { fields: fields.join(", "), label: opts.label, confidence: "grid", grid: ctx.options.baseGrid }
      };
    }
    return null;
  }
  function isBound(node, field) {
    const bv = node.boundVariables;
    return Boolean(bv && bv[field]);
  }
  function groupByValue(node, fields) {
    var _a;
    const out = /* @__PURE__ */ new Map();
    const host = node;
    for (const f of fields) {
      const v = host[f];
      if (typeof v !== "number" || v <= 0 || isBound(node, f)) continue;
      const key = Math.round(v * 100) / 100;
      out.set(key, [...(_a = out.get(key)) != null ? _a : [], f]);
    }
    return out;
  }
  var spacingRules = [
    {
      id: "spacing/off-scale-padding",
      types: LAYOUT_TYPES,
      check: (node, ctx) => {
        if (!hasAutoLayout(node)) return;
        const groups = groupByValue(node, ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]);
        const out = [];
        for (const [value, fields] of groups) {
          const issue = evaluateNumber("spacing/off-scale-padding", node, fields, value, ctx.spacingScale, ctx, {
            tolerance: ctx.options.spacingTolerance,
            gridFallback: true,
            label: "padding"
          });
          if (issue) out.push(issue);
        }
        return out;
      }
    },
    {
      id: "spacing/off-scale-gap",
      types: LAYOUT_TYPES,
      check: (node, ctx) => {
        if (!hasAutoLayout(node)) return;
        const frame = node;
        const fields = [];
        if (frame.layoutMode !== "GRID" && frame.primaryAxisAlignItems !== "SPACE_BETWEEN") fields.push("itemSpacing");
        if (frame.layoutWrap === "WRAP") fields.push("counterAxisSpacing");
        if (!fields.length) return;
        const groups = groupByValue(node, fields);
        const out = [];
        for (const [value, fs] of groups) {
          const issue = evaluateNumber("spacing/off-scale-gap", node, fs, value, ctx.spacingScale, ctx, {
            tolerance: ctx.options.spacingTolerance,
            gridFallback: true,
            label: "gap"
          });
          if (issue) out.push(issue);
        }
        return out;
      }
    }
  ];
  var radiusRules = [
    {
      id: "radius/not-tokenized",
      types: RADIUS_TYPES,
      check: (node, ctx) => {
        var _a;
        if (!ctx.radiusScale.length) return;
        if (!("cornerRadius" in node)) return;
        const bv = (_a = node.boundVariables) != null ? _a : {};
        if (bv.cornerRadius) return;
        const groups = groupByValue(node, ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"]);
        const out = [];
        for (const [value, fields] of groups) {
          const issue = evaluateNumber("radius/not-tokenized", node, fields, value, ctx.radiusScale, ctx, {
            tolerance: 1,
            gridFallback: false,
            label: "radius"
          });
          if (issue) out.push(issue);
        }
        return out;
      }
    }
  ];

  // src/plugin/rules/tokens.ts
  var isAlias = (v) => typeof v === "object" && v !== null && "type" in v && v.type === "VARIABLE_ALIAS";
  function virtualOf(v, ctx) {
    var _a;
    const col = ctx.collectionsById.get(v.variableCollectionId);
    return { id: v.id, name: v.name, type: "VARIABLE", path: [(_a = col == null ? void 0 : col.name) != null ? _a : "Variables"] };
  }
  function collectBound(value, out, depth = 0) {
    if (!value || typeof value !== "object" || depth > 3) return;
    if (Array.isArray(value)) {
      for (const v of value) collectBound(v, out, depth + 1);
      return;
    }
    const obj = value;
    if (obj.type === "VARIABLE_ALIAS" && typeof obj.id === "string") {
      out.add(obj.id);
      return;
    }
    for (const v of Object.values(obj)) collectBound(v, out, depth + 1);
  }
  var PAINT_TYPES2 = ["FRAME", "COMPONENT", "INSTANCE", "RECTANGLE", "ELLIPSE", "POLYGON", "STAR", "VECTOR", "TEXT", "LINE", "BOOLEAN_OPERATION", "SECTION", "GROUP", "COMPONENT_SET"];
  var valueKey = (v) => {
    if (isAlias(v)) return `alias:${v.id}`;
    if (typeof v === "object" && v !== null && "r" in v) {
      const c = v;
      return colorKey({ r: c.r, g: c.g, b: c.b }, "a" in c ? c.a : 1);
    }
    return `${typeof v}:${String(v)}`;
  };
  var tokenRules = [
    {
      // Collecte des usages (toutes les règles tokens aggregate en profitent) + orphelins en périmètre fichier.
      id: "tokens/orphan",
      types: PAINT_TYPES2,
      insideInstances: true,
      check: (node, ctx) => {
        collectBound(node.boundVariables, ctx.usedVariableIds);
        if (node.type === "TEXT") {
          try {
            const ranges = node.getStyledTextSegments(["boundVariables"]);
            for (const r of ranges) collectBound(r.boundVariables, ctx.usedVariableIds);
          } catch {
          }
        }
      },
      finalize: (ctx) => {
        if (ctx.scope !== "file") return;
        const aliased = /* @__PURE__ */ new Set();
        for (const v of ctx.localVariables) for (const val of Object.values(v.valuesByMode)) if (isAlias(val)) aliased.add(val.id);
        const out = [];
        for (const v of ctx.localVariables) {
          if (ctx.usedVariableIds.has(v.id) || aliased.has(v.id)) continue;
          out.push({ ruleId: "tokens/orphan", virtual: virtualOf(v, ctx), currentValue: v.name, fixSafety: "none", params: { name: v.name } });
        }
        return out;
      }
    },
    {
      id: "tokens/broken-alias",
      finalize: async (ctx) => {
        var _a, _b;
        const out = [];
        for (const v of ctx.localVariables) {
          for (const [modeId, val] of Object.entries(v.valuesByMode)) {
            if (!isAlias(val)) continue;
            const target = await figma.variables.getVariableByIdAsync(val.id);
            if (target) continue;
            const col = ctx.collectionsById.get(v.variableCollectionId);
            const mode = (_b = (_a = col == null ? void 0 : col.modes.find((m) => m.modeId === modeId)) == null ? void 0 : _a.name) != null ? _b : modeId;
            out.push({ ruleId: "tokens/broken-alias", virtual: virtualOf(v, ctx), slot: modeId, currentValue: v.name, fixSafety: "none", params: { name: v.name, mode } });
          }
        }
        return out;
      }
    },
    {
      id: "tokens/circular-alias",
      finalize: (ctx) => {
        var _a;
        const byId = new Map(ctx.localVariables.map((v) => [v.id, v]));
        const out = [];
        const reported = /* @__PURE__ */ new Set();
        for (const v of ctx.localVariables) {
          for (const [modeId, val] of Object.entries(v.valuesByMode)) {
            if (!isAlias(val)) continue;
            const seen = /* @__PURE__ */ new Set([v.id]);
            let cur = byId.get(val.id);
            const chain = [v.name];
            while (cur) {
              chain.push(cur.name);
              if (seen.has(cur.id)) {
                if (!reported.has(v.id)) {
                  reported.add(v.id);
                  out.push({ ruleId: "tokens/circular-alias", virtual: virtualOf(v, ctx), currentValue: chain.join(" \u2192 "), fixSafety: "none", params: { name: v.name, chain: chain.join(" \u2192 ") } });
                }
                break;
              }
              seen.add(cur.id);
              const next = (_a = cur.valuesByMode[modeId]) != null ? _a : Object.values(cur.valuesByMode)[0];
              cur = isAlias(next) ? byId.get(next.id) : void 0;
            }
          }
        }
        return out;
      }
    },
    {
      id: "tokens/duplicate-value",
      finalize: (ctx) => {
        var _a;
        const groups = /* @__PURE__ */ new Map();
        for (const v of ctx.localVariables) {
          if (v.resolvedType !== "COLOR" && v.resolvedType !== "FLOAT") continue;
          const values = Object.entries(v.valuesByMode).sort((a, b) => a[0].localeCompare(b[0])).map(([m, val]) => `${m}=${valueKey(val)}`);
          if (values.some((x) => x.includes("alias:"))) continue;
          const key = `${v.variableCollectionId}|${v.resolvedType}|${[...v.scopes].sort().join(",")}|${values.join(";")}`;
          groups.set(key, [...(_a = groups.get(key)) != null ? _a : [], v]);
        }
        const out = [];
        for (const list of groups.values()) {
          if (list.length < 2) continue;
          for (const v of list) {
            const first = Object.values(v.valuesByMode)[0];
            const swatch = v.resolvedType === "COLOR" && typeof first === "object" && first && "r" in first ? rgbToHex(first) : void 0;
            out.push({
              ruleId: "tokens/duplicate-value",
              virtual: virtualOf(v, ctx),
              currentValue: v.name,
              swatch,
              fixSafety: "none",
              params: { name: v.name, others: list.filter((o) => o !== v).map((o) => o.name).slice(0, 3).join(", "), count: list.length }
            });
          }
        }
        return out;
      }
    },
    {
      id: "tokens/primitive-bound",
      types: PAINT_TYPES2,
      check: async (node, ctx) => {
        var _a, _b, _c;
        const out = [];
        const hasSemantic = ctx.colors.some((t) => looksSemanticToken(t.name));
        if (!hasSemantic) return;
        for (const prop of ["fills", "strokes"]) {
          if (!(prop in node)) continue;
          const paints = node[prop];
          if (paints === figma.mixed) continue;
          for (let i = 0; i < paints.length; i++) {
            const p = paints[i];
            if (p.type !== "SOLID" || p.visible === false) continue;
            const id = (_b = (_a = p.boundVariables) == null ? void 0 : _a.color) == null ? void 0 : _b.id;
            if (!id) continue;
            const token = ctx.colorById.get(id);
            if (!token || !looksPrimitiveToken(token.name, token.collection)) continue;
            const { rgb, alpha } = await resolveSolidPaint(p, node);
            const semantic = ((_c = ctx.colorByKey.get(colorKey(rgb, alpha))) != null ? _c : []).filter((t) => looksSemanticToken(t.name) && t.id !== id);
            const best = semantic[0];
            out.push({
              ruleId: "tokens/primitive-bound",
              node,
              slot: `${prop}[${i}]`,
              currentValue: token.name,
              swatch: rgbToHex(rgb),
              suggestion: best ? {
                kind: "variable",
                id: best.id,
                label: tokenLabel(best),
                swatch: rgbToHex(best.rgb),
                confidence: "exact",
                alternatives: semantic.slice(1, 4).map((t) => ({ id: `var:${t.id}`, label: tokenLabel(t), swatch: rgbToHex(t.rgb) }))
              } : void 0,
              fixSafety: best ? "review" : "none",
              params: { token: token.name, prop, semantic: best ? tokenLabel(best) : "", confidence: best ? "exact" : "none" },
              plan: best ? { kind: "bind-paint-variable", nodeId: node.id, prop, index: i, variableId: best.id } : void 0,
              alternativePlans: Object.fromEntries(semantic.slice(1, 4).map((t) => [`var:${t.id}`, { kind: "bind-paint-variable", nodeId: node.id, prop, index: i, variableId: t.id }]))
            });
          }
        }
        return out;
      }
    },
    {
      id: "tokens/mode-gap",
      finalize: (ctx) => {
        const out = [];
        for (const col of ctx.collectionsById.values()) {
          if (col.modes.length < 2) continue;
          const vars = ctx.localVariables.filter((v) => v.variableCollectionId === col.id && v.resolvedType === "COLOR");
          if (vars.length < 4) continue;
          const differs = (v) => new Set(col.modes.map((m) => valueKey(v.valuesByMode[m.modeId]))).size > 1;
          const differing = vars.filter(differs).length;
          if (differing < vars.length / 2) continue;
          for (const v of vars) {
            if (differs(v)) continue;
            out.push({
              ruleId: "tokens/mode-gap",
              virtual: virtualOf(v, ctx),
              currentValue: v.name,
              fixSafety: "none",
              params: { name: v.name, modes: col.modes.map((m) => m.name).join(" / "), collection: col.name }
            });
          }
        }
        return out;
      }
    },
    {
      id: "tokens/unscoped",
      finalize: (ctx) => {
        const colors = ctx.localVariables.filter((v) => v.resolvedType === "COLOR");
        if (colors.length < 4) return;
        const scoped = colors.filter((v) => !v.scopes.includes("ALL_SCOPES")).length;
        if (scoped < colors.length / 2) return;
        const out = [];
        for (const v of colors) {
          if (!v.scopes.includes("ALL_SCOPES")) continue;
          out.push({ ruleId: "tokens/unscoped", virtual: virtualOf(v, ctx), currentValue: v.name, fixSafety: "none", params: { name: v.name } });
        }
        return out;
      }
    }
  ];

  // src/plugin/rules/typography.ts
  var sameLineHeight = (a, b) => a.unit === "AUTO" ? b.unit === "AUTO" : b.unit !== "AUTO" && a.unit === b.unit && Math.abs(a.value - b.value) < 0.01;
  var sameLetterSpacing = (a, b) => a.unit === b.unit && Math.abs(a.value - b.value) < 0.01;
  function hasTypographyVariables(node) {
    var _a, _b, _c, _d, _e;
    const bv = node.boundVariables;
    if (!bv) return false;
    return Boolean(((_a = bv.fontSize) == null ? void 0 : _a.length) || ((_b = bv.fontFamily) == null ? void 0 : _b.length) || ((_c = bv.fontStyle) == null ? void 0 : _c.length) || ((_d = bv.fontWeight) == null ? void 0 : _d.length) || ((_e = bv.lineHeight) == null ? void 0 : _e.length));
  }
  function styleSummary(s) {
    return fontLabel(s.fontName, s.fontSize, s.lineHeight);
  }
  function matchTextStyle(node, ctx) {
    const font = node.fontName;
    const size = node.fontSize;
    const lh = node.lineHeight;
    const ls = node.letterSpacing;
    const exact = [];
    const close = [];
    for (const s of ctx.textStyles) {
      if (s.fontName.family !== font.family) continue;
      if (Math.abs(s.fontSize - size) >= 0.01) continue;
      if (s.fontName.style === font.style && sameLineHeight(s.lineHeight, lh) && sameLetterSpacing(s.letterSpacing, ls)) exact.push(s);
      else close.push(s);
    }
    const prefLocal = (a, b) => Number(a.remote) - Number(b.remote);
    exact.sort(prefLocal);
    close.sort((a, b) => Number(a.fontName.style !== font.style) - Number(b.fontName.style !== font.style) || prefLocal(a, b));
    if (exact.length) return { confidence: "exact", best: exact[0], alts: [...exact.slice(1, 3), ...close.slice(0, 2)] };
    if (close.length) return { confidence: "close", best: close[0], alts: close.slice(1, 3) };
    return { confidence: "none", alts: [] };
  }
  var typographyRules = [
    {
      id: "typography/no-text-style",
      types: ["TEXT"],
      check: (node, ctx) => {
        const text = node;
        if (!text.characters.trim()) return;
        if (text.textStyleId === figma.mixed) return;
        if (text.textStyleId) return;
        if (hasTypographyVariables(text)) return;
        if (text.fontName === figma.mixed || text.fontSize === figma.mixed) return;
        const match = matchTextStyle(text, ctx);
        const current = fontLabel(text.fontName, text.fontSize, text.lineHeight);
        const hasStyles = ctx.textStyles.length > 0;
        let suggestion;
        if (match.best) {
          suggestion = {
            kind: "style",
            id: match.best.id,
            label: match.best.name,
            value: styleSummary(match.best),
            confidence: match.confidence,
            source: match.best.remote ? "Library" : "Local",
            alternatives: match.alts.length ? match.alts.map((s) => ({ id: `style:${s.id}`, label: s.name, value: styleSummary(s) })) : void 0
          };
        }
        const issue = {
          ruleId: "typography/no-text-style",
          node,
          severity: match.confidence === "exact" ? "error" : hasStyles ? "warning" : "info",
          currentValue: current,
          suggestion,
          fixSafety: match.confidence === "exact" ? "safe" : match.confidence === "close" ? "review" : "none",
          params: { confidence: match.confidence, hasStyles: hasStyles ? 1 : 0 },
          plan: match.best ? { kind: "apply-text-style", nodeId: node.id, styleId: match.best.id } : void 0,
          alternativePlans: match.alts.length ? Object.fromEntries(match.alts.map((s) => [`style:${s.id}`, { kind: "apply-text-style", nodeId: node.id, styleId: s.id }])) : void 0
        };
        return [issue];
      }
    },
    {
      id: "typography/mixed-styles",
      types: ["TEXT"],
      check: (node) => {
        const text = node;
        if (!text.characters.trim()) return;
        const mixedStyle = text.textStyleId === figma.mixed;
        const mixedFont = text.fontName === figma.mixed || text.fontSize === figma.mixed;
        if (!mixedStyle && !mixedFont) return;
        const segments2 = text.getStyledTextSegments(["fontName", "fontSize", "textStyleId"]).length;
        return [
          {
            ruleId: "typography/mixed-styles",
            node,
            currentValue: `${segments2} styles`,
            fixSafety: "none",
            params: { segments: segments2, mixedStyle: mixedStyle ? 1 : 0 }
          }
        ];
      }
    },
    {
      id: "typography/off-scale-size",
      types: ["TEXT"],
      check: (node, ctx) => {
        const text = node;
        if (!text.characters.trim()) return;
        if (text.textStyleId || text.fontSize === figma.mixed) return;
        if (ctx.fontSizeScale.length < 3) return;
        if (hasTypographyVariables(text)) return;
        const size = text.fontSize;
        if (ctx.fontSizeScale.some((v) => Math.abs(v - size) < 0.01)) return;
        const nearest = ctx.fontSizeScale.reduce((best, v) => Math.abs(v - size) < Math.abs(best - size) ? v : best, ctx.fontSizeScale[0]);
        return [
          {
            ruleId: "typography/off-scale-size",
            node,
            currentValue: `${Math.round(size * 100) / 100} px`,
            suggestion: { kind: "value", id: String(nearest), label: `${nearest} px`, confidence: "close" },
            fixSafety: "none",
            params: { size: Math.round(size * 100) / 100, nearest, scale: ctx.fontSizeScale.join(", ") }
          }
        ];
      }
    }
  ];

  // src/plugin/rules/typography-pro.ts
  var LABEL_KINDS = /* @__PURE__ */ new Set(["button", "icon-button", "tab", "chip", "link"]);
  var MAX_CHARS_PER_LINE = 90;
  function lineHeightPx(lh, size) {
    if (lh.unit === "PIXELS") return Math.round(lh.value * 10) / 10;
    if (lh.unit === "PERCENT") return Math.round(lh.value / 100 * size * 10) / 10;
    return null;
  }
  function toCase(text, target) {
    switch (target) {
      case "upper":
        return text.toUpperCase();
      case "lower":
        return text.toLowerCase();
      case "sentence": {
        const lower = text.toLowerCase();
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      }
      case "title":
        return text.toLowerCase().split(/(\s+)/).map((w) => /^\s+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join("");
      default:
        return text;
    }
  }
  function isLabelContext(node, ctx) {
    const chain = ancestors(node, ctx).slice(0, 3);
    return chain.some((a) => LABEL_KINDS.has(inferComponentKind(a.name)));
  }
  var typographyProRules = [
    {
      id: "typography/line-length",
      types: ["TEXT"],
      check: (node) => {
        const text = node;
        if (text.characters.length < 120 || text.textAutoResize === "WIDTH_AND_HEIGHT") return;
        if (text.fontSize === figma.mixed) return;
        const size = text.fontSize;
        if (size <= 0) return;
        const perLine = text.width / (size * 0.5);
        if (perLine <= MAX_CHARS_PER_LINE) return;
        const chars = Math.round(perLine);
        return [
          {
            ruleId: "typography/line-length",
            node,
            currentValue: `\u2248 ${chars}`,
            suggestion: { kind: "value", id: "70", label: `\u2264 80`, confidence: "none" },
            fixSafety: "none",
            params: { chars, width: Math.round(text.width), max: 80, size }
          }
        ];
      }
    },
    {
      id: "typography/line-height-inconsistent",
      types: ["TEXT"],
      check: (node, ctx) => {
        const text = node;
        if (text.textStyleId || text.fontSize === figma.mixed || text.fontName === figma.mixed || text.lineHeight === figma.mixed) return;
        const size = text.fontSize;
        const lh = lineHeightPx(text.lineHeight, size);
        if (lh === null) return;
        ctx.textMetrics.push({ node: text, family: text.fontName.family, size, lineHeightPx: lh });
      },
      finalize: (ctx) => {
        var _a, _b, _c;
        const groups = /* @__PURE__ */ new Map();
        for (const m of ctx.textMetrics) {
          const key = `${m.family}|${m.size}`;
          groups.set(key, [...(_a = groups.get(key)) != null ? _a : [], m]);
        }
        const out = [];
        for (const list of groups.values()) {
          if (list.length < 3) continue;
          const counts = /* @__PURE__ */ new Map();
          for (const m of list) counts.set(m.lineHeightPx, ((_b = counts.get(m.lineHeightPx)) != null ? _b : 0) + 1);
          if (counts.size < 2) continue;
          const mode = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
          for (const m of list) {
            if (m.lineHeightPx === mode) continue;
            out.push({
              ruleId: "typography/line-height-inconsistent",
              node: m.node,
              currentValue: `${m.size} / ${m.lineHeightPx}`,
              suggestion: { kind: "value", id: String(mode), label: `${m.size} / ${mode}`, value: `${mode} px`, confidence: "close" },
              fixSafety: "review",
              params: { size: m.size, lineHeight: m.lineHeightPx, mode, family: m.family, count: (_c = counts.get(mode)) != null ? _c : 0 },
              plan: { kind: "set-line-height", nodeId: m.node.id, px: mode }
            });
          }
        }
        return out;
      }
    },
    {
      id: "typography/label-case",
      types: ["TEXT"],
      insideInstances: true,
      check: (node, ctx) => {
        const text = node;
        const chars = text.characters.trim();
        if (!chars || chars.length > 40 || /\n/.test(chars)) return;
        if (!isLabelContext(text, ctx)) return;
        ctx.buttonLabels.push({ node: text, text: chars });
      },
      finalize: (ctx) => {
        var _a;
        const labels = ctx.buttonLabels.map((l) => ({ ...l, kase: labelCase(l.text) })).filter((l) => l.kase !== "other");
        if (labels.length < 4) return;
        const counts = /* @__PURE__ */ new Map();
        for (const l of labels) counts.set(l.kase, ((_a = counts.get(l.kase)) != null ? _a : 0) + 1);
        const [majority, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
        if (n / labels.length < 0.6 || counts.size < 2) return;
        const out = [];
        for (const l of labels) {
          if (l.kase === majority) continue;
          const suggested = toCase(l.text, majority);
          out.push({
            ruleId: "typography/label-case",
            node: l.node,
            currentValue: l.text,
            suggestion: { kind: "value", id: majority, label: suggested, confidence: "close" },
            fixSafety: "none",
            params: { text: l.text, suggested, share: Math.round(n / labels.length * 100) }
          });
        }
        return out;
      }
    },
    {
      id: "typography/near-duplicate-styles",
      finalize: (ctx) => {
        const local = ctx.textStyles.filter((s) => !s.remote);
        const out = [];
        const reported = /* @__PURE__ */ new Set();
        for (let i = 0; i < local.length; i++) {
          for (let j = i + 1; j < local.length; j++) {
            const a = local[i];
            const b = local[j];
            if (a.fontName.family !== b.fontName.family || a.fontName.style !== b.fontName.style) continue;
            if (Math.abs(a.fontSize - b.fontSize) > 1) continue;
            const la = lineHeightPx(a.lineHeight, a.fontSize);
            const lb = lineHeightPx(b.lineHeight, b.fontSize);
            if (!(la === null && lb === null) && (la === null || lb === null || Math.abs(la - lb) > 2)) continue;
            const key = `${a.id}|${b.id}`;
            if (reported.has(key)) continue;
            reported.add(key);
            out.push({
              ruleId: "typography/near-duplicate-styles",
              virtual: { id: a.id, name: a.name, type: "TEXT_STYLE", path: ["Text styles"] },
              slot: b.id,
              currentValue: `${a.name} \u2248 ${b.name}`,
              fixSafety: "none",
              params: { a: a.name, b: b.name, font: `${a.fontName.family} ${a.fontName.style}`, sizeA: a.fontSize, sizeB: b.fontSize }
            });
          }
        }
        return out;
      }
    }
  ];

  // src/plugin/rules/index.ts
  var ALL_RULES = [
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
    ...handoffProRules
  ];

  // src/plugin/reveal.ts
  var UI_CHROME_H = 40;
  var MARGIN = 24;
  var MIN_REGION = 96;
  var PANEL_INSET = 240;
  var PANEL_INSET_MIN_WIDTH = 1100;
  function union(rects) {
    let x1 = Infinity;
    let y1 = Infinity;
    let x2 = -Infinity;
    let y2 = -Infinity;
    for (const r of rects) {
      x1 = Math.min(x1, r.x);
      y1 = Math.min(y1, r.y);
      x2 = Math.max(x2, r.x + r.width);
      y2 = Math.max(y2, r.y + r.height);
    }
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  }
  function intersects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function clip(a, to) {
    const x = Math.max(a.x, to.x);
    const y = Math.max(a.y, to.y);
    return { x, y, w: Math.min(a.x + a.w, to.x + to.w) - x, h: Math.min(a.y + a.h, to.y + to.h) - y };
  }
  function revealNodes(nodes, uiSize2) {
    figma.viewport.scrollAndZoomIntoView(nodes);
    try {
      const rects = nodes.map((n) => n.absoluteBoundingBox).filter((r) => Boolean(r));
      if (!rects.length) return;
      const box = union(rects);
      const vb = figma.viewport.bounds;
      const zoom = figma.viewport.zoom;
      const vw = vb.width * zoom;
      const vh = vb.height * zoom;
      const pos = figma.ui.getPosition().canvasSpace;
      const plugin = clip(
        { x: (pos.x - vb.x) * zoom, y: (pos.y - vb.y) * zoom - UI_CHROME_H, w: uiSize2.width, h: uiSize2.height + UI_CHROME_H },
        { x: 0, y: 0, w: vw, h: vh }
      );
      if (plugin.w <= 0 || plugin.h <= 0) return;
      const target = { x: (box.x - vb.x) * zoom, y: (box.y - vb.y) * zoom, w: box.width * zoom, h: box.height * zoom };
      if (!intersects(target, plugin)) return;
      const inset = vw >= PANEL_INSET_MIN_WIDTH ? PANEL_INSET : 0;
      const regions = [
        { x: inset, y: 0, w: plugin.x - inset, h: vh },
        { x: plugin.x + plugin.w, y: 0, w: vw - inset - (plugin.x + plugin.w), h: vh },
        { x: inset, y: 0, w: vw - 2 * inset, h: plugin.y },
        { x: inset, y: plugin.y + plugin.h, w: vw - 2 * inset, h: vh - (plugin.y + plugin.h) }
      ].filter((r) => r.w >= MIN_REGION && r.h >= MIN_REGION);
      if (!regions.length) return;
      const fits = regions.filter((r) => r.w - 2 * MARGIN >= target.w && r.h - 2 * MARGIN >= target.h);
      const pick = (fits.length ? fits : regions).sort((a, b) => b.w * b.h - a.w * a.h)[0];
      let nextZoom = zoom;
      if (!fits.length) nextZoom = Math.max(0.02, Math.min(zoom, (pick.w - 2 * MARGIN) / box.width, (pick.h - 2 * MARGIN) / box.height));
      const regionCx = pick.x + pick.w / 2;
      const regionCy = pick.y + pick.h / 2;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      figma.viewport.zoom = nextZoom;
      figma.viewport.center = { x: cx + (vw / 2 - regionCx) / nextZoom, y: cy + (vh / 2 - regionCy) / nextZoom };
    } catch {
    }
  }

  // src/plugin/scan/context.ts
  var yieldToHost = () => typeof setTimeout === "function" ? new Promise((r) => setTimeout(r, 0)) : Promise.resolve();
  var isAlias2 = (v) => typeof v === "object" && v !== null && v.type === "VARIABLE_ALIAS";
  async function resolveVariableValue(variable, modeId, depth = 0) {
    if (depth > 12) return void 0;
    const modes = Object.keys(variable.valuesByMode);
    if (!modes.length) return void 0;
    const mode = modeId && modeId in variable.valuesByMode ? modeId : modes[0];
    const value = variable.valuesByMode[mode];
    if (isAlias2(value)) {
      const target = await figma.variables.getVariableByIdAsync(value.id);
      if (!target) return void 0;
      const targetCollection = await figma.variables.getVariableCollectionByIdAsync(target.variableCollectionId);
      const targetMode = modeId && target.valuesByMode[modeId] !== void 0 ? modeId : targetCollection == null ? void 0 : targetCollection.defaultModeId;
      return resolveVariableValue(target, targetMode, depth + 1);
    }
    return value;
  }
  var toRgb01 = (v) => ({
    rgb: { r: v.r, g: v.g, b: v.b },
    alpha: "a" in v ? v.a : 1
  });
  function pushColor(ctx, token) {
    var _a;
    ctx.colors.push(token);
    const key = colorKey(token.rgb, token.alpha);
    const list = (_a = ctx.colorByKey.get(key)) != null ? _a : [];
    list.push(token);
    ctx.colorByKey.set(key, list);
  }
  async function indexVariable(ctx, variable, source, collectionCache) {
    var _a, _b, _c, _d;
    let collection = collectionCache.get(variable.variableCollectionId);
    if (collection === void 0) {
      collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
      collectionCache.set(variable.variableCollectionId, collection);
    }
    const collectionName = (_a = collection == null ? void 0 : collection.name) != null ? _a : "";
    const modes = (_b = collection == null ? void 0 : collection.modes) != null ? _b : Object.keys(variable.valuesByMode).map((modeId) => ({ modeId, name: "" }));
    const defaultModeId = (_d = collection == null ? void 0 : collection.defaultModeId) != null ? _d : (_c = modes[0]) == null ? void 0 : _c.modeId;
    if (variable.resolvedType === "COLOR") {
      const seen = /* @__PURE__ */ new Set();
      for (const mode of modes) {
        const value = await resolveVariableValue(variable, mode.modeId);
        if (!value || typeof value !== "object" || !("r" in value)) continue;
        const { rgb, alpha } = toRgb01(value);
        const key = colorKey(rgb, alpha);
        if (seen.has(key)) continue;
        seen.add(key);
        pushColor(ctx, {
          id: variable.id,
          name: variable.name,
          collection: collectionName,
          source,
          remote: variable.remote,
          rgb,
          alpha,
          scopes: variable.scopes,
          modeName: modes.length > 1 ? mode.name : void 0,
          isDefaultMode: mode.modeId === defaultModeId
        });
      }
    } else if (variable.resolvedType === "FLOAT") {
      const value = await resolveVariableValue(variable, defaultModeId);
      if (typeof value !== "number" || !Number.isFinite(value)) return;
      ctx.floats.push({
        id: variable.id,
        name: variable.name,
        collection: collectionName,
        source,
        remote: variable.remote,
        value,
        scopes: variable.scopes
      });
    }
  }
  var hasScope = (scopes, ...wanted) => scopes.some((s) => wanted.includes(s));
  function buildFloatScales(ctx) {
    const spacingScoped = ctx.floats.filter((f) => hasScope(f.scopes, "GAP", "WIDTH_HEIGHT"));
    const radiusScoped = ctx.floats.filter((f) => hasScope(f.scopes, "CORNER_RADIUS"));
    const fontScoped = ctx.floats.filter((f) => hasScope(f.scopes, "FONT_SIZE"));
    const unscoped = ctx.floats.filter((f) => f.scopes.includes("ALL_SCOPES"));
    const spacingByName = unscoped.filter((f) => /spac|gap|pad|inset|\bsize\b|dimension|grid/i.test(f.name));
    const radiusByName = unscoped.filter((f) => /radius|corner|round/i.test(f.name));
    const fontByName = unscoped.filter((f) => /font.?size|text.?size|type.?scale|\bfs\b/i.test(f.name));
    const spacing = spacingScoped.length ? [...spacingScoped, ...spacingByName] : spacingByName;
    const radius = radiusScoped.length ? [...radiusScoped, ...radiusByName] : radiusByName;
    const font = fontScoped.length ? [...fontScoped, ...fontByName] : fontByName;
    const dedupe = (list) => {
      const seen = /* @__PURE__ */ new Set();
      return list.filter((f) => seen.has(f.id) ? false : (seen.add(f.id), true));
    };
    ctx.spacingScale = dedupe(spacing).filter((f) => f.value >= 0 && f.value <= 512).map((f) => ({ value: f.value, ref: f }));
    ctx.radiusScale = dedupe(radius).filter((f) => f.value >= 0 && f.value <= 512).map((f) => ({ value: f.value, ref: f }));
    const sizes = /* @__PURE__ */ new Set([...dedupe(font).map((f) => f.value), ...ctx.textStyles.map((s) => s.fontSize)]);
    ctx.fontSizeScale = [...sizes].filter((v) => v > 0).sort((a, b) => a - b);
  }
  async function indexPaintStyle(ctx, style) {
    var _a, _b;
    const visible = style.paints.filter((p) => p.visible !== false);
    if (visible.length !== 1 || visible[0].type !== "SOLID") return;
    const paint = visible[0];
    const info = {
      id: style.id,
      name: style.name,
      remote: style.remote,
      rgb: { r: paint.color.r, g: paint.color.g, b: paint.color.b },
      alpha: (_a = paint.opacity) != null ? _a : 1
    };
    ctx.paintStyles.push(info);
    const key = colorKey(info.rgb, info.alpha);
    ctx.paintStyleByKey.set(key, [...(_b = ctx.paintStyleByKey.get(key)) != null ? _b : [], info]);
  }
  function indexTextStyle(ctx, style) {
    if (ctx.textStyles.some((s) => s.id === style.id)) return;
    ctx.textStyles.push({
      id: style.id,
      name: style.name,
      remote: style.remote,
      fontName: style.fontName,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing
    });
  }
  function createContext(options, activeRules, reportProgress, isCancelled) {
    return {
      options,
      activeRules,
      colors: [],
      colorByKey: /* @__PURE__ */ new Map(),
      floats: [],
      spacingScale: [],
      radiusScale: [],
      fontSizeScale: [],
      textStyles: [],
      paintStyles: [],
      paintStyleByKey: /* @__PURE__ */ new Map(),
      libraries: [],
      warnings: [],
      pageOf: /* @__PURE__ */ new Map(),
      ancestorsCache: /* @__PURE__ */ new Map(),
      backgroundCache: /* @__PURE__ */ new Map(),
      componentSets: [],
      localComponents: [],
      anySetHasReactions: false,
      scope: "page",
      localVariables: [],
      collectionsById: /* @__PURE__ */ new Map(),
      colorById: /* @__PURE__ */ new Map(),
      usedVariableIds: /* @__PURE__ */ new Set(),
      headings: [],
      textMetrics: [],
      buttonLabels: [],
      autoLayoutFrames: [],
      destructiveNodes: [],
      confirmPatternSeen: false,
      docLinkSeen: false,
      componentsForDocs: [],
      found: {},
      reportProgress,
      isCancelled
    };
  }
  var MAX_LIBRARY_VARIABLES = 800;
  var IMPORT_BATCH = 40;
  async function indexTokens(ctx) {
    const collectionCache = /* @__PURE__ */ new Map();
    ctx.reportProgress({ phase: "indexing", detail: "local" });
    const [localVars, paintStyles, textStyles] = await Promise.all([
      figma.variables.getLocalVariablesAsync(),
      figma.getLocalPaintStylesAsync(),
      figma.getLocalTextStylesAsync()
    ]);
    ctx.localVariables = localVars;
    let i = 0;
    for (const v of localVars) {
      if (v.resolvedType !== "COLOR" && v.resolvedType !== "FLOAT") continue;
      await indexVariable(ctx, v, "Local", collectionCache);
      if (++i % 60 === 0) {
        await yieldToHost();
        if (ctx.isCancelled()) return;
      }
    }
    for (const s of paintStyles) await indexPaintStyle(ctx, s);
    for (const s of textStyles) indexTextStyle(ctx, s);
    if (ctx.options.includeLibraries) {
      try {
        const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
        if (collections.length) ctx.reportProgress({ phase: "indexing", detail: collections[0].libraryName });
        const listed = await Promise.all(
          collections.map(async (col) => {
            try {
              const vars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(col.key);
              return { col, vars: vars.filter((lv) => lv.resolvedType === "COLOR" || lv.resolvedType === "FLOAT") };
            } catch {
              ctx.warnings.push(`library:${col.libraryName}`);
              return { col, vars: [] };
            }
          })
        );
        if (ctx.isCancelled()) return;
        const queue = [];
        for (const { col, vars } of listed) {
          if (!vars.length) continue;
          if (!ctx.libraries.includes(col.libraryName)) ctx.libraries.push(col.libraryName);
          for (const lv of vars) queue.push({ key: lv.key, libraryName: col.libraryName });
        }
        if (queue.length > MAX_LIBRARY_VARIABLES) {
          ctx.warnings.push("library-cap");
          queue.length = MAX_LIBRARY_VARIABLES;
        }
        for (let i2 = 0; i2 < queue.length; i2 += IMPORT_BATCH) {
          const batch = queue.slice(i2, i2 + IMPORT_BATCH);
          ctx.reportProgress({ phase: "indexing", detail: batch[0].libraryName, scanned: i2, total: queue.length });
          const imported = await Promise.all(
            batch.map(async ({ key, libraryName }) => {
              try {
                return { variable: await figma.variables.importVariableByKeyAsync(key), libraryName };
              } catch {
                return null;
              }
            })
          );
          for (const entry of imported) if (entry) await indexVariable(ctx, entry.variable, entry.libraryName, collectionCache);
          await yieldToHost();
          if (ctx.isCancelled()) return;
        }
        if (queue.length) ctx.reportProgress({ phase: "indexing", detail: queue[queue.length - 1].libraryName, scanned: queue.length, total: queue.length });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        ctx.warnings.push(/permission|manifest/i.test(message) ? "libraries-no-permission" : "libraries-unavailable");
      }
    }
    for (const [id, col] of collectionCache) if (col) ctx.collectionsById.set(id, col);
    for (const t of ctx.colors) if (!ctx.colorById.has(t.id) || t.isDefaultMode) ctx.colorById.set(t.id, t);
    buildFloatScales(ctx);
  }
  function rebuildScales(ctx) {
    buildFloatScales(ctx);
  }

  // src/plugin/scan/engine.ts
  var BATCH_SIZE = 120;
  var MAX_LEARNED_STYLES = 300;
  var INTERACTIVE_KINDS3 = /* @__PURE__ */ new Set(["button", "icon-button", "link", "input", "select", "checkbox", "radio", "toggle", "chip", "tab", "search"]);
  function scopeLabel(scope, roots) {
    if (scope === "file") return figma.root.name;
    if (scope === "page") return figma.currentPage.name;
    const names = roots.slice(0, 3).map((r) => r.name);
    return roots.length > 3 ? `${names.join(", ")} +${roots.length - 3}` : names.join(", ");
  }
  async function resolveRoots(scope) {
    if (scope === "file") {
      await figma.loadAllPagesAsync();
      return { roots: [...figma.root.children], pages: figma.root.children.length };
    }
    if (scope === "selection" && figma.currentPage.selection.length) {
      return { roots: [...figma.currentPage.selection], pages: 1 };
    }
    return { roots: [figma.currentPage], pages: 1 };
  }
  function collectTypes(rules) {
    var _a;
    const set = /* @__PURE__ */ new Set();
    for (const r of rules) for (const t of (_a = r.types) != null ? _a : []) set.add(t);
    return [...set];
  }
  async function collectNodes(roots, types, ctx) {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    const typeSet = new Set(types);
    for (const root of roots) {
      if (ctx.isCancelled()) break;
      if (root.type !== "PAGE" && typeSet.has(root.type) && !seen.has(root.id)) {
        seen.add(root.id);
        out.push(root);
      }
      if ("findAllWithCriteria" in root) {
        const found = root.findAllWithCriteria({ types });
        for (const n of found) {
          if (seen.has(n.id)) continue;
          seen.add(n.id);
          out.push(n);
        }
      }
      ctx.reportProgress({ phase: "collecting", scanned: 0, total: out.length });
      await yieldToHost();
    }
    return out;
  }
  async function learnRemoteStyles(nodes, ctx) {
    const textIds = /* @__PURE__ */ new Set();
    const paintIds = /* @__PURE__ */ new Set();
    for (const n of nodes) {
      if (n.type === "TEXT" && typeof n.textStyleId === "string" && n.textStyleId) textIds.add(n.textStyleId);
      if ("fillStyleId" in n && typeof n.fillStyleId === "string" && n.fillStyleId) paintIds.add(n.fillStyleId);
      if (textIds.size + paintIds.size >= MAX_LEARNED_STYLES) break;
    }
    const knownText = new Set(ctx.textStyles.map((s) => s.id));
    const knownPaint = new Set(ctx.paintStyles.map((s) => s.id));
    const pending = [...[...textIds].filter((id) => !knownText.has(id)), ...[...paintIds].filter((id) => !knownPaint.has(id))];
    for (let i = 0; i < pending.length; i += 40) {
      const styles = await Promise.all(pending.slice(i, i + 40).map((id) => figma.getStyleByIdAsync(id).catch(() => null)));
      for (const s of styles) {
        if (!s) continue;
        if (s.type === "TEXT") indexTextStyle(ctx, s);
        else if (s.type === "PAINT") await indexPaintStyle(ctx, s);
      }
      await yieldToHost();
    }
    rebuildScales(ctx);
  }
  function toIssue(raw, ctx, ignored) {
    var _a, _b, _c, _d, _e, _f;
    const meta = RULE_BY_ID[raw.ruleId];
    const target = raw.virtual ? { id: raw.virtual.id, name: raw.virtual.name, type: raw.virtual.type, path: raw.virtual.path, pageId: "" } : { id: raw.node.id, name: raw.node.name, type: raw.node.type, path: pathOf(raw.node, ctx), pageId: (_b = (_a = pageOf2(raw.node)) == null ? void 0 : _a.id) != null ? _b : "" };
    const id = `${raw.ruleId}::${target.id}::${(_c = raw.slot) != null ? _c : ""}`;
    const severity = (_d = raw.severity) != null ? _d : meta.severity;
    return {
      id,
      ruleId: raw.ruleId,
      category: meta.category,
      severity,
      nodeId: target.id,
      nodeName: target.name,
      nodeType: target.type,
      nodePath: target.path,
      pageId: target.pageId,
      currentValue: raw.currentValue,
      swatch: raw.swatch,
      suggestion: raw.suggestion,
      fixSafety: raw.fixSafety,
      params: raw.params,
      status: ignored.has(id) ? "ignored" : "open",
      groupKey: `${raw.ruleId}|${raw.currentValue}|${(_f = (_e = raw.suggestion) == null ? void 0 : _e.id) != null ? _f : ""}`
    };
  }
  async function runScan(req, report, isCancelled) {
    var _a;
    const started = Date.now();
    const progress = { phase: "indexing", scanned: 0, total: 0, found: {} };
    const emit = (p) => {
      Object.assign(progress, p);
      progress.found = ctx.found;
      report({ ...progress, found: { ...ctx.found } });
    };
    const ctx = createContext(req.options, req.activeRules, emit, isCancelled);
    ctx.scope = req.scope;
    const plans2 = /* @__PURE__ */ new Map();
    const issues2 = [];
    const seenIds = /* @__PURE__ */ new Set();
    const push = (raw) => {
      var _a2;
      if (!req.activeRules.has(raw.ruleId)) return;
      const issue = toIssue(raw, ctx, req.ignoredIssueIds);
      if (seenIds.has(issue.id)) return;
      seenIds.add(issue.id);
      issues2.push(issue);
      if (issue.status === "open") ctx.found[issue.category] = ((_a2 = ctx.found[issue.category]) != null ? _a2 : 0) + 1;
      if (raw.plan || raw.alternativePlans) plans2.set(issue.id, { plan: raw.plan, alternativePlans: raw.alternativePlans });
    };
    const allRules = req.rules;
    const rules = allRules.filter((r) => req.activeRules.has(r.id));
    const needsCraftCollector = [
      "craft/missing-loading-state",
      "craft/missing-empty-state",
      "craft/missing-hover-transition",
      "craft/state-naming",
      "craft/inconsistent-motion",
      "craft/missing-success-state",
      "craft/duplicate-state",
      "craft/state-matrix-thin",
      "craft/inconsistent-easing",
      "components/orphan-variant"
    ];
    if (needsCraftCollector.some((id) => req.activeRules.has(id)) && !rules.some((r) => r.id === "craft/missing-state")) {
      const collector = allRules.find((r) => r.id === "craft/missing-state");
      if (collector) rules.push(collector);
    }
    if (req.activeRules.has("a11y/contrast-not-verifiable") && !rules.some((r) => r.id === "a11y/text-contrast")) {
      const contrast = allRules.find((r) => r.id === "a11y/text-contrast");
      if (contrast) rules.push(contrast);
    }
    const checkRules = rules.filter((r) => r.check);
    const finalizeRules = rules.filter((r) => r.finalize);
    const finish = (cancelled, scope, label2, pages2, scanned2) => ({
      cancelled,
      plans: plans2,
      result: {
        issues: issues2,
        stats: {
          nodesScanned: scanned2,
          durationMs: Date.now() - started,
          scope,
          scopeLabel: label2,
          pagesScanned: pages2,
          interactiveComponents: ctx.componentSets.filter((s) => s.stateProp || INTERACTIVE_KINDS3.has(s.kind)).length,
          tokens: {
            colorVariables: ctx.colors.length,
            floatVariables: ctx.floats.length,
            textStyles: ctx.textStyles.length,
            paintStyles: ctx.paintStyles.length,
            libraries: ctx.libraries.length
          },
          warnings: ctx.warnings
        }
      }
    });
    const { roots, pages } = await resolveRoots(req.scope);
    const label = scopeLabel(req.scope, roots);
    emit({ phase: "indexing" });
    await indexTokens(ctx);
    if (isCancelled()) return finish(true, req.scope, label, pages, 0);
    emit({ phase: "collecting" });
    const types = collectTypes(checkRules);
    const nodes = await collectNodes(roots, types, ctx);
    if (isCancelled()) return finish(true, req.scope, label, pages, 0);
    await learnRemoteStyles(nodes, ctx);
    emit({ phase: "scanning", scanned: 0, total: nodes.length });
    const byType = /* @__PURE__ */ new Map();
    for (const t of types) byType.set(t, checkRules.filter((r) => !r.types || r.types.includes(t)));
    let scanned = 0;
    for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
      const batch = nodes.slice(i, i + BATCH_SIZE);
      for (const node of batch) {
        scanned++;
        if (node.removed) continue;
        if (req.options.ignoreHidden && isEffectivelyHidden(node, ctx)) continue;
        if (req.options.ignoreLocked && isEffectivelyLocked(node, ctx)) continue;
        const inside = !req.options.scanInsideInstances && isInsideInstance(node, ctx);
        const applicable = (_a = byType.get(node.type)) != null ? _a : [];
        for (const rule of applicable) {
          if (inside && !rule.insideInstances) continue;
          try {
            const raws = await rule.check(node, ctx);
            if (raws) for (const raw of raws) push(raw);
          } catch (e) {
            ctx.warnings.push(`rule:${rule.id}`);
          }
        }
      }
      emit({ phase: "scanning", scanned, total: nodes.length });
      await yieldToHost();
      if (isCancelled()) return finish(true, req.scope, label, pages, scanned);
    }
    emit({ phase: "finalizing", scanned, total: nodes.length });
    for (const rule of finalizeRules) {
      try {
        const raws = await rule.finalize(ctx);
        if (raws) for (const raw of raws) push(raw);
      } catch {
        ctx.warnings.push(`rule:${rule.id}`);
      }
    }
    ctx.warnings.splice(0, ctx.warnings.length, ...new Set(ctx.warnings));
    const sevOrder = { error: 0, warning: 1, info: 2 };
    const catOrder = { colors: 0, typography: 1, spacing: 2, radius: 3, components: 4, tokens: 5, craft: 6, a11y: 7, handoff: 8 };
    issues2.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || catOrder[a.category] - catOrder[b.category] || a.groupKey.localeCompare(b.groupKey));
    return finish(false, req.scope, label, pages, scanned);
  }

  // src/plugin/main.ts
  var SETTINGS_KEY = "scd:settings:v1";
  var IGNORED_KEY = "scd:ignored";
  var MIN_W = 560;
  var MIN_H = 400;
  var MAX_W = 1200;
  var MAX_H = 1400;
  var MIN_TOTAL_W = 200;
  var MIN_TOTAL_H = 40;
  var MAX_TOTAL_W = 2200;
  var settings = { ...DEFAULT_SETTINGS };
  var uiSize = { ...DEFAULT_SETTINGS.window };
  var scanning = false;
  var cancelRequested = false;
  var issues = /* @__PURE__ */ new Map();
  var plans = /* @__PURE__ */ new Map();
  var journals = /* @__PURE__ */ new Map();
  var batchCounter = 0;
  var previewRunning = false;
  var previewPending = null;
  var programmaticSelectionKey = "";
  var post = (msg) => figma.ui.postMessage(msg);
  var clamp = (v, min, max) => Math.round(Math.min(max, Math.max(min, v)));
  function clampWindow(w, h) {
    return { width: clamp(w, MIN_W, MAX_W), height: clamp(h, MIN_H, MAX_H) };
  }
  async function loadSettings() {
    var _a, _b, _c, _d, _e;
    try {
      const stored = await figma.clientStorage.getAsync(SETTINGS_KEY);
      if (stored && typeof stored === "object") {
        return {
          ...DEFAULT_SETTINGS,
          ...stored,
          options: { ...DEFAULT_SETTINGS.options, ...(_a = stored.options) != null ? _a : {} },
          window: clampWindow((_c = (_b = stored.window) == null ? void 0 : _b.width) != null ? _c : DEFAULT_SETTINGS.window.width, (_e = (_d = stored.window) == null ? void 0 : _d.height) != null ? _e : DEFAULT_SETTINGS.window.height)
        };
      }
    } catch {
    }
    return { ...DEFAULT_SETTINGS };
  }
  async function saveSettings(partial) {
    var _a;
    settings = {
      ...settings,
      ...partial,
      options: { ...settings.options, ...(_a = partial.options) != null ? _a : {} },
      window: partial.window ? clampWindow(partial.window.width, partial.window.height) : settings.window
    };
    try {
      await figma.clientStorage.setAsync(SETTINGS_KEY, settings);
    } catch {
    }
  }
  function readIgnored() {
    try {
      const raw = figma.root.getPluginData(IGNORED_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  }
  function writeIgnored(ids) {
    figma.root.setPluginData(IGNORED_KEY, JSON.stringify(ids));
  }
  function sendInit() {
    post({
      type: "init",
      settings,
      selectionCount: figma.currentPage.selection.length,
      fileName: figma.root.name,
      pageName: figma.currentPage.name,
      pageCount: figma.root.children.length,
      ignoredIssueIds: readIgnored(),
      editorType: figma.editorType
    });
  }
  async function handleScan(msg) {
    if (scanning) return;
    scanning = true;
    cancelRequested = false;
    issues.clear();
    plans.clear();
    journals.clear();
    const activeRules = resolveActiveRules(msg.preset, msg.disabledRules, msg.enabledRules, msg.mode);
    const ignored = new Set(readIgnored());
    let lastProgressAt = 0;
    try {
      const out = await runScan(
        { scope: msg.scope, options: msg.options, activeRules, ignoredIssueIds: ignored, rules: ALL_RULES },
        (p) => {
          const now = Date.now();
          if (now - lastProgressAt < 33 && p.phase === "scanning" && p.scanned < p.total) return;
          lastProgressAt = now;
          post({ type: "scan-progress", progress: p });
        },
        () => cancelRequested
      );
      for (const issue of out.result.issues) issues.set(issue.id, issue);
      for (const [id, p] of out.plans) plans.set(id, p);
      if (out.cancelled) post({ type: "scan-cancelled", partial: out.result });
      else post({ type: "scan-done", result: out.result });
    } catch (e) {
      post({ type: "scan-error", message: e instanceof Error ? e.message : String(e), partial: null });
    } finally {
      scanning = false;
    }
  }
  async function selectNodes(nodeIds, pageId) {
    if (pageId && figma.currentPage.id !== pageId) {
      const page = await figma.getNodeByIdAsync(pageId);
      if (page && page.type === "PAGE") await figma.setCurrentPageAsync(page);
    }
    const nodes = [];
    for (const id of nodeIds.slice(0, 200)) {
      const node = await figma.getNodeByIdAsync(id);
      if (node && node.type !== "DOCUMENT" && node.type !== "PAGE" && !node.removed) nodes.push(node);
    }
    if (!nodes.length) {
      const fr = settings.locale !== "en";
      if (nodeIds.some((id) => /^VariableID:|^S:/.test(id))) figma.notify(fr ? "Cette ligne concerne une variable ou un style : ouvre le panneau Variables ou Styles." : "This row is about a variable or a style: open the Variables or Styles panel.", { timeout: 3e3 });
      else figma.notify(fr ? "Ce calque n\u2019existe plus." : "This layer no longer exists.", { timeout: 2e3 });
      return;
    }
    programmaticSelectionKey = selectionKey(nodes);
    figma.currentPage.selection = nodes;
    revealNodes(nodes, uiSize);
  }
  var selectionKey = (nodes) => nodes.map((n) => n.id).sort().join("|");
  function postSelection() {
    const sel = figma.currentPage.selection;
    const key = selectionKey(sel);
    post({ type: "selection", count: sel.length, ids: sel.slice(0, 50).map((n) => n.id), programmatic: key !== "" && key === programmaticSelectionKey });
  }
  function planFor(issueId, alternativeId) {
    var _a;
    const p = plans.get(issueId);
    if (!p) return void 0;
    if (alternativeId && ((_a = p.alternativePlans) == null ? void 0 : _a[alternativeId])) return p.alternativePlans[alternativeId];
    return p.plan;
  }
  async function applyMany(entries, reportProgress) {
    const batchId = `batch-${++batchCounter}`;
    const journal = [];
    const outcomes = [];
    figma.commitUndo();
    let done = 0;
    for (const { issueId, alternativeId } of entries) {
      const issue = issues.get(issueId);
      const plan = planFor(issueId, alternativeId);
      if (!issue || !plan) {
        outcomes.push({ issueId, ok: false, reason: "no-plan" });
        continue;
      }
      try {
        const entry = await applyPlan(issueId, plan);
        journal.push(entry);
        issue.status = "fixed";
        outcomes.push({ issueId, ok: true });
      } catch (e) {
        outcomes.push({ issueId, ok: false, reason: e instanceof FixError ? e.reason : "unknown" });
      }
      done++;
      if (reportProgress && (done % 5 === 0 || done === entries.length)) post({ type: "fix-progress", done, total: entries.length });
      if (done % 10 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    if (journal.length) journals.set(batchId, journal);
    post({ type: "fix-done", batchId, outcomes, undoable: journal.length > 0 });
  }
  async function undoBatch(batchId) {
    const journal = journals.get(batchId);
    if (!journal) return;
    journals.delete(batchId);
    figma.commitUndo();
    const restored = [];
    for (const entry of [...journal].reverse()) {
      try {
        await entry.revert();
        const issue = issues.get(entry.issueId);
        if (issue) issue.status = "open";
        restored.push(entry.issueId);
      } catch {
      }
    }
    post({ type: "undo-done", batchId, issueIds: restored });
  }
  async function handlePreview(msg) {
    var _a;
    if (previewRunning) {
      previewPending = msg;
      return;
    }
    previewRunning = true;
    try {
      const items = [];
      for (const { issueId, alternativeId } of msg.items) {
        const issue = issues.get(issueId);
        const plan = planFor(issueId, alternativeId);
        if (issue && plan && issue.status === "open") items.push({ issueId, nodeId: issue.nodeId, plan });
      }
      const out = await renderPreview({ items, maxRoots: clamp(msg.maxRoots, 1, 6), rootId: (_a = msg.rootId) != null ? _a : null, followSelection: msg.followSelection });
      post({ type: "preview-done", requestId: msg.requestId, frames: out.frames, skipped: out.skipped, roots: out.roots });
    } catch (e) {
      post({ type: "preview-error", requestId: msg.requestId, message: e instanceof Error ? e.message : String(e) });
    } finally {
      previewRunning = false;
      if (previewPending) {
        const next = previewPending;
        previewPending = null;
        void handlePreview(next);
      }
    }
  }
  figma.ui.onmessage = async (msg) => {
    var _a;
    switch (msg.type) {
      case "ui-ready":
        sendInit();
        break;
      case "scan":
        await saveSettings({ preset: msg.preset, options: msg.options, disabledRules: msg.disabledRules, enabledRules: msg.enabledRules });
        await handleScan(msg);
        break;
      case "export-tokens": {
        try {
          const model = await buildTokenModel();
          const content = msg.format === "dtcg" ? toDtcg(model) : msg.format === "css" ? toCss(model) : toTailwind(model);
          post({ type: "tokens-exported", format: msg.format, content, variables: countVariables(model) });
        } catch (e) {
          figma.notify(e instanceof Error ? e.message : String(e), { error: true, timeout: 4e3 });
        }
        break;
      }
      case "cancel-scan":
        cancelRequested = true;
        break;
      case "select-node":
        await selectNodes([msg.nodeId], msg.pageId);
        break;
      case "select-nodes":
        await selectNodes(msg.nodeIds, msg.pageId);
        break;
      case "fix":
        await applyMany([{ issueId: msg.issueId, alternativeId: msg.alternativeId }], false);
        break;
      case "fix-many":
        await applyMany(msg.items, msg.items.length > 3);
        break;
      case "undo":
        await undoBatch(msg.batchId);
        break;
      case "preview":
        await handlePreview(msg);
        break;
      case "ignore-issue": {
        const set = new Set(readIgnored());
        if (msg.ignored) set.add(msg.issueId);
        else set.delete(msg.issueId);
        writeIgnored([...set]);
        const issue = issues.get(msg.issueId);
        if (issue) issue.status = msg.ignored ? "ignored" : "open";
        post({ type: "ignored-updated", ignoredIssueIds: [...set] });
        break;
      }
      case "save-settings":
        await saveSettings(msg.settings);
        post({ type: "settings-saved", settings });
        break;
      case "resize": {
        const total = { width: clamp(msg.width, MIN_TOTAL_W, MAX_TOTAL_W), height: clamp(msg.height, MIN_TOTAL_H, MAX_H) };
        figma.ui.resize(total.width, total.height);
        uiSize = total;
        if (msg.persist !== false) await saveSettings({ window: clampWindow((_a = msg.baseWidth) != null ? _a : total.width, total.height) });
        break;
      }
      case "notify":
        figma.notify(msg.message, { timeout: 2500, error: msg.error });
        break;
      case "open-url":
        if (/^https:\/\//.test(msg.url)) figma.openExternal(msg.url);
        break;
    }
  };
  figma.on("selectionchange", postSelection);
  figma.on("currentpagechange", () => post({ type: "page-changed", pageName: figma.currentPage.name }));
  (async () => {
    settings = await loadSettings();
    uiSize = { ...settings.window };
    try {
      sweepPreviewClones();
    } catch {
    }
    figma.showUI(__html__, { width: settings.window.width, height: settings.window.height, themeColors: true });
  })();
})();
