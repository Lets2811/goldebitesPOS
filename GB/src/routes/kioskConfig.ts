export const KIOSK_PATHS = {
  waiter: '/tablet/mesero',
  kitchen: '/tablet/cocina',
  carService: '/tablet/servicio-carro',
  /** The courier's phone app (Domicilios). */
  courier: '/domiciliario',
} as const;

export const KIOSK_PERMISSIONS: Record<'waiter' | 'kitchen' | 'carService', string[]> = {
  waiter: ['orders.create'],
  kitchen: ['kitchen.update_status'],
  carService: ['orders.create'],
};
