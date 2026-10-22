/** One finding about a template: what is wrong (error), may be (warning), or fine (ok). */
export interface TemplateNotice {
  level: 'error' | 'warning' | 'ok';
  message: string;
}

export const MAX_TEMPLATE_LENGTH = 200_000;

/** Every marker a template can use, by the block it belongs to. */
const MARKERS: Record<string, 'combo' | 'secciones' | 'productos'> = {
  'combo.nombre': 'combo',
  'combo.frase': 'combo',
  'combo.minimo': 'combo',
  'seccion.nombre': 'secciones',
  'producto.id': 'productos',
  'producto.nombre': 'productos',
  'producto.descripcion': 'productos',
  'producto.precio': 'productos',
  'producto.valor': 'productos',
  'producto.imagen': 'productos',
  indice: 'combo',
};
const REPEATS = new Set(['secciones', 'productos']);
const MARKER_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

function closestMarker(name: string): string | null {
  let best: string | null = null;
  let bestDistance = 4;
  for (const marker of Object.keys(MARKERS)) {
    const d = distance(name, marker);
    if (d < bestDistance) {
      best = marker;
      bestDistance = d;
    }
  }
  return best;
}

/** The repeat blocks an element sits in, from its own up. */
function repeatsAround(node: Node): Set<string> {
  const kinds = new Set<string>();
  for (
    let el: Element | null = node.nodeType === 1 ? (node as Element) : node.parentElement;
    el;
    el = el.parentElement
  ) {
    const kind = el.getAttribute('data-gb-repetir');
    if (kind) kinds.add(kind);
  }
  return kinds;
}

/**
 * What a template is missing or gets wrong, before a customer sees it: no
 * products, nothing to add them with, markers that don't exist or sit where
 * they'd come out empty, and what the isolation will block (forms, fetching,
 * outside scripts). `doc` is the template parsed as HTML.
 */
export function lintComboTemplate(
  html: string,
  doc: Document,
  counts?: { sections: number; products: number },
): TemplateNotice[] {
  const notices: TemplateNotice[] = [];
  if (!html.trim()) {
    return [{ level: 'error', message: 'La plantilla está vacía.' }];
  }
  if (html.length > MAX_TEMPLATE_LENGTH) {
    notices.push({
      level: 'error',
      message: `La plantilla pesa ${Math.round(html.length / 1000)} KB; el máximo es 200 KB. Pon las imágenes por URL, no incrustadas.`,
    });
  }

  const repeats = Array.from(doc.querySelectorAll('[data-gb-repetir]'));
  for (const el of repeats) {
    const kind = el.getAttribute('data-gb-repetir') ?? '';
    if (!REPEATS.has(kind)) {
      notices.push({
        level: 'error',
        message: `data-gb-repetir="${kind}" no existe: usa "secciones" o "productos".`,
      });
    }
  }
  const productBlocks = repeats.filter((el) => el.getAttribute('data-gb-repetir') === 'productos');
  if (productBlocks.length === 0) {
    notices.push({
      level: 'error',
      message:
        'No hay ningún bloque con data-gb-repetir="productos": la plantilla no mostrará productos.',
    });
  }
  const nestedSections = repeats.filter(
    (el) =>
      el.getAttribute('data-gb-repetir') === 'secciones' &&
      el.parentElement?.closest('[data-gb-repetir="productos"]'),
  );
  if (nestedSections.length > 0) {
    notices.push({
      level: 'warning',
      message:
        'Hay un bloque de secciones dentro de uno de productos: debe ser al revés (productos dentro de secciones).',
    });
  }

  const addButtons = Array.from(doc.querySelectorAll('[data-gb-agregar]'));
  if (addButtons.length === 0) {
    notices.push({
      level: 'warning',
      message:
        'No hay ningún elemento con data-gb-agregar: el cliente no podrá agregar productos al combo.',
    });
  }
  for (const attr of ['data-gb-agregar', 'data-gb-quitar', 'data-gb-cantidad']) {
    const outside = Array.from(doc.querySelectorAll(`[${attr}]`)).filter(
      (el) => !repeatsAround(el).has('productos'),
    );
    if (outside.length > 0) {
      notices.push({
        level: 'warning',
        message: `${attr} está fuera de un bloque de productos: no sabrá a qué producto se refiere.`,
      });
    }
  }

  // Markers: they exist, and sit inside the block they belong to.
  const unknown = new Set<string>();
  const misplaced = new Set<string>();
  const check = (text: string, node: Node) => {
    for (const match of text.matchAll(MARKER_RE)) {
      const name = match[1];
      const block = MARKERS[name];
      if (!block) {
        unknown.add(name);
      } else if (block !== 'combo' && !repeatsAround(node).has(block)) {
        misplaced.add(name);
      }
    }
  };
  const walker = doc.createTreeWalker(doc.documentElement, 4 /* NodeFilter.SHOW_TEXT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentNode?.nodeName;
    if (parent === 'SCRIPT' || parent === 'STYLE') continue;
    if (node.nodeValue?.includes('{{')) check(node.nodeValue, node);
  }
  for (const el of Array.from(doc.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.value.includes('{{')) check(attr.value, el);
    }
  }
  for (const name of unknown) {
    const suggestion = closestMarker(name);
    notices.push({
      level: 'error',
      message: `{{${name}}} no existe${suggestion ? ` (¿quisiste decir {{${suggestion}}}?)` : ''}: se verá vacío.`,
    });
  }
  for (const name of misplaced) {
    const block = MARKERS[name];
    notices.push({
      level: 'warning',
      message: `{{${name}}} está fuera de un bloque data-gb-repetir="${block}": se verá vacío.`,
    });
  }

  // What the isolation blocks.
  if (doc.querySelector('form')) {
    notices.push({
      level: 'warning',
      message: 'Los formularios (<form>) no funcionan dentro de la plantilla.',
    });
  }
  if (doc.querySelector('script[src]')) {
    notices.push({
      level: 'warning',
      message:
        'Los scripts externos (<script src>) no se cargan: el JavaScript debe ir dentro de la plantilla.',
    });
  }
  const scripts = Array.from(doc.querySelectorAll('script'))
    .map((s) => s.textContent ?? '')
    .join('\n');
  if (/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/.test(scripts)) {
    notices.push({
      level: 'warning',
      message:
        'La plantilla intenta conectarse a internet (fetch, XMLHttpRequest…): está bloqueado.',
    });
  }
  if (doc.querySelector('a[href]:not([href^="#"])')) {
    notices.push({
      level: 'warning',
      message: 'Los enlaces no llevan a otras páginas: el cliente se queda en el combo.',
    });
  }

  if (!notices.some((notice) => notice.level === 'error')) {
    notices.push({
      level: 'ok',
      message: counts
        ? `Lista: muestra ${counts.sections} ${counts.sections === 1 ? 'sección' : 'secciones'} y ${counts.products} ${counts.products === 1 ? 'producto' : 'productos'}.`
        : 'Sin errores.',
    });
  }
  return notices;
}
