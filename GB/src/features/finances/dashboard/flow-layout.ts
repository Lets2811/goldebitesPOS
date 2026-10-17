/**
 * Cómo se acomodan los widgets del panel de Finanzas: en orden de lectura,
 * como texto que fluye, sin dejar huecos. El orden lo decide la persona
 * arrastrando; las posiciones las calcula esto.
 */

export interface FlowSize {
  i: string;
  w: number;
  h: number;
}

export interface FlowPlacement extends FlowSize {
  x: number;
  y: number;
}

/**
 * Orden de lectura de un panel ya acomodado: de arriba abajo y de izquierda a
 * derecha. En un empate gana el widget que se está arrastrando (`moved`), que
 * así queda delante del que ocupaba ese lugar.
 */
export function readingOrder<T extends { x: number; y: number; moved?: boolean }>(layout: readonly T[]): T[] {
  return [...layout].sort((a, b) => a.y - b.y || a.x - b.x || Number(Boolean(b.moved)) - Number(Boolean(a.moved)));
}

/**
 * Acomoda los widgets en el orden dado: cada uno en el primer lugar libre
 * después del anterior, bajando a la fila siguiente cuando no cabe (como
 * `grid-auto-flow: row` de CSS). Con `stretch`, los widgets se estiran
 * hacia la derecha y hacia abajo sobre el espacio que quedó libre a su lado,
 * para que quitar o mover uno nunca deje un hueco; la última fila del panel
 * se deja como está.
 */
export function flowLayout(items: readonly FlowSize[], cols: number, { stretch }: { stretch: boolean }): FlowPlacement[] {
  const occupied: boolean[][] = [];
  const isFree = (x: number, y: number, w: number, h: number) => {
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        if (occupied[row]?.[col]) return false;
      }
    }
    return true;
  };
  const mark = (item: FlowPlacement, value: boolean) => {
    for (let row = item.y; row < item.y + item.h; row++) {
      occupied[row] ??= [];
      for (let col = item.x; col < item.x + item.w; col++) occupied[row][col] = value;
    }
  };

  const placed: FlowPlacement[] = [];
  let cursorX = 0;
  let cursorY = 0;
  for (const item of items) {
    const w = Math.min(Math.max(item.w, 1), cols);
    const h = Math.max(item.h, 1);
    let y = cursorY;
    let x = cursorX;
    while (x + w > cols || !isFree(x, y, w, h)) {
      x += 1;
      if (x + w > cols) {
        x = 0;
        y += 1;
      }
    }
    const placement = { i: item.i, x, y, w, h };
    mark(placement, true);
    placed.push(placement);
    cursorX = x + w;
    cursorY = y;
  }

  if (stretch) {
    fillRowEnds(placed, cols, isFree, mark);
    fillBelow(placed, isFree, mark);
  }
  return placed;
}

/**
 * Estira hacia la derecha las filas que terminan antes del borde: el espacio
 * libre se reparte entre los widgets contiguos de esa fila que tienen la
 * misma altura (una fila de indicadores queda pareja), y si no hay más de uno,
 * se lo lleva el último.
 */
function fillRowEnds(
  placed: FlowPlacement[],
  cols: number,
  isFree: (x: number, y: number, w: number, h: number) => boolean,
  mark: (item: FlowPlacement, value: boolean) => void,
) {
  const bottom = placed.reduce((max, item) => Math.max(max, item.y + item.h), 0);

  for (const last of readingOrder(placed)) {
    const end = last.x + last.w;
    const gap = cols - end;
    // La última fila puede quedar incompleta: es donde cae lo que se agrega.
    if (gap <= 0 || last.y + last.h >= bottom || !isFree(end, last.y, gap, last.h)) continue;

    const group = [last];
    for (;;) {
      const first = group[0];
      const previous = placed.find(
        (item) => item.y === first.y && item.h === first.h && item.x + item.w === first.x,
      );
      if (!previous) break;
      group.unshift(previous);
    }

    for (const item of group) mark(item, false);
    const share = Math.floor(gap / group.length);
    // El resto de la división se lo llevan los últimos de la fila.
    const extraFrom = group.length - (gap % group.length);
    let x = group[0].x;
    group.forEach((item, index) => {
      item.x = x;
      item.w += share + (index >= extraFrom ? 1 : 0);
      x += item.w;
    });
    for (const item of group) mark(item, true);
  }
}

/**
 * Estira hacia abajo un widget que tiene espacio libre debajo, cuando un
 * vecino más alto lo deja ahí (dos indicadores al lado de una gráfica, por
 * ejemplo). Solo llena huecos cerrados por otro widget debajo: junto a la
 * última fila, que puede quedar incompleta, no crece.
 */
function fillBelow(
  placed: FlowPlacement[],
  isFree: (x: number, y: number, w: number, h: number) => boolean,
  mark: (item: FlowPlacement, value: boolean) => void,
) {
  const bottom = placed.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  for (const item of readingOrder(placed)) {
    let grow = 0;
    while (item.y + item.h + grow < bottom && isFree(item.x, item.y + item.h + grow, item.w, 1)) grow += 1;
    if (grow === 0 || item.y + item.h + grow >= bottom) continue;
    item.h += grow;
    mark(item, true);
  }
}
