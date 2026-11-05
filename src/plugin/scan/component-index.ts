/// <reference types="@figma/plugin-typings" />
/**
 * Index des composants candidats (rattachement d'instances détachées, composants recréés à la main) :
 * - composants locaux de la page analysée, puis des autres pages du fichier (chargées à la demande, bornées) ;
 * - composants de librairie : ceux que des instances du fichier utilisent, avec leurs variantes sœurs quand le jeu
 *   est accessible. L'API des plugins ne permet pas de lister le contenu d'une librairie : un composant de librairie
 *   qu'aucune instance n'utilise n'est atteignable que par sa clé (trace de détachement).
 * Les composants trouvés hors de la page analysée sont mémorisés quelques minutes : une relance sur une
 * sélection ne recharge pas cinquante pages.
 */
import { yieldToHost, type ScanContext } from './context';

export type ComponentSource = 'local' | 'otherPages' | 'library';

export interface ComponentIndex {
  components: ComponentNode[];
  /** Index incomplet (bornes de temps ou de nombre atteintes). */
  partial: boolean;
  sources: Record<ComponentSource, number>;
  /** Les autres pages viennent de l'index mémorisé par une analyse précédente. */
  fromCache: boolean;
}

/** Bornes : composants indexés, variantes retenues par jeu, instances interrogées (composant principal), temps total. */
const MAX_COMPONENTS = 2500;
const MAX_PER_FAMILY = 80;
const MAX_INSTANCE_LOOKUPS = 1500;
const INSTANCE_LOOKUP_BUDGET_MS = 1500;
const PAGES_BUDGET_MS = 3000;
/** Durée de validité de l'index des autres pages entre deux analyses d'une même ouverture du plugin. */
const OTHER_PAGES_CACHE_MS = 120_000;

interface PagesCache {
  at: number;
  /** Page analysée et liste des pages : un autre contexte invalide la mémorisation. */
  key: string;
  entries: { comp: ComponentNode; source: ComponentSource }[];
  partial: boolean;
}

let pagesCache: PagesCache | null = null;

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

/** Clé de dédoublonnage d'une instance : nom et taille arrondie. Mille instances d'un même bouton n'entraînent qu'une recherche. */
const instanceKey = (instance: InstanceNode) => `${instance.name}|${Math.round(instance.width / 8)}|${Math.round(instance.height / 8)}`;

/** Note le composant principal d'une instance (composants de librairie utilisés dans le fichier), dans les bornes. */
export async function noteInstance(ctx: ScanContext, instance: InstanceNode): Promise<boolean> {
  const key = instanceKey(instance);
  if (ctx.instanceLookupKeys.has(key)) return true;
  if (ctx.instanceLookups.count >= MAX_INSTANCE_LOOKUPS || ctx.instanceLookups.ms >= INSTANCE_LOOKUP_BUDGET_MS) return false;
  ctx.instanceLookupKeys.add(key);
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
  const instances = page.findAllWithCriteria({ types: ['INSTANCE'] }) as InstanceNode[];
  for (let i = 0; i < instances.length; i++) {
    if (!(await noteInstance(ctx, instances[i]))) {
      complete = false;
      break;
    }
    // Une page de plusieurs milliers d'instances ne doit pas figer l'éditeur.
    if (i % 100 === 99) await yieldToHost();
  }
  return complete;
}

/** Construit (une fois par analyse) l'index des composants candidats. */
export async function buildComponentIndex(ctx: ScanContext): Promise<ComponentIndex> {
  if (ctx.componentIndex) return ctx.componentIndex;
  let partial = false;
  let fromCache = false;
  // Périmètre sélection : la page courante hors sélection n'a pas été parcourue.
  if (ctx.scope === 'selection' && !(await indexPage(ctx, figma.currentPage, 'local'))) partial = true;
  // Autres pages (hors périmètre fichier, déjà parcouru) : chargées à la demande, dans un budget de temps.
  if (ctx.options.componentsFromAllPages && ctx.scope !== 'file') {
    const key = `${figma.currentPage.id}|${figma.root.children.map((p) => p.id).join(',')}`;
    const cache = pagesCache && pagesCache.key === key && Date.now() - pagesCache.at < OTHER_PAGES_CACHE_MS ? pagesCache : null;
    if (cache) {
      fromCache = true;
      for (const { comp, source } of cache.entries) if (!comp.removed) addComponent(ctx, comp, source);
      if (cache.partial) partial = true;
    } else {
      const t0 = Date.now();
      const others = figma.root.children.filter((p) => p.id !== figma.currentPage.id);
      let pagesPartial = false;
      for (let i = 0; i < others.length; i++) {
        const page = others[i];
        if (Date.now() - t0 > PAGES_BUDGET_MS || ctx.isCancelled()) {
          pagesPartial = true;
          break;
        }
        ctx.reportProgress({ phase: 'components', scanned: i, total: others.length, detail: page.name });
        try {
          await page.loadAsync();
        } catch {
          continue;
        }
        if (!(await indexPage(ctx, page, 'otherPages'))) pagesPartial = true;
        await yieldToHost();
      }
      if (pagesPartial) partial = true;
      ctx.reportProgress({ phase: 'finalizing', scanned: others.length, total: others.length });
      pagesCache = { at: Date.now(), key, entries: [...ctx.componentPool.values()].filter((e) => e.source !== 'local'), partial: pagesPartial };
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
  ctx.componentIndex = { components, partial, sources, fromCache };
  return ctx.componentIndex;
}
