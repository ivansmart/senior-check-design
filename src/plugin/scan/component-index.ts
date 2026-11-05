/// <reference types="@figma/plugin-typings" />
/**
 * Index des composants candidats (rattachement d'instances détachées, composants recréés à la main) :
 * - composants locaux de la page analysée, puis des autres pages du fichier (chargées à la demande, bornées) ;
 * - composants de librairie : ceux que des instances du fichier utilisent, avec leurs variantes sœurs quand le jeu
 *   est accessible. L'API des plugins ne permet pas de lister le contenu d'une librairie : un composant de librairie
 *   qu'aucune instance n'utilise n'est atteignable que par sa clé (trace de détachement).
 */
import { yieldToHost, type ScanContext } from './context';

export type ComponentSource = 'local' | 'otherPages' | 'library';

export interface ComponentIndex {
  components: ComponentNode[];
  /** Index incomplet (bornes de temps ou de nombre atteintes). */
  partial: boolean;
  sources: Record<ComponentSource, number>;
}

/** Bornes : composants indexés, variantes retenues par jeu, instances interrogées (composant principal), temps total. */
const MAX_COMPONENTS = 2500;
const MAX_PER_FAMILY = 80;
const MAX_INSTANCE_LOOKUPS = 1500;
const INSTANCE_LOOKUP_BUDGET_MS = 1500;
const PAGES_BUDGET_MS = 3000;

/** Famille d'un composant : son jeu de variantes, sinon lui-même. */
export const familyOf = (comp: ComponentNode): string => (comp.parent?.type === 'COMPONENT_SET' ? comp.parent.id : comp.id);

/**
 * Ajoute un composant et, si le jeu est accessible, ses variantes sœurs (au plus MAX_PER_FAMILY par jeu,
 * réparties sur tout le jeu : un bouton à mille variantes ne doit pas évincer les autres composants).
 */
export function addComponent(ctx: ScanContext, comp: ComponentNode, source: ComponentSource): boolean {
  if (ctx.componentPool.size >= MAX_COMPONENTS) return false;
  const set = comp.parent?.type === 'COMPONENT_SET' ? comp.parent : null;
  let members = set ? set.children.filter((c): c is ComponentNode => c.type === 'COMPONENT') : [comp];
  if (members.length > MAX_PER_FAMILY) {
    const step = members.length / MAX_PER_FAMILY;
    const sampled = new Set<ComponentNode>([comp]);
    for (let i = 0; sampled.size < MAX_PER_FAMILY && i < members.length; i = Math.ceil(i + step)) sampled.add(members[i]);
    members = [...sampled];
  }
  for (const c of members) {
    if (ctx.componentPool.has(c.id)) continue;
    if (ctx.componentPool.size >= MAX_COMPONENTS) return false;
    ctx.componentPool.set(c.id, { comp: c, source: c.remote ? 'library' : source });
  }
  return true;
}

/** Note le composant principal d'une instance (composants de librairie utilisés dans le fichier), dans les bornes. */
export async function noteInstance(ctx: ScanContext, instance: InstanceNode): Promise<boolean> {
  if (ctx.instanceLookups.count >= MAX_INSTANCE_LOOKUPS || ctx.instanceLookups.ms >= INSTANCE_LOOKUP_BUDGET_MS) return false;
  ctx.instanceLookups.count++;
  const t0 = Date.now();
  try {
    const main = await instance.getMainComponentAsync();
    if (main && !main.removed) addComponent(ctx, main, main.remote ? 'library' : 'local');
  } catch {
    /* instance sans composant accessible */
  }
  ctx.instanceLookups.ms += Date.now() - t0;
  return true;
}

async function indexPage(ctx: ScanContext, page: PageNode, source: ComponentSource): Promise<boolean> {
  let complete = true;
  for (const c of page.findAllWithCriteria({ types: ['COMPONENT'] }) as ComponentNode[]) {
    if (!addComponent(ctx, c, source)) {
      complete = false;
      break;
    }
  }
  for (const inst of page.findAllWithCriteria({ types: ['INSTANCE'] }) as InstanceNode[]) {
    if (!(await noteInstance(ctx, inst))) {
      complete = false;
      break;
    }
  }
  return complete;
}

/** Construit (une fois par analyse) l'index des composants candidats. */
export async function buildComponentIndex(ctx: ScanContext): Promise<ComponentIndex> {
  if (ctx.componentIndex) return ctx.componentIndex;
  let partial = false;
  // Périmètre sélection : la page courante hors sélection n'a pas été parcourue.
  if (ctx.scope === 'selection' && !(await indexPage(ctx, figma.currentPage, 'local'))) partial = true;
  // Autres pages (hors périmètre fichier, déjà parcouru) : chargées à la demande, dans un budget de temps.
  if (ctx.options.componentsFromAllPages && ctx.scope !== 'file') {
    const t0 = Date.now();
    for (const page of figma.root.children) {
      if (page.id === figma.currentPage.id) continue;
      if (Date.now() - t0 > PAGES_BUDGET_MS || ctx.isCancelled()) {
        partial = true;
        break;
      }
      try {
        await page.loadAsync();
      } catch {
        continue;
      }
      if (!(await indexPage(ctx, page, 'otherPages'))) partial = true;
      await yieldToHost();
    }
  }
  if (ctx.instanceLookups.count >= MAX_INSTANCE_LOOKUPS || ctx.instanceLookups.ms >= INSTANCE_LOOKUP_BUDGET_MS) partial = true;
  const sources: Record<ComponentSource, number> = { local: 0, otherPages: 0, library: 0 };
  const components: ComponentNode[] = [];
  for (const { comp, source } of ctx.componentPool.values()) {
    if (comp.removed) continue;
    components.push(comp);
    sources[source]++;
  }
  ctx.componentIndex = { components, partial, sources };
  return ctx.componentIndex;
}
