"use strict";
(() => {
  // src/shared/rules-catalog.ts
  var RULES = [
    // Couleurs
    { id: "colors/hardcoded-fill", category: "colors", severity: "error" },
    { id: "colors/hardcoded-stroke", category: "colors", severity: "error" },
    // Typographie
    { id: "typography/no-text-style", category: "typography", severity: "error" },
    { id: "typography/mixed-styles", category: "typography", severity: "info" },
    { id: "typography/off-scale-size", category: "typography", severity: "warning" },
    // Espacement
    { id: "spacing/off-scale-padding", category: "spacing", severity: "warning" },
    { id: "spacing/off-scale-gap", category: "spacing", severity: "warning" },
    // Radius
    { id: "radius/not-tokenized", category: "radius", severity: "warning" },
    // Composants
    { id: "components/detached-instance", category: "components", severity: "warning" },
    { id: "components/default-name", category: "components", severity: "info" },
    { id: "components/heavy-overrides", category: "components", severity: "info" },
    { id: "components/duplicate-component", category: "components", severity: "info", aggregate: true },
    { id: "components/no-description", category: "components", severity: "info" },
    // Craft & interaction
    { id: "craft/missing-state", category: "craft", severity: "warning" },
    { id: "craft/missing-loading-state", category: "craft", severity: "warning" },
    { id: "craft/missing-empty-state", category: "craft", severity: "warning" },
    { id: "craft/state-naming", category: "craft", severity: "info", aggregate: true },
    { id: "craft/missing-hover-transition", category: "craft", severity: "info" },
    { id: "craft/inconsistent-motion", category: "craft", severity: "warning", aggregate: true },
    // Accessibilité
    {
      id: "a11y/text-contrast",
      category: "a11y",
      severity: "error",
      docUrl: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
    },
    { id: "a11y/contrast-not-verifiable", category: "a11y", severity: "info" },
    {
      id: "a11y/touch-target",
      category: "a11y",
      severity: "warning",
      docUrl: "https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html"
    },
    { id: "a11y/text-too-small", category: "a11y", severity: "info" },
    // Handoff
    { id: "handoff/fractional-size", category: "handoff", severity: "info" },
    { id: "handoff/fractional-position", category: "handoff", severity: "info" },
    { id: "handoff/stackable-without-autolayout", category: "handoff", severity: "info" }
  ];
  var RULE_BY_ID = Object.fromEntries(RULES.map((r) => [r.id, r]));
  var ALL_RULE_IDS = RULES.map((r) => r.id);
  var byCategory = (...cats) => RULES.filter((r) => cats.includes(r.category)).map((r) => r.id);
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
    handoff: [
      ...byCategory("colors", "typography", "spacing", "radius", "handoff"),
      "components/detached-instance",
      "components/default-name",
      "components/heavy-overrides"
    ],
    "design-system": [
      ...byCategory("colors", "typography", "spacing", "radius", "components"),
      "craft/state-naming",
      "craft/missing-state"
    ],
    a11y: [...byCategory("a11y"), "craft/missing-state"],
    craft: [...byCategory("craft"), "a11y/touch-target"],
    strict: ALL_RULE_IDS
  };
  function resolveActiveRules(preset, disabled, enabled) {
    var _a;
    const set = new Set((_a = PRESETS[preset]) != null ? _a : PRESETS.quick);
    for (const id of enabled) if (RULE_BY_ID[id]) set.add(id);
    for (const id of disabled) set.delete(id);
    return set;
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
    preset: "quick",
    scope: "auto",
    options: DEFAULT_OPTIONS,
    showRowCounts: true,
    showContrast: true,
    disabledRules: [],
    enabledRules: [],
    window: { width: 600, height: 640 }
  };

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
    var _a, _b;
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
    }
  }

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
  function pageOf(node) {
    let p = node;
    while (p && p.type !== "PAGE") p = p.parent;
    return p != null ? p : null;
  }
  function pathOf(node, ctx) {
    const anc = ancestors(node, ctx);
    const page = pageOf(node);
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
    const page = pageOf(node);
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
          const unique = [...new Set(problems)].filter((p) => p.split(" \u2192 ")[0] !== p.split(" \u2192 ")[1]);
          if (!unique.length) continue;
          out.push({
            ruleId: "craft/state-naming",
            node: s.node,
            currentValue: unique.join(", "),
            fixSafety: "none",
            params: { component: s.name, changes: unique.join(", ") }
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
        const segments = text.getStyledTextSegments(["fontName", "fontSize", "textStyleId"]).length;
        return [
          {
            ruleId: "typography/mixed-styles",
            node,
            currentValue: `${segments} styles`,
            fixSafety: "none",
            params: { segments, mixedStyle: mixedStyle ? 1 : 0 }
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

  // src/plugin/rules/index.ts
  var ALL_RULES = [
    ...colorRules,
    ...typographyRules,
    ...spacingRules,
    ...radiusRules,
    ...componentRules,
    ...craftRules,
    ...a11yRules,
    ...handoffRules
  ];

  // src/plugin/scan/context.ts
  var yieldToHost = () => typeof setTimeout === "function" ? new Promise((r) => setTimeout(r, 0)) : Promise.resolve();
  var isAlias = (v) => typeof v === "object" && v !== null && v.type === "VARIABLE_ALIAS";
  async function resolveVariableValue(variable, modeId, depth = 0) {
    if (depth > 12) return void 0;
    const modes = Object.keys(variable.valuesByMode);
    if (!modes.length) return void 0;
    const mode = modeId && modeId in variable.valuesByMode ? modeId : modes[0];
    const value = variable.valuesByMode[mode];
    if (isAlias(value)) {
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
      found: {},
      reportProgress,
      isCancelled
    };
  }
  var MAX_LIBRARY_VARIABLES = 800;
  async function indexTokens(ctx) {
    const collectionCache = /* @__PURE__ */ new Map();
    ctx.reportProgress({ phase: "indexing", detail: "local" });
    const [localVars, paintStyles, textStyles] = await Promise.all([
      figma.variables.getLocalVariablesAsync(),
      figma.getLocalPaintStylesAsync(),
      figma.getLocalTextStylesAsync()
    ]);
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
      let imported = 0;
      try {
        const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
        for (const col of collections) {
          if (ctx.isCancelled()) return;
          if (imported >= MAX_LIBRARY_VARIABLES) {
            ctx.warnings.push("library-cap");
            break;
          }
          ctx.reportProgress({ phase: "indexing", detail: col.libraryName });
          if (!ctx.libraries.includes(col.libraryName)) ctx.libraries.push(col.libraryName);
          try {
            const vars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(col.key);
            for (const lv of vars) {
              if (lv.resolvedType !== "COLOR" && lv.resolvedType !== "FLOAT") continue;
              if (imported >= MAX_LIBRARY_VARIABLES) break;
              try {
                const v = await figma.variables.importVariableByKeyAsync(lv.key);
                await indexVariable(ctx, v, col.libraryName, collectionCache);
              } catch {
              }
              if (++imported % 25 === 0) {
                await yieldToHost();
                if (ctx.isCancelled()) return;
              }
            }
          } catch {
            ctx.warnings.push(`library:${col.libraryName}`);
          }
        }
      } catch {
        ctx.warnings.push("libraries-unavailable");
      }
    }
    buildFloatScales(ctx);
  }
  function rebuildScales(ctx) {
    buildFloatScales(ctx);
  }

  // src/plugin/scan/engine.ts
  var BATCH_SIZE = 120;
  var MAX_LEARNED_STYLES = 300;
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
    let i = 0;
    for (const id of textIds) {
      if (knownText.has(id)) continue;
      try {
        const s = await figma.getStyleByIdAsync(id);
        if (s && s.type === "TEXT") indexTextStyle(ctx, s);
      } catch {
      }
      if (++i % 40 === 0) await yieldToHost();
    }
    for (const id of paintIds) {
      if (knownPaint.has(id)) continue;
      try {
        const s = await figma.getStyleByIdAsync(id);
        if (s && s.type === "PAINT") await indexPaintStyle(ctx, s);
      } catch {
      }
      if (++i % 40 === 0) await yieldToHost();
    }
    rebuildScales(ctx);
  }
  function toIssue(raw, ctx, ignored) {
    var _a, _b, _c, _d, _e;
    const meta = RULE_BY_ID[raw.ruleId];
    const id = `${raw.ruleId}::${raw.node.id}::${(_a = raw.slot) != null ? _a : ""}`;
    const page = pageOf(raw.node);
    const severity = (_b = raw.severity) != null ? _b : meta.severity;
    return {
      id,
      ruleId: raw.ruleId,
      category: meta.category,
      severity,
      nodeId: raw.node.id,
      nodeName: raw.node.name,
      nodeType: raw.node.type,
      nodePath: pathOf(raw.node, ctx),
      pageId: (_c = page == null ? void 0 : page.id) != null ? _c : "",
      currentValue: raw.currentValue,
      swatch: raw.swatch,
      suggestion: raw.suggestion,
      fixSafety: raw.fixSafety,
      params: raw.params,
      status: ignored.has(id) ? "ignored" : "open",
      groupKey: `${raw.ruleId}|${raw.currentValue}|${(_e = (_d = raw.suggestion) == null ? void 0 : _d.id) != null ? _e : ""}`
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
    const rules = ALL_RULES.filter((r) => req.activeRules.has(r.id));
    const needsCraftCollector = ["craft/missing-loading-state", "craft/missing-empty-state", "craft/missing-hover-transition", "craft/state-naming", "craft/inconsistent-motion"];
    if (needsCraftCollector.some((id) => req.activeRules.has(id)) && !rules.some((r) => r.id === "craft/missing-state")) {
      const collector = ALL_RULES.find((r) => r.id === "craft/missing-state");
      rules.push(collector);
    }
    if (req.activeRules.has("a11y/contrast-not-verifiable") && !rules.some((r) => r.id === "a11y/text-contrast")) {
      rules.push(ALL_RULES.find((r) => r.id === "a11y/text-contrast"));
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
    const catOrder = { colors: 0, typography: 1, spacing: 2, radius: 3, components: 4, craft: 5, a11y: 6, handoff: 7 };
    issues2.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || catOrder[a.category] - catOrder[b.category] || a.groupKey.localeCompare(b.groupKey));
    return finish(false, req.scope, label, pages, scanned);
  }

  // src/plugin/main.ts
  var SETTINGS_KEY = "scd:settings:v1";
  var IGNORED_KEY = "scd:ignored";
  var MIN_W = 480;
  var MIN_H = 480;
  var MAX_W = 900;
  var MAX_H = 1200;
  var settings = { ...DEFAULT_SETTINGS };
  var scanning = false;
  var cancelRequested = false;
  var issues = /* @__PURE__ */ new Map();
  var plans = /* @__PURE__ */ new Map();
  var journals = /* @__PURE__ */ new Map();
  var batchCounter = 0;
  var post = (msg) => figma.ui.postMessage(msg);
  function clampWindow(w, h) {
    return { width: Math.round(Math.min(MAX_W, Math.max(MIN_W, w))), height: Math.round(Math.min(MAX_H, Math.max(MIN_H, h))) };
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
    const activeRules = resolveActiveRules(msg.preset, msg.disabledRules, msg.enabledRules);
    const ignored = new Set(readIgnored());
    let lastProgressAt = 0;
    try {
      const out = await runScan(
        { scope: msg.scope, options: msg.options, activeRules, ignoredIssueIds: ignored },
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
      figma.notify("Ce calque n\u2019existe plus.", { timeout: 2e3 });
      return;
    }
    figma.currentPage.selection = nodes;
    figma.viewport.scrollAndZoomIntoView(nodes);
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
  figma.ui.onmessage = async (msg) => {
    switch (msg.type) {
      case "ui-ready":
        sendInit();
        break;
      case "scan":
        await saveSettings({ preset: msg.preset, options: msg.options, disabledRules: msg.disabledRules, enabledRules: msg.enabledRules });
        await handleScan(msg);
        break;
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
        const size = clampWindow(msg.width, msg.height);
        figma.ui.resize(size.width, size.height);
        await saveSettings({ window: size });
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
  figma.on("selectionchange", () => post({ type: "selection", count: figma.currentPage.selection.length }));
  figma.on("currentpagechange", () => post({ type: "page-changed", pageName: figma.currentPage.name }));
  (async () => {
    settings = await loadSettings();
    figma.showUI(__html__, { width: settings.window.width, height: settings.window.height, themeColors: true });
  })();
})();
