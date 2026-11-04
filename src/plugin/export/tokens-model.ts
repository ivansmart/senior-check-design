/// <reference types="@figma/plugin-typings" />
/** Construit le modèle sérialisable des variables locales (Pro), formaté ensuite par src/shared/tokens-export. */
import { rgbToHex } from '../../shared/color';
import type { TokenModel, TokenValue, TokenVariable } from '../../shared/tokens-export';

const EXPORTABLE = new Set<string>(['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']);

export async function buildTokenModel(): Promise<TokenModel> {
  const [collections, variables] = await Promise.all([figma.variables.getLocalVariableCollectionsAsync(), figma.variables.getLocalVariablesAsync()]);
  const byId = new Map(variables.map((v) => [v.id, v]));
  const colById = new Map(collections.map((c) => [c.id, c]));
  const convert = (value: VariableValue): TokenValue => {
    if (typeof value === 'object' && value !== null && 'type' in value && value.type === 'VARIABLE_ALIAS') {
      const target = byId.get(value.id);
      const col = target ? colById.get(target.variableCollectionId) : undefined;
      return target ? { kind: 'alias', collection: col?.name ?? '', name: target.name } : { kind: 'string', value: '(alias inaccessible)' };
    }
    if (typeof value === 'object' && value !== null && 'r' in value) {
      const c = value as RGBA;
      return { kind: 'color', hex: rgbToHex({ r: c.r, g: c.g, b: c.b }, 'a' in c ? c.a : 1) };
    }
    if (typeof value === 'number') return { kind: 'number', value: Math.round(value * 1000) / 1000 };
    if (typeof value === 'boolean') return { kind: 'boolean', value };
    return { kind: 'string', value: String(value) };
  };
  return {
    collections: collections.map((c) => ({
      name: c.name,
      modes: c.modes.map((m) => ({ id: m.modeId, name: m.name })),
      defaultModeId: c.defaultModeId,
      variables: variables
        .filter((v) => v.variableCollectionId === c.id && EXPORTABLE.has(v.resolvedType))
        .map<TokenVariable>((v) => ({
          name: v.name,
          type: v.resolvedType as TokenVariable['type'],
          description: v.description || undefined,
          scopes: [...v.scopes],
          valuesByMode: Object.fromEntries(Object.entries(v.valuesByMode).map(([mode, value]) => [mode, convert(value)])),
        })),
    })),
  };
}
