/**
 * The page a business's "Arma tu combo" template becomes: its own HTML/CSS
 * with the markers filled in, shown in a sandboxed iframe (scripts allowed,
 * nothing else: no access to the app, its storage or session, no network, no
 * leaving the frame). It talks to the app only by messages:
 *
 *   app → template   { source: 'gb-parent', type: 'data', data }    the combo and its products
 *                    { source: 'gb-parent', type: 'state', state }  what the customer has picked
 *                    { source: 'gb-parent', type: 'options', options } a product's options to choose
 *   template → app   { source: 'gb-combo', type: 'ready' }
 *                    { source: 'gb-combo', type: 'pick', productId }
 *                    { source: 'gb-combo', type: 'remove', productId }
 *                    { source: 'gb-combo', type: 'choose', productId, optionItemIds, noneGroupIds }
 *                    { source: 'gb-combo', type: 'height', height }
 *
 * Markers (see COMBO_TEMPLATE_GUIDE):
 *   {{combo.nombre}} {{combo.frase}} {{combo.minimo}}
 *   data-gb-repetir="secciones" → {{seccion.nombre}}
 *   data-gb-repetir="productos" → {{producto.nombre}} {{producto.descripcion}} {{producto.precio}} {{producto.imagen}}
 *   data-gb-agregar / data-gb-quitar (inside a product), data-gb-cantidad (its count)
 *   data-gb-total, data-gb-cantidad-total; class gb-elegido on a product picked at least once
 */

