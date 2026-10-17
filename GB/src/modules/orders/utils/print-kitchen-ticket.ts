import { ORDER_TYPE_LABELS, getOrderIdentifierLabel } from '../order-status';
import { printThermalDocument } from './print-thermal-document';
import { escapeHtml } from './escape-html';
import { formatOptionSelections } from '../../option-groups/utils/option-group-utils';
import type { OrderItem, OrderWithItems } from '../types/order.types';

interface PrintTicketOptions {
  businessName?: string;
  businessLogo?: string | null;
  /** Print only these items instead of the full order — used for "Agregar productos" additions. */
  addedItems?: OrderItem[];
  /** {tableNumber: name} — shows the table's custom name instead of the raw number when set. */
  tableNames?: Record<string, string>;
}

function buildTicketHtml(
  order: OrderWithItems,
  { businessName, businessLogo, addedItems, tableNames }: PrintTicketOptions,
): string {
  const dateLabel = new Date(order.createdAt).toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const isAddition = Boolean(addedItems);

  const itemsHtml = (addedItems ?? order.items)
    .map((item) => {
      const selections = formatOptionSelections(item).join(' · ');
      return `
        <div class="item">
          <div class="item-line"><span class="qty">${item.quantity}×</span> ${escapeHtml(item.productNameSnapshot)}</div>
          ${item.productDescriptionSnapshot ? `<div class="description">${escapeHtml(item.productDescriptionSnapshot)}</div>` : ''}
          ${selections ? `<div class="note">${escapeHtml(selections)}</div>` : ''}
          ${item.notes ? `<div class="note">Nota: ${escapeHtml(item.notes)}</div>` : ''}
        </div>
      `;
    })
    .join('');

  const tableLine = order.tableNumber
    ? `<div class="meta">${escapeHtml(getOrderIdentifierLabel(order, tableNames))}</div>`
    : '';

  const customerLine = order.customerName
    ? `<div class="meta">Cliente: ${escapeHtml(order.customerName)}</div>`
    : '';

  const notesBlock = order.notes
    ? `<div class="order-notes">Nota del pedido: ${escapeHtml(order.notes)}</div>`
    : '';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Comanda #${order.orderNumber}</title>
<style>
  @page { margin: 0; size: 80mm auto; }
  html, body { width: 80mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 3mm 3mm;
    font-family: 'Courier New', monospace;
    color: #000;
  }
  .header { text-align: center; margin-bottom: 3mm; }
  .logo { max-width: 30mm; max-height: 20mm; margin-bottom: 1.5mm; }
  .business { font-size: 15px; font-weight: 700; text-transform: uppercase; }
  .order-number { font-size: 26px; font-weight: 800; margin-top: 1.5mm; }
  .type { font-size: 12px; font-weight: 700; text-transform: uppercase; margin-top: 1mm; }
  .meta { font-size: 12px; margin-top: 1mm; }
  .date { font-size: 10px; color: #333; margin-top: 1mm; }
  hr { border: none; border-top: 1px dashed #000; margin: 2.5mm 0; }
  .item { margin-bottom: 2mm; }
  .item-line { font-size: 14px; font-weight: 700; word-break: break-word; }
  .qty { display: inline-block; min-width: 7mm; }
  .description { font-size: 11px; margin-left: 7mm; color: #333; word-break: break-word; }
  .note { font-size: 11px; font-weight: 700; margin-left: 7mm; word-break: break-word; }
  .order-notes { margin-top: 2.5mm; font-size: 11px; font-weight: 700; border: 1px dashed #000; padding: 1.5mm; word-break: break-word; }
  .addition-badge { font-size: 13px; font-weight: 800; margin-top: 1mm; }
  .footer { margin-top: 3mm; text-align: center; font-size: 9px; }
</style>
</head>
<body>
  <div class="header">
    ${businessLogo ? `<img class="logo" src="${businessLogo}" alt="" />` : ''}
    ${businessName ? `<div class="business">${escapeHtml(businessName)}</div>` : ''}
    <div class="order-number">#${order.orderNumber}</div>
    ${isAddition ? '<div class="addition-badge">★ PRODUCTOS AGREGADOS ★</div>' : ''}
    <div class="type">${ORDER_TYPE_LABELS[order.orderType]}</div>
    ${tableLine}
    ${customerLine}
    <div class="date">${dateLabel}</div>
  </div>
  <hr />
  ${itemsHtml}
  ${notesBlock}
  <div class="footer">${isAddition ? '— Adición a la comanda —' : '— Comanda de cocina —'}</div>
</body>
</html>`;
}

export function printKitchenTicket(order: OrderWithItems, options: PrintTicketOptions = {}): void {
  printThermalDocument(buildTicketHtml(order, options));
}
