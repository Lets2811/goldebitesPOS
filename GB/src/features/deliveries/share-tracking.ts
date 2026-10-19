import type { Delivery } from '../../modules/deliveries/types/delivery.types';

export const TRACKING_PATH = '/seguimiento';

/** The customer's public page for a delivery. */
export function trackingUrl(code: string): string {
  return `${window.location.origin}${TRACKING_PATH}/${code}`;
}

export function trackingMessage(delivery: Pick<Delivery, 'trackingCode' | 'customerName'>, businessName?: string): string {
  const greeting = delivery.customerName ? `Hola ${delivery.customerName.split(' ')[0]}` : 'Hola';
  return (
    `${greeting}, sigue tu domicilio${businessName ? ` de ${businessName}` : ''} aquí: ` +
    `${trackingUrl(delivery.trackingCode)} (código ${delivery.trackingCode}). ` +
    'También puedes escribirle a tu domiciliario desde ese enlace.'
  );
}

/** WhatsApp to the customer's phone (Colombian numbers get +57), with the message ready when there is one. */
export function whatsappUrl(phone: string | null, message?: string): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  const number = digits.length === 10 ? `57${digits}` : digits;
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}