/** Runs inside the iframe. Plain JS: it is injected as text. */
const RUNTIME = String.raw`
(function () {
  'use strict';
  var parentWindow = window.parent;
  var RE = /\{\{\s*([\w.]+)\s*\}\}/g;
  var SKIP = { SCRIPT: true, STYLE: true, TEXTAREA: true };
  var pristine = null;
  var data = null;
  var shownIds = '';
  var state = { counts: {}, total: '', cantidad: 0 };

  function post(message) {
    message.source = 'gb-combo';
    parentWindow.postMessage(message, '*');
  }

  function get(ctx, path) {
    var value = ctx;
    var parts = path.split('.');
    for (var i = 0; i < parts.length; i++) {
      if (value == null) return '';
      value = value[parts[i]];
    }
    return value == null ? '' : String(value);
  }

  function fill(text, ctx) {
    return text.replace(RE, function (_, path) { return get(ctx, path); });
  }

  // Text and attributes only: values never become markup.
  function substitute(root, ctx) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach(function (node) {
      if (node.parentNode && SKIP[node.parentNode.nodeName]) return;
      if (node.nodeValue.indexOf('{{') >= 0) node.nodeValue = fill(node.nodeValue, ctx);
    });
    var elements = [root].concat(Array.prototype.slice.call(root.querySelectorAll ? root.querySelectorAll('*') : []));
    elements.forEach(function (el) {
      if (!el.attributes) return;
      Array.prototype.slice.call(el.attributes).forEach(function (attr) {
        if (attr.value.indexOf('{{') >= 0) el.setAttribute(attr.name, fill(attr.value, ctx));
      });
    });
  }

  function allProducts() {
    var list = [];
    data.secciones.forEach(function (s) { list = list.concat(s.productos); });
    return list;
  }

  var LISTS = {
    secciones: function () { return data.secciones; },
    productos: function (ctx) { return ctx.seccion ? ctx.seccion.productos : allProducts(); }
  };
  var ITEM = { secciones: 'seccion', productos: 'producto' };

  function outermostRepeats(root) {
    return Array.prototype.slice.call(root.querySelectorAll('[data-gb-repetir]')).filter(function (el) {
      for (var p = el.parentElement; p && p !== root; p = p.parentElement) {
        if (p.hasAttribute('data-gb-repetir')) return false;
      }
      return true;
    });
  }

  function renderRepeats(root, ctx) {
    outermostRepeats(root).forEach(function (block) {
      var kind = block.getAttribute('data-gb-repetir');
      var list = LISTS[kind] ? LISTS[kind](ctx) : [];
      var anchor = document.createComment('gb-' + kind);
      block.parentNode.replaceChild(anchor, block);
      block.removeAttribute('data-gb-repetir');
      list.forEach(function (item, index) {
        var itemCtx = Object.assign({}, ctx);
        itemCtx[ITEM[kind]] = item;
        itemCtx.indice = index + 1;
        var clone = block.cloneNode(true);
        renderRepeats(clone, itemCtx);
        substitute(clone, itemCtx);
        if (kind === 'productos') clone.setAttribute('data-gb-producto-id', item.id);
        anchor.parentNode.insertBefore(clone, anchor);
      });
    });
  }

  function render() {
    if (!pristine) {
      pristine = document.body.cloneNode(true);
    } else {
      // The products changed (something ran out): start again from the template.
      var fresh = pristine.cloneNode(true);
      while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
      while (fresh.firstChild) document.body.appendChild(fresh.firstChild);
    }
    var ctx = { combo: data.combo };
    renderRepeats(document.body, ctx);
    substitute(document.body, ctx);
    document.documentElement.classList.toggle('gb-solo-consulta', Boolean(data.soloConsulta));
    paint();
  }

  function paint() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-gb-producto-id]'), function (el) {
      var count = state.counts[el.getAttribute('data-gb-producto-id')] || 0;
      el.classList.toggle('gb-elegido', count > 0);
      Array.prototype.forEach.call(el.querySelectorAll('[data-gb-cantidad]'), function (c) { c.textContent = String(count); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-gb-total]'), function (el) { el.textContent = state.total; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-gb-cantidad-total]'), function (el) { el.textContent = String(state.cantidad); });
    sendHeight();
  }

  function sendHeight() {
    post({ type: 'height', height: Math.ceil(document.documentElement.scrollHeight) });
  }

  window.addEventListener('message', function (event) {
    if (event.source !== parentWindow) return;
    var message = event.data;
    if (!message || message.source !== 'gb-parent') return;
    if (message.type === 'data') {
      data = message.data;
      var ids = allProducts().map(function (p) { return p.id; }).join(',');
      if (!pristine || ids !== shownIds) {
        shownIds = ids;
        render();
      }
    } else if (message.type === 'state') {
      state = message.state;
      paint();
    } else if (message.type === 'options') {
      showOptions(message.options);
    }
  });

  // ---- Choosing a product's options, inside its own card (styled by the template) ----

  function closeOptions() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-gb-panel]'), function (panel) {
      panel.parentNode.removeChild(panel);
    });
    sendHeight();
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function showOptions(options) {
    closeOptions();
    var card = document.querySelector('[data-gb-producto-id="' + options.productId.replace(/"/g, '') + '"]');
    if (!card) return;
    var picked = {};
    var none = {};
    var panel = el('div', 'gb-opciones');
    panel.setAttribute('data-gb-panel', '');
    panel.appendChild(el('div', 'gb-opciones-titulo', 'Personaliza: ' + options.nombre));

    var buttons = [];
    var add = el('button', 'gb-opciones-agregar', 'Agregar al combo');
    add.type = 'button';

    function count(group) {
      return group.opciones.filter(function (o) { return picked[o.id]; }).length;
    }
    function ready() {
      return options.grupos.every(function (g) { return count(g) > 0 || (!g.obligatorio && none[g.id]); });
    }
    function refresh() {
      buttons.forEach(function (b) {
        var group = b.group;
        var active = b.optionId ? Boolean(picked[b.optionId]) : Boolean(none[group.id]);
        b.node.classList.toggle('gb-activa', active);
        b.node.disabled = Boolean(b.optionId) && !active && group.max > 1 && count(group) >= group.max;
      });
      add.disabled = !ready();
    }

    options.grupos.forEach(function (group) {
      var box = el('div', 'gb-grupo');
      box.appendChild(el('div', 'gb-grupo-titulo',
        group.nombre + ' · máx. ' + group.max + (group.obligatorio ? ' · obligatorio' : '')));
      var list = el('div', 'gb-grupo-opciones');
      if (!group.obligatorio) {
        var noneButton = el('button', 'gb-opcion gb-opcion-sin', group.sin);
        noneButton.type = 'button';
        noneButton.addEventListener('click', function () {
          group.opciones.forEach(function (o) { delete picked[o.id]; });
          none[group.id] = !none[group.id];
          refresh();
        });
        buttons.push({ node: noneButton, group: group, optionId: null });
        list.appendChild(noneButton);
      }
      group.opciones.forEach(function (option) {
        var button = el('button', 'gb-opcion', option.nombre);
        button.type = 'button';
        button.addEventListener('click', function () {
          delete none[group.id];
          if (picked[option.id]) {
            delete picked[option.id];
          } else if (count(group) < group.max) {
            picked[option.id] = true;
          } else if (group.max === 1) {
            group.opciones.forEach(function (o) { delete picked[o.id]; });
            picked[option.id] = true;
          }
          refresh();
        });
        buttons.push({ node: button, group: group, optionId: option.id });
        list.appendChild(button);
      });
      box.appendChild(list);
      panel.appendChild(box);
    });

    var actions = el('div', 'gb-opciones-acciones');
    var cancel = el('button', 'gb-opciones-cancelar', 'Cancelar');
    cancel.type = 'button';
    cancel.addEventListener('click', closeOptions);
    add.addEventListener('click', function () {
      if (!ready()) return;
      post({
        type: 'choose',
        productId: options.productId,
        optionItemIds: Object.keys(picked),
        noneGroupIds: Object.keys(none).filter(function (id) { return none[id]; })
      });
      closeOptions();
    });
    actions.appendChild(cancel);
    actions.appendChild(add);
    panel.appendChild(actions);
    // Its clicks are its own: never an "agregar" of the card it sits in.
    panel.addEventListener('click', function (event) { event.stopPropagation(); });
    card.appendChild(panel);
    refresh();
    sendHeight();
  }

  // A plain look the template can restyle: :where() weighs nothing against its CSS.
  var look = document.createElement('style');
  look.textContent = [
    ':where(.gb-opciones){margin-top:12px;padding:12px;border-radius:14px;background:rgba(127,127,127,.12);text-align:left;font:inherit;color:inherit}',
    ':where(.gb-opciones-titulo){font-weight:700;margin-bottom:8px}',
    ':where(.gb-grupo){margin-bottom:10px}',
    ':where(.gb-grupo-titulo){font-size:.85em;opacity:.8;margin-bottom:6px}',
    ':where(.gb-grupo-opciones){display:flex;flex-wrap:wrap;gap:6px}',
    ':where(.gb-opcion){border:1px solid currentColor;background:transparent;color:inherit;border-radius:999px;padding:6px 12px;font:inherit;cursor:pointer}',
    ':where(.gb-opcion.gb-activa){color:inherit;outline:2px solid currentColor;background:rgba(127,127,127,.35)}',
    ':where(.gb-opcion:disabled){opacity:.4;cursor:default}',
    ':where(.gb-opcion-sin){font-style:italic}',
    ':where(.gb-opciones-acciones){display:flex;gap:8px;justify-content:flex-end;margin-top:8px}',
    ':where(.gb-opciones-acciones button){border:0;border-radius:999px;padding:8px 14px;font:inherit;font-weight:700;cursor:pointer}',
    ':where(.gb-opciones-agregar:disabled){opacity:.5;cursor:default}'
  ].join('');
  document.head.insertBefore(look, document.head.firstChild);

  document.addEventListener('click', function (event) {
    var target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    var add = target.closest('[data-gb-agregar]');
    var remove = target.closest('[data-gb-quitar]');
    var control = add || remove;
    if (!control) return;
    var product = control.closest('[data-gb-producto-id]');
    if (!product) return;
    event.preventDefault();
    post({ type: add ? 'pick' : 'remove', productId: product.getAttribute('data-gb-producto-id') });
  });

  if (window.ResizeObserver) new ResizeObserver(sendHeight).observe(document.documentElement);
  window.addEventListener('load', sendHeight);
  post({ type: 'ready' });
})();
`;

/**
 * Inside the frame nothing may reach the network but images, styles and
 * fonts (by URL): no fetch, no forms, no changing the base.
 */
const CSP =
  "default-src 'none'; img-src * data: blob:; style-src 'unsafe-inline' *; font-src * data:; " +
  "script-src 'unsafe-inline'; connect-src 'none'; form-action 'none'; base-uri 'none'";

const HEAD = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width, initial-scale=1">`;

/** The template as the iframe's document: our head first, the runtime last. */
export function buildComboTemplateDocument(template: string): string {
  const runtime = `<script>${RUNTIME}</script>`;
  const headMatch = /<head[^>]*>/i.exec(template);
  if (headMatch) {
    const withHead =
      template.slice(0, headMatch.index + headMatch[0].length) +
      HEAD +
      template.slice(headMatch.index + headMatch[0].length);
    const bodyEnd = withHead.search(/<\/body>/i);
    return bodyEnd >= 0
      ? withHead.slice(0, bodyEnd) + runtime + withHead.slice(bodyEnd)
      : withHead + runtime;
  }
  return `<!doctype html><html><head>${HEAD}</head><body>${template}${runtime}</body></html>`;
}

/** What the template gets: names in Spanish, for whoever writes it. */
export interface ComboTemplateData {
  combo: { nombre: string; frase: string; minimo: number };
  secciones: {
    nombre: string;
    productos: {
      id: string;
      nombre: string;
      descripcion: string;
      precio: string;
      valor: number;
      imagen: string;
    }[];
  }[];
  soloConsulta: boolean;
}

/** A product's options to choose inside the template, in its card. */
export interface ComboTemplateOptions {
  productId: string;
  nombre: string;
  grupos: {
    id: string;
    nombre: string;
    max: number;
    obligatorio: boolean;
    /** "Sin salsas": the choice of none, for a group that isn't required. */
    sin: string;
    opciones: { id: string; nombre: string }[];
  }[];
}

export interface ComboTemplateState {
  /** Units picked per product id. */
  counts: Record<string, number>;
  /** The combo's total, formatted. */
  total: string;
  cantidad: number;
}
