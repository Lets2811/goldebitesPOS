// Fills an EMPTY Golden Bites POS database (staging) with two fictional demo
// businesses through the public API — the same paths a user would take, so
// every business rule applies:
//
//   - "Golden Bites Demo": a burger restaurant with two branches (reuses the
//     empty "Golden Bites" business the seed creates, which the car-service
//     kiosk is configured for).
//   - "La Terraza Bar": a bar with a single branch (created through the
//     platform admin), to show option groups for drinks.
//
// Each gets users per role, catalog with option groups, inventory and recipes,
// customers and loyalty, suppliers and purchases, finances, HR, checklists,
// equipment, waste, marketing, NFC tables, and DAYS days of operation (cash
// sessions, orders, payments). Past days are created "now" and then moved back
// in time by the SQL this script writes (--sql-out), to run right after it.
//
// Usage (Node 18+):
//   node deploy/staging/demo-data.mjs --api https://staging.goldenbites.net/api/v1 \
//     --superadmin-email superadmin@goldenbitespos.local --superadmin-password ... \
//     --restaurant-email admin@goldenbites.local --restaurant-password ... \
//     --creds-out demo-credentials.txt --sql-out demo-backdate.sql
//
// Fictional data only — names, documents and phones are made up.

import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
);
for (const key of ['api', 'superadmin-email', 'superadmin-password', 'restaurant-email', 'restaurant-password', 'creds-out', 'sql-out']) {
  if (!args[key]) throw new Error(`Missing --${key}`);
}
const API = args.api.replace(/\/+$/, '');
const DAYS = Number(args.days ?? 7);
const TIMEZONE = 'America/Bogota';

// ------------------------------------------------------------------ helpers
let seed = 20261017;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (min, max) => Math.floor(min + rand() * (max - min + 1));
const password = () => `Demo-${randomBytes(9).toString('base64url').replace(/[-_]/g, 'x')}`;
const localDate = (daysAgo = 0) =>
  new Date(Date.now() - daysAgo * 86400000).toLocaleDateString('en-CA', { timeZone: TIMEZONE });
const log = (...parts) => console.log(...parts);

async function api(token, method, path, body) {
  let response;
  // The API allows 600 requests a minute per IP: on 429, wait as told and retry.
  for (let attempt = 0; ; attempt++) {
    response = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status !== 429 || attempt >= 20) break;
    const waitSeconds = Number(response.headers.get('retry-after')) || 10;
    if (attempt === 0) log(`  (límite de peticiones de la API: esperando ${waitSeconds}s)`);
    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
  }
  if (response.status === 204) return null;
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const details = json?.details?.validationErrors ? ` ${JSON.stringify(json.details.validationErrors)}` : '';
    throw new Error(`${method} ${path} -> ${response.status} ${json?.code ?? ''} ${json?.message ?? ''}${details}`);
  }
  return json?.data ?? json;
}
const list = async (token, path) => {
  const result = await api(token, 'GET', path);
  return Array.isArray(result) ? result : result?.data ?? result;
};
async function login(email, pass) {
  const result = await api(null, 'POST', '/auth/login', { email, password: pass });
  return result.accessToken;
}
/** Steps that only add flavor: report a failure and keep going. */
const problems = [];
async function optional(label, work) {
  try {
    return await work();
  } catch (error) {
    problems.push(`${label}: ${error.message}`);
    log(`  ! ${label}: ${error.message}`);
    return undefined;
  }
}

const credentials = [];
const windows = []; // { daysAgo, start, end } — what to move back in time

// ------------------------------------------------------------------ businesses
const RESTAURANT = {
  key: 'restaurant',
  name: 'Golden Bites Demo',
  legalName: 'Golden Bites Demo S.A.S.',
  taxId: '900123456-7',
  email: 'contacto@goldenbites.demo',
  phone: '6014567890',
  domain: 'goldenbites.demo',
  branches: [
    { name: 'Sede Norte', address: 'Calle 140 # 11-20', city: 'Bogotá', phone: '6017001122', tableCount: 12 },
    { name: 'Sede Centro', address: 'Carrera 7 # 22-15', city: 'Bogotá', phone: '6017003344', tableCount: 8 },
  ],
  tableNames: { 0: { 1: 'Terraza 1', 2: 'Terraza 2', 12: 'Barra' }, 1: { 1: 'Ventana', 8: 'Familiar' } },
  inventoryCategories: ['Carnes', 'Panadería', 'Vegetales', 'Lácteos', 'Salsas y aderezos', 'Bebidas', 'Empaques'],
  inventory: [
    ['Carne de res 150 g', 'Carnes', 'unidad', 4200, 40],
    ['Pechuga de pollo', 'Carnes', 'kg', 21000, 5],
    ['Salchicha americana', 'Carnes', 'unidad', 1800, 30],
    ['Tocineta', 'Carnes', 'kg', 38000, 2],
    ['Pan de hamburguesa', 'Panadería', 'unidad', 900, 50],
    ['Pan de perro', 'Panadería', 'unidad', 700, 40],
    ['Papa precocida', 'Vegetales', 'kg', 7800, 10],
    ['Lechuga', 'Vegetales', 'kg', 6000, 2],
    ['Tomate', 'Vegetales', 'kg', 5200, 3],
    ['Cebolla', 'Vegetales', 'kg', 3800, 3],
    ['Queso cheddar (tajada)', 'Lácteos', 'unidad', 650, 60],
    ['Salsa BBQ', 'Salsas y aderezos', 'l', 18000, 2],
    ['Salsa de ajo', 'Salsas y aderezos', 'l', 16000, 2],
    ['Gaseosa 400 ml', 'Bebidas', 'unidad', 2100, 48],
    ['Agua 600 ml', 'Bebidas', 'unidad', 1300, 24],
    ['Limón', 'Vegetales', 'kg', 4500, 2],
    ['Caja para hamburguesa', 'Empaques', 'unidad', 450, 100],
    ['Servilletas (paquete)', 'Empaques', 'unidad', 3500, 20],
  ],
  lowStockItem: 'Servilletas (paquete)',
  optionGroups: [
    { name: 'Término de la carne', singularName: 'Término', isRequired: true, defaultMax: 1, items: ['Medio', 'Tres cuartos', 'Bien asado'] },
    { name: 'Salsas', singularName: 'Salsa', defaultMax: 2, items: ['BBQ', 'Miel mostaza', 'Ajo', 'Picante', 'De la casa'] },
    { name: 'Acompañantes', singularName: 'Acompañante', defaultMax: 1, items: ['Papas a la francesa', 'Papas en casco', 'Aros de cebolla', 'Ensalada'] },
  ],
  categories: ['Hamburguesas', 'Perros calientes', 'Pollo', 'Acompañamientos', 'Bebidas', 'Postres'],
  products: [
    // name, category, price, description, availability, { group: max }, recipe [[item, qty]]
    ['Hamburguesa clásica', 'Hamburguesas', 22000, 'Carne 150 g, queso cheddar, lechuga, tomate y cebolla.', 'BOTH', { 'Término de la carne': 1, Salsas: 2, Acompañantes: 1 }, [['Carne de res 150 g', 1], ['Pan de hamburguesa', 1], ['Queso cheddar (tajada)', 1], ['Lechuga', 0.02], ['Tomate', 0.03], ['Caja para hamburguesa', 1]]],
    ['Hamburguesa doble tocineta', 'Hamburguesas', 31000, 'Doble carne, doble cheddar y tocineta crocante.', 'MENU', { 'Término de la carne': 1, Salsas: 2, Acompañantes: 1 }, [['Carne de res 150 g', 2], ['Pan de hamburguesa', 1], ['Queso cheddar (tajada)', 2], ['Tocineta', 0.04], ['Caja para hamburguesa', 1]]],
    ['Hamburguesa BBQ', 'Hamburguesas', 26000, 'Carne, cebolla caramelizada, cheddar y salsa BBQ.', 'BOTH', { 'Término de la carne': 1, Salsas: 1, Acompañantes: 1 }, [['Carne de res 150 g', 1], ['Pan de hamburguesa', 1], ['Queso cheddar (tajada)', 1], ['Cebolla', 0.04], ['Salsa BBQ', 0.03], ['Caja para hamburguesa', 1]]],
    ['Hamburguesa de pollo', 'Hamburguesas', 23000, 'Pechuga apanada, lechuga y salsa de ajo.', 'BOTH', { Salsas: 2, Acompañantes: 1 }, [['Pechuga de pollo', 0.15], ['Pan de hamburguesa', 1], ['Lechuga', 0.02], ['Salsa de ajo', 0.02], ['Caja para hamburguesa', 1]]],
    ['Perro clásico', 'Perros calientes', 15000, 'Salchicha americana, papita triturada y salsas.', 'BOTH', { Salsas: 3 }, [['Salchicha americana', 1], ['Pan de perro', 1]]],
    ['Perro especial', 'Perros calientes', 19000, 'Con tocineta, queso gratinado y cebolla crispy.', 'MENU', { Salsas: 3 }, [['Salchicha americana', 1], ['Pan de perro', 1], ['Tocineta', 0.03], ['Queso cheddar (tajada)', 1]]],
    ['Tenders x4', 'Pollo', 21000, 'Tiras de pollo apanadas.', 'BOTH', { Salsas: 2, Acompañantes: 1 }, [['Pechuga de pollo', 0.2]]],
    ['Alitas BBQ x8', 'Pollo', 27000, 'Bañadas en salsa BBQ de la casa.', 'MENU', { Acompañantes: 1 }, [['Pechuga de pollo', 0.35], ['Salsa BBQ', 0.05]]],
    ['Papas a la francesa', 'Acompañamientos', 8000, 'Porción grande.', 'BOTH', { Salsas: 2 }, [['Papa precocida', 0.25]]],
    ['Aros de cebolla', 'Acompañamientos', 9000, 'Porción de 10 aros.', 'BOTH', { Salsas: 2 }, [['Cebolla', 0.15]]],
    ['Gaseosa 400 ml', 'Bebidas', 5000, null, 'BOTH', {}, [['Gaseosa 400 ml', 1]]],
    ['Limonada natural', 'Bebidas', 7000, 'Hecha al momento.', 'BOTH', {}, [['Limón', 0.08]]],
    ['Agua', 'Bebidas', 4000, null, 'BOTH', {}, [['Agua 600 ml', 1]]],
    ['Brownie con helado', 'Postres', 12000, 'Brownie tibio con helado de vainilla.', 'MENU', {}, []],
  ],
  suppliers: [
    ['Carnes del Llano S.A.S.', '900555111-2', 'Jorge Ruiz', 15],
    ['Panadería La Espiga', '800222333-1', 'Marta Gómez', 0],
    ['Fruver El Campo', '901777888-3', 'Luis Pardo', 8],
    ['Distribuidora Bebidas Andinas', '830444555-6', 'Sandra López', 30],
  ],
  employees: [
    ['Camila', 'Rojas', 'Cajera', 'CASHIER', 0, 'MONTH', 1600000],
    ['Andrés', 'Pérez', 'Cocinero', 'KITCHEN', 0, 'MONTH', 1800000],
    ['Valentina', 'Torres', 'Mesera', 'EMPLOYEE', 0, 'SHIFT', 75000],
    ['Santiago', 'Mejía', 'Cajero', 'CASHIER', 1, 'MONTH', 1600000],
    ['Laura', 'Castro', 'Cocinera', 'KITCHEN', 1, 'MONTH', 1800000],
    ['Diego', 'Morales', 'Domiciliario', 'EMPLOYEE', 1, 'SHIFT', 60000],
    ['Paula', 'Ramírez', 'Administradora', 'MANAGER', 0, 'MONTH', 2800000],
  ],
  equipment: [['Freidora industrial', 0], ['Plancha a gas', 0], ['Nevera vertical', 1]],
  orderMix: { DINE_IN: 4, TAKEAWAY: 3, DELIVERY: 2, CAR_SERVICE: 1 },
  ordersPerDay: [9, 14],
  openingCash: 200000,
};

const BAR = {
  key: 'bar',
  name: 'La Terraza Bar',
  legalName: 'La Terraza Bar S.A.S.',
  taxId: '901987654-3',
  email: 'hola@laterraza.demo',
  phone: '6043210987',
  domain: 'laterraza.demo',
  owner: { firstName: 'Ricardo', lastName: 'Salazar' },
  branches: [{ name: 'Sede Principal', address: 'Calle 10 # 40-25, El Poblado', city: 'Medellín', phone: '6043210987', tableCount: 15 }],
  tableNames: { 0: { 1: 'Barra 1', 2: 'Barra 2', 14: 'VIP', 15: 'Terraza' } },
  inventoryCategories: ['Cervezas', 'Licores', 'Mezcladores', 'Frutas', 'Snacks'],
  inventory: [
    ['Cerveza Club Colombia 330 ml', 'Cervezas', 'unidad', 2900, 48],
    ['Cerveza Águila 330 ml', 'Cervezas', 'unidad', 2400, 48],
    ['Cerveza Corona 355 ml', 'Cervezas', 'unidad', 4300, 24],
    ['Ron Medellín 750 ml', 'Licores', 'ml', 70, 2000],
    ['Aguardiente Antioqueño 750 ml', 'Licores', 'ml', 55, 2000],
    ['Ginebra 750 ml', 'Licores', 'ml', 120, 1500],
    ['Whisky 750 ml', 'Licores', 'ml', 160, 1500],
    ['Tequila 750 ml', 'Licores', 'ml', 130, 1500],
    ['Agua tónica', 'Mezcladores', 'unidad', 2300, 24],
    ['Soda', 'Mezcladores', 'unidad', 1500, 24],
    ['Coca-Cola 350 ml', 'Mezcladores', 'unidad', 1900, 24],
    ['Limón', 'Frutas', 'kg', 4500, 2],
    ['Hierbabuena', 'Frutas', 'kg', 9000, 1],
    ['Chorizo', 'Snacks', 'unidad', 2500, 20],
    ['Papa criolla', 'Snacks', 'kg', 6500, 3],
    ['Pitillos (paquete)', 'Snacks', 'unidad', 4000, 10],
  ],
  lowStockItem: 'Pitillos (paquete)',
  optionGroups: [
    { name: 'Hielo', singularName: 'Hielo', isRequired: true, defaultMax: 1, items: ['Con hielo', 'Poco hielo', 'Sin hielo'] },
    { name: 'Mezcladores', singularName: 'Mezclador', defaultMax: 1, items: ['Soda', 'Tónica', 'Ginger ale', 'Coca-Cola', 'Jugo de naranja'] },
    { name: 'Preparación', singularName: 'Preparación', defaultMax: 2, items: ['Sal', 'Limón', 'Michelada', 'Escarchado'] },
  ],
  categories: ['Cervezas', 'Cócteles', 'Licores por trago', 'Sin alcohol', 'Picadas'],
  products: [
    ['Club Colombia', 'Cervezas', 8000, 'Dorada, roja o negra.', 'BOTH', { Preparación: 2 }, [['Cerveza Club Colombia 330 ml', 1]]],
    ['Águila', 'Cervezas', 6500, null, 'BOTH', { Preparación: 2 }, [['Cerveza Águila 330 ml', 1]]],
    ['Corona', 'Cervezas', 11000, 'Con limón.', 'BOTH', { Preparación: 1 }, [['Cerveza Corona 355 ml', 1]]],
    ['Michelada de la casa', 'Cervezas', 12000, 'Cerveza, limón, sal y salsas.', 'MENU', {}, [['Cerveza Águila 330 ml', 1], ['Limón', 0.05]]],
    ['Mojito', 'Cócteles', 24000, 'Ron, hierbabuena, limón y soda.', 'MENU', { Hielo: 1 }, [['Ron Medellín 750 ml', 60], ['Hierbabuena', 0.01], ['Limón', 0.04], ['Soda', 1]]],
    ['Gin tonic', 'Cócteles', 28000, 'Ginebra y agua tónica.', 'MENU', { Hielo: 1 }, [['Ginebra 750 ml', 60], ['Agua tónica', 1]]],
    ['Cuba libre', 'Cócteles', 22000, 'Ron, Coca-Cola y limón.', 'MENU', { Hielo: 1 }, [['Ron Medellín 750 ml', 60], ['Coca-Cola 350 ml', 1]]],
    ['Margarita', 'Cócteles', 26000, 'Tequila, triple sec y limón.', 'MENU', { Hielo: 1, Preparación: 1 }, [['Tequila 750 ml', 60], ['Limón', 0.05]]],
    ['Aguardiente (trago)', 'Licores por trago', 7000, null, 'BOTH', { Hielo: 1 }, [['Aguardiente Antioqueño 750 ml', 30]]],
    ['Ron Medellín (trago)', 'Licores por trago', 9000, null, 'BOTH', { Hielo: 1, Mezcladores: 1 }, [['Ron Medellín 750 ml', 30]]],
    ['Whisky (trago)', 'Licores por trago', 16000, null, 'BOTH', { Hielo: 1, Mezcladores: 1 }, [['Whisky 750 ml', 30]]],
    ['Gaseosa', 'Sin alcohol', 5000, null, 'BOTH', { Hielo: 1 }, [['Coca-Cola 350 ml', 1]]],
    ['Limonada de coco', 'Sin alcohol', 12000, null, 'MENU', {}, [['Limón', 0.06]]],
    ['Picada para 2', 'Picadas', 38000, 'Chorizo, papa criolla, arepa y guacamole.', 'BOTH', {}, [['Chorizo', 2], ['Papa criolla', 0.3]]],
    ['Papas criollas', 'Picadas', 14000, null, 'BOTH', {}, [['Papa criolla', 0.25]]],
  ],
  suppliers: [
    ['Bavaria Distribución', '860005224-6', 'Kevin Restrepo', 30],
    ['Licorera de Antioquia', '890900286-0', 'Natalia Uribe', 15],
    ['Fruver Laureles', '901333222-1', 'Mario Arango', 0],
  ],
  employees: [
    ['Juliana', 'Ospina', 'Cajera', 'CASHIER', 0, 'MONTH', 1600000],
    ['Mateo', 'Henao', 'Bartender', 'EMPLOYEE', 0, 'SHIFT', 90000],
    ['Sara', 'Giraldo', 'Mesera', 'EMPLOYEE', 0, 'SHIFT', 70000],
    ['Felipe', 'Zapata', 'Cocinero', 'KITCHEN', 0, 'MONTH', 1700000],
    ['Daniela', 'Vélez', 'Administradora', 'MANAGER', 0, 'MONTH', 2600000],
  ],
  equipment: [['Nevera de cervezas', 0], ['Máquina de hielo', 0]],
  orderMix: { DINE_IN: 8, TAKEAWAY: 1 },
  ordersPerDay: [10, 16],
  openingCash: 300000,
};

const FIRST_NAMES = ['Ana', 'Carlos', 'María', 'Juan', 'Lucía', 'Pedro', 'Sofía', 'Miguel', 'Isabel', 'Tomás', 'Daniela', 'Sebastián'];
const LAST_NAMES = ['García', 'Martínez', 'López', 'Hernández', 'Gómez', 'Díaz', 'Moreno', 'Jiménez', 'Ruiz', 'Vargas'];

// ------------------------------------------------------------------ setup of one business
async function setupBusiness(def, token, businessId) {
  log(`\n== ${def.name}`);
  const ctx = { def, token, businessId, branches: [], users: {}, employees: [], products: [], groups: [], items: {}, customers: [], suppliers: [] };

  await api(token, 'PATCH', '/businesses/me', { name: def.name, legalName: def.legalName, taxId: def.taxId, email: def.email, phone: def.phone });
  await api(token, 'PATCH', '/settings', { taxRate: 0.08 });

  // Branches: the first exists already; the rest are added through the platform admin.
  const existing = await list(token, '/branches');
  const [first, ...rest] = def.branches;
  // Name and contact details go through the platform admin; the table count is the business's own.
  const details = ({ tableCount, ...rest }) => rest;
  await api(state.superToken, 'PATCH', `/platform-admin/businesses/${businessId}/branches/${existing[0].id}`, details(first));
  ctx.branches.push({ ...first, id: existing[0].id });
  for (const branch of rest) {
    const created = await api(state.superToken, 'POST', `/platform-admin/businesses/${businessId}/branches`, details(branch));
    ctx.branches.push({ ...branch, id: created.id });
  }
  for (const branch of ctx.branches) {
    await api(token, 'PATCH', `/branches/${branch.id}`, { tableCount: branch.tableCount });
  }
  log(`  sedes: ${ctx.branches.map((b) => b.name).join(', ')}`);

  for (const [index, names] of Object.entries(def.tableNames)) {
    for (const [tableNumber, name] of Object.entries(names)) {
      await api(token, 'PUT', '/table-names', { branchId: ctx.branches[index].id, tableNumber: String(tableNumber), name });
    }
  }

  // Users per role, to log in with during demos.
  const roles = await list(token, '/roles');
  const roleId = (name) => roles.find((role) => role.name === name).id;
  ctx.roleId = roleId;
  const staff = [['Gerente', 'MANAGER', 0], ...ctx.branches.flatMap((_, i) => [[`Caja ${i + 1}`, 'CASHIER', i], [`Cocina ${i + 1}`, 'KITCHEN', i]])];
  for (const [label, role, branchIndex] of staff) {
    const email = `${label.toLowerCase().replace(/\s+/g, '')}@${def.domain}`;
    const pass = password();
    await api(token, 'POST', '/users', { firstName: label, lastName: def.name, email, password: pass, roleId: roleId(role), branchId: ctx.branches[branchIndex].id });
    credentials.push([def.name, `${role === 'MANAGER' ? 'Gerente' : role === 'CASHIER' ? 'Cajero' : 'Cocina'} (${ctx.branches[branchIndex].name})`, email, pass]);
  }

  // Inventory: categories, items, opening stock in every branch.
  const inventoryCategory = {};
  for (const [i, name] of def.inventoryCategories.entries()) {
    inventoryCategory[name] = (await api(token, 'POST', '/inventory-item-categories', { name, displayOrder: i })).id;
  }
  for (const [name, category, unit, cost, minimum] of def.inventory) {
    const item = await api(token, 'POST', '/inventory-items', { name, categoryId: inventoryCategory[category], unit, currentCost: cost, minimumStock: minimum });
    ctx.items[name] = item.id;
    for (const branch of ctx.branches) {
      // Generous stock so DAYS of sales never run out; one item outside every recipe stays low to show the alert.
      const quantity = name === def.lowStockItem ? Math.ceil(minimum * 0.5) : minimum * 12;
      await api(token, 'POST', '/inventory/adjustments', { branchId: branch.id, inventoryItemId: item.id, direction: 'IN', quantity, reason: 'Inventario inicial' });
    }
  }
  log(`  insumos: ${def.inventory.length}`);

  // Option groups.
  for (const groupDef of def.optionGroups) {
    const group = await api(token, 'POST', '/option-groups', { name: groupDef.name, singularName: groupDef.singularName, isRequired: groupDef.isRequired ?? false, defaultMax: groupDef.defaultMax });
    for (const name of groupDef.items) await api(token, 'POST', `/option-groups/${group.id}/items`, { name });
    ctx.groups.push(group);
  }
  ctx.groups = await list(token, '/option-groups');

  // Catalog.
  const categoryId = {};
  for (const [i, name] of def.categories.entries()) {
    categoryId[name] = (await api(token, 'POST', '/product-categories', { name, displayOrder: i })).id;
  }
  for (const [name, category, price, description, availability, offers, recipe] of def.products) {
    const optionGroups = Object.entries(offers).map(([groupName, maxChoices]) => ({
      groupId: ctx.groups.find((g) => g.name === groupName).id,
      maxChoices,
    }));
    const product = await api(token, 'POST', '/products', {
      name, categoryId: categoryId[category], salePrice: price, description: description ?? undefined,
      trackInventory: recipe.length > 0, menuAvailability: availability, optionGroups,
    });
    if (recipe.length > 0) {
      await api(token, 'POST', `/products/${product.id}/recipe`, {
        items: recipe.map(([item, quantity]) => ({ inventoryItemId: ctx.items[item], quantity })),
      });
    }
    ctx.products.push({ ...product, optionGroups });
  }
  log(`  productos: ${ctx.products.length}, grupos: ${ctx.groups.map((g) => g.name).join(', ')}`);

  // Suppliers.
  for (const [name, taxId, contactName, creditDays] of def.suppliers) {
    ctx.suppliers.push(await api(token, 'POST', '/suppliers', { name, taxId, contactName, phone: `3${between(100000000, 199999999)}`, email: `${contactName.split(' ')[0].toLowerCase()}@proveedor.demo`, creditDays }));
  }

  // Customers + loyalty.
  for (let i = 0; i < 12; i++) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = pick(LAST_NAMES);
    ctx.customers.push(await api(token, 'POST', '/customers', {
      firstName, lastName, phone: `3${between(100000000, 299999999)}`,
      email: `${firstName}.${lastName}${i}@cliente.demo`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
      birthDate: `19${between(75, 99)}-${String(between(1, 12)).padStart(2, '0')}-${String(between(1, 28)).padStart(2, '0')}`,
    }));
  }
  await optional('loyalty config', () => api(token, 'PATCH', '/loyalty/config', { pointsPerThousand: 1, birthdayBonusEnabled: true, birthdayBonusPoints: 50 }));
  ctx.rewards = [];
  for (const [name, pointsCost] of def.key === 'bar' ? [['Cerveza gratis', 80], ['Cóctel 2x1', 200]] : [['Papas gratis', 60], ['Hamburguesa clásica gratis', 250]]) {
    const reward = await optional(`reward ${name}`, () => api(token, 'POST', '/loyalty-rewards', { name, pointsCost }));
    if (reward) ctx.rewards.push(reward);
  }

  // Employees with weekly schedules (one rest day each).
  for (const [firstName, lastName, position, role, branchIndex, payFrequency, payRate] of def.employees) {
    const employee = await api(token, 'POST', '/employees', {
      firstName, lastName, position, roleId: roleId(role), branchId: ctx.branches[branchIndex].id,
      documentType: 'CC', documentNumber: String(between(1000000000, 1099999999)), phone: `3${between(100000000, 299999999)}`,
      hireDate: `2025-${String(between(1, 12)).padStart(2, '0')}-01`, payFrequency, payRate, createAccess: false,
    });
    const restDay = between(0, 6);
    const shifts = [0, 1, 2, 3, 4, 5, 6].filter((day) => day !== restDay).map((dayOfWeek) => ({
      dayOfWeek, startTime: def.key === 'bar' ? '17:00' : '11:00', endTime: def.key === 'bar' ? '23:59' : '20:00',
      branchId: ctx.branches[branchIndex].id,
    }));
    await api(token, 'PUT', `/employees/${employee.id}/shifts`, { shifts });
    ctx.employees.push(employee);
  }
  log(`  empleados: ${ctx.employees.length}`);

  // HR: tasks and leave requests.
  for (const [title, priority, status] of [['Hacer inventario de bodega', 'HIGH', 'TODO'], ['Limpiar campana extractora', 'MEDIUM', 'IN_PROGRESS'], ['Actualizar carta de bebidas', 'LOW', 'DONE']]) {
    await optional('hr task', () => api(token, 'POST', '/hr/tasks', { title, priority, status, assigneeEmployeeId: pick(ctx.employees).id, branchId: ctx.branches[0].id, dueDate: localDate(-between(1, 6)) }));
  }
  // Registered by the admin, so they're approved already (an employee's own request would wait for review).
  await optional('leave request', () => api(token, 'POST', '/hr/leave-requests', { employeeId: ctx.employees[0].id, type: 'PERMISSION', startDate: localDate(-5), endDate: localDate(-5), reason: 'Cita médica' }));
  await optional('leave request', () => api(token, 'POST', '/hr/leave-requests', { employeeId: ctx.employees[1].id, type: 'VACATION', startDate: localDate(-20), endDate: localDate(-26), reason: 'Vacaciones' }));

  // NFC tables: a menu QR/NFC on a few tables of each branch, self-service on some.
  for (const branch of ctx.branches) {
    for (const tableNumber of [1, 2, 3]) {
      const tag = await optional('nfc tag', () => api(token, 'POST', '/nfc-tags', { branchId: branch.id, tableNumber: String(tableNumber), name: `Mesa ${tableNumber} — ${branch.name}` }));
      if (tag && tableNumber !== 3) await optional('nfc self-service', () => api(token, 'PATCH', `/nfc-tags/${tag.id}/self-service`, { enabled: true }));
    }
  }

  // Checklists, equipment, marketing.
  await optional('checklist', () => api(token, 'POST', '/checklist-templates', { type: 'OPENING', name: 'Apertura', items: [{ label: 'Encender equipos' }, { label: 'Revisar caja base' }, { label: 'Limpiar mesas' }, { label: 'Revisar inventario crítico' }] }));
  await optional('checklist', () => api(token, 'POST', '/checklist-templates', { type: 'CLOSING', name: 'Cierre', items: [{ label: 'Cuadrar caja' }, { label: 'Apagar equipos' }, { label: 'Sacar basura' }] }));
  for (const [name, branchIndex] of def.equipment) {
    const equipment = await optional('equipment', () => api(token, 'POST', '/equipment', { name, branchId: ctx.branches[branchIndex].id, serialNumber: `SN-${between(10000, 99999)}`, purchaseDate: '2024-03-15', technicalSupplier: 'Servitécnica Ltda.', nextMaintenanceAt: localDate(-between(5, 40)) }));
    if (equipment) await optional('intervention', () => api(token, 'POST', `/equipment/${equipment.id}/interventions`, { date: localDate(30), description: 'Mantenimiento preventivo', cost: between(8, 20) * 10000 }));
  }
  await optional('coupon', () => api(token, 'POST', '/marketing-coupons', { code: def.key === 'bar' ? 'TERRAZA10' : 'BITES10', discountLabel: '10% de descuento', maxUsage: 100 }));
  await optional('campaign', () => api(token, 'POST', '/marketing-campaigns', { name: def.key === 'bar' ? 'Jueves de cócteles 2x1' : 'Combo del mes', channel: 'INSTAGRAM', budget: 300000, startDate: localDate(10), endDate: localDate(-20) }));

  // Funds: savings and bank account start with money.
  await optional('reserve fund', () => api(token, 'POST', '/funds/reserve/initialize', { branchId: ctx.branches[0].id, amount: 1500000, notes: 'Saldo inicial' }));
  await optional('bank fund', () => api(token, 'POST', '/funds/bank-account/initialize', { amount: 15000000, notes: 'Saldo inicial' }));

  return ctx;
}

// ------------------------------------------------------------------ one day of operation in one branch
function orderItems(ctx) {
  const count = between(1, 3);
  const items = [];
  for (let i = 0; i < count; i++) {
    const product = pick(ctx.products);
    const optionItemIds = [];
    for (const offered of product.optionGroups) {
      const group = ctx.groups.find((g) => g.id === offered.groupId);
      const active = group.items.filter((item) => item.isActive);
      if (!group.isRequired && rand() < 0.35) continue;
      const howMany = Math.min(offered.maxChoices, active.length, between(1, offered.maxChoices));
      const shuffled = [...active].sort(() => rand() - 0.5);
      optionItemIds.push(...shuffled.slice(0, howMany).map((item) => item.id));
    }
    items.push({ productId: product.id, quantity: optionItemIds.length === 0 && rand() < 0.3 ? 2 : 1, optionItemIds });
  }
  return items;
}

const STATUS_PATH = ['CONFIRMED', 'PREPARING', 'READY', 'DELIVERED'];
const PAYMENTS = ['CASH', 'CASH', 'CASH', 'CARD', 'TRANSFER', 'NEQUI', 'DAVIPLATA'];

async function operateDay(ctx, branch, daysAgo) {
  const { token, def } = ctx;
  const isToday = daysAgo === 0;
  const session = await api(token, 'POST', '/cash-sessions', { branchId: branch.id, openingAmount: def.openingCash, notes: isToday ? 'Turno de hoy' : undefined });
  // Server time, not this machine's: the SQL compares it with the database's own timestamps.
  const start = session.openedAt;
  if (!start) throw new Error('Cash session response without openedAt');
  const mix = Object.entries(def.orderMix).flatMap(([type, weight]) => Array(weight).fill(type));
  const count = isToday ? between(5, 7) : between(...def.ordersPerDay);
  let ordersMade = 0;
  for (let i = 0; i < count; i++) {
    const orderType = pick(mix);
    const customer = rand() < 0.45 ? pick(ctx.customers) : null;
    const body = {
      branchId: branch.id, orderType, items: orderItems(ctx),
      customerId: customer?.id, customerName: customer ? undefined : rand() < 0.3 ? pick(FIRST_NAMES) : undefined,
    };
    if (orderType === 'DINE_IN') body.tableNumber = String(between(1, branch.tableCount));
    if (orderType === 'DELIVERY') { body.deliveryAddress = `Calle ${between(20, 160)} # ${between(5, 90)}-${between(10, 99)}`; body.deliveryFee = 5000; }
    if (orderType === 'CAR_SERVICE') body.tableNumber = `ABC${between(100, 999)}`;
    if (rand() < 0.08) body.discountAmount = 3000;
    const order = await api(token, 'POST', '/orders', body);
    ordersMade++;

    // Today leaves some orders in progress, for the kitchen and orders boards.
    const lastStep = isToday && i >= count - 4 ? between(-1, 2) : 3;
    if (!isToday && rand() < 0.05) {
      await api(token, 'PATCH', `/orders/${order.id}/status`, { status: 'CANCELLED', notes: 'El cliente cambió de opinión' });
      continue;
    }
    for (let step = 0; step <= lastStep; step++) {
      await api(token, 'PATCH', `/orders/${order.id}/status`, { status: STATUS_PATH[step] });
    }
    if (lastStep === 3) {
      const fresh = await api(token, 'GET', `/orders/${order.id}`);
      await api(token, 'POST', `/orders/${order.id}/payments`, { paymentMethod: pick(PAYMENTS), amount: fresh.totalAmount });
    }
  }

  // A cash expense and an income now and then.
  if (rand() < 0.5) {
    await optional('cash expense', () => api(token, 'POST', '/expenses', {
      category: 'OPERATING', name: pick(['Hielo', 'Gas', 'Servilletas', 'Domicilio de mercado']), description: 'Gasto menor del turno',
      responsible: 'Caja', amount: between(2, 6) * 5000, expenseDate: localDate(daysAgo), branchId: branch.id,
      paymentSource: 'CASH_OPERATIONAL', cashSessionId: session.id,
    }));
  }

  let end = null;
  if (!isToday) {
    const current = await api(token, 'GET', `/cash-sessions/${session.id}`);
    const expected = Number(current.expectedClosingAmount ?? current.summary?.expectedCash ?? 0);
    const closed = await api(token, 'POST', `/cash-sessions/${session.id}/close`, {
      actualClosingAmount: expected > 0 ? expected - (rand() < 0.2 ? between(1, 5) * 1000 : 0) : def.openingCash,
      actualTransferAmount: Number(current.expectedTransferAmount ?? 0) || undefined,
      notes: 'Cierre de turno',
    });
    end = closed.closedAt;
    if (!end) throw new Error('Cash session response without closedAt');
  }
  return { start, end, orders: ordersMade };
}

// ------------------------------------------------------------------ purchases and fixed expenses (dated, no shifting needed)
async function finances(ctx) {
  const { token, branches, suppliers } = ctx;
  const purchases = [
    [suppliers[0], 'Pedido semanal', 850000, 'SUPPLIER_CREDIT', 10, 300000],
    [suppliers[1], 'Compra de contado', 180000, 'BANK_ACCOUNT', 4],
    [suppliers[suppliers.length - 1], 'Compra a crédito', 420000, 'SUPPLIER_CREDIT', 3],
    [suppliers[0], 'Reposición', 260000, 'CASH_RESERVE', 1],
  ];
  for (const [supplier, name, amount, source, daysAgo, initial] of purchases) {
    await optional(`purchase ${name}`, () => api(token, 'POST', '/expenses', {
      category: 'COGS', name: `${name} — ${supplier.name}`, description: 'Compra de insumos', responsible: 'Administración',
      amount, expenseDate: localDate(daysAgo), branchId: branches[0].id, paymentSource: source, supplierId: supplier.id,
      ...(source === 'SUPPLIER_CREDIT'
        ? { dueDate: localDate(daysAgo - (supplier.creditDays || 15)), ...(initial ? { initialPayment: { amount: initial, source: 'BANK_ACCOUNT', paymentDate: localDate(daysAgo) } } : {}) }
        : {}),
    }));
  }
  for (const [category, name, amount, daysAgo] of [['OPERATING', 'Arriendo del local', 3500000, 6], ['OPERATING', 'Servicios públicos', 620000, 5], ['PAYROLL', 'Nómina quincena', 4200000, 2], ['MARKETING', 'Publicidad en redes', 250000, 4]]) {
    await optional(`expense ${name}`, () => api(token, 'POST', '/expenses', {
      category, name, description: name, responsible: 'Administración', amount, expenseDate: localDate(daysAgo),
      branchId: branches[0].id, paymentSource: 'BANK_ACCOUNT',
    }));
  }
  await optional('other income', () => api(token, 'POST', '/other-incomes', {
    incomeType: 'PARTNER_CONTRIBUTION', description: 'Aporte de socio', receivedFrom: 'Socio', amount: 2000000,
    incomeDate: localDate(5), destination: 'BANK_ACCOUNT', branchId: branches[0].id,
  }));
  await optional('other income', () => api(token, 'POST', '/other-incomes', {
    incomeType: 'SUPPLIER_REFUND', description: 'Devolución por producto en mal estado', receivedFrom: suppliers[0].name, amount: 45000,
    incomeDate: localDate(2), destination: 'CASH_RESERVE', branchId: branches[0].id,
  }));
  // Waste.
  const itemIds = Object.values(ctx.items);
  for (let i = 0; i < 3; i++) {
    await optional('waste', () => api(token, 'POST', '/waste', { branchId: branches[0].id, inventoryItemId: pick(itemIds), quantity: 1, reason: pick(['Vencido', 'Se cayó', 'Mal estado']) }));
  }
}

// ------------------------------------------------------------------ main
const state = {};
state.superToken = await login(args['superadmin-email'], args['superadmin-password']);
credentials.push(['Plataforma', 'Superadministrador del POS', args['superadmin-email'], args['superadmin-password']]);

// Restaurant: the seed's empty "Golden Bites" business.
const restaurantToken = await login(args['restaurant-email'], args['restaurant-password']);
const restaurantMe = await api(restaurantToken, 'GET', '/businesses/me');
if ((await list(restaurantToken, '/products')).length > 0) throw new Error('The restaurant already has products: this script only fills an empty database.');
credentials.push([RESTAURANT.name, 'Dueño (administrador)', args['restaurant-email'], args['restaurant-password']]);
const restaurant = await setupBusiness(RESTAURANT, restaurantToken, restaurantMe.id);

// Bar: a new business through the platform admin.
const barOwnerEmail = `dueno@${BAR.domain}`;
const barOwnerPassword = password();
const bar = await api(state.superToken, 'POST', '/platform-admin/businesses', {
  name: BAR.name, currency: 'COP', timezone: TIMEZONE, ownerFirstName: BAR.owner.firstName, ownerLastName: BAR.owner.lastName,
  ownerEmail: barOwnerEmail, ownerPassword: barOwnerPassword,
});
credentials.push([BAR.name, 'Dueño (administrador)', barOwnerEmail, barOwnerPassword]);
const barToken = await login(barOwnerEmail, barOwnerPassword);
const barCtx = await setupBusiness(BAR, barToken, bar.id);

// Days of operation, oldest first; past days are moved back by the SQL below.
// A past day's window runs from its first cash session opening to its last
// closing (server times): everything that day made is inside, nothing else.
for (let daysAgo = DAYS; daysAgo >= 0; daysAgo--) {
  let orders = 0;
  const spans = [];
  for (const ctx of [restaurant, barCtx]) {
    for (const branch of ctx.branches) {
      const day = await operateDay(ctx, branch, daysAgo);
      orders += day.orders;
      spans.push(day);
    }
  }
  if (daysAgo > 0) {
    const start = spans.map((span) => span.start).sort()[0];
    const end = spans.map((span) => span.end).sort().at(-1);
    windows.push({ daysAgo, start, end });
  }
  log(`  día -${daysAgo}: ${orders} pedidos`);
}
for (const ctx of [restaurant, barCtx]) await finances(ctx);

// A loyalty redemption once customers have points.
for (const ctx of [restaurant, barCtx]) {
  const customers = await list(ctx.token, '/customers?limit=100');
  const rich = customers.sort((a, b) => (b.loyaltyPoints ?? 0) - (a.loyaltyPoints ?? 0))[0];
  const reward = ctx.rewards.sort((a, b) => a.pointsCost - b.pointsCost)[0];
  if (rich && reward && (rich.loyaltyPoints ?? 0) >= reward.pointsCost) {
    await optional('redemption', () => api(ctx.token, 'POST', '/loyalty/redemptions', { customerId: rich.id, rewardId: reward.id }));
  }
}

// ------------------------------------------------------------------ outputs
writeFileSync(args['creds-out'], [
  'Golden Bites POS — staging (https://staging.goldenbites.net)',
  'Datos ficticios de demostración.',
  '',
  ...credentials.map(([business, role, email, pass]) => `${business.padEnd(20)} ${role.padEnd(34)} ${email.padEnd(36)} ${pass}`),
  '',
].join('\n'));

// Each past day ran within [start, end] "now"; this moves every timestamp in
// that window back by its days, keeping the local time of day but spreading
// the orders across business hours, then renumbers orders by their new date.
const sql = [
  '-- Generated by deploy/staging/demo-data.mjs. Run once, right after it.',
  'BEGIN;',
  `CREATE TEMP TABLE demo_windows (days_ago int, w_start timestamptz, w_end timestamptz) ON COMMIT DROP;`,
  `INSERT INTO demo_windows VALUES ${windows.map((w) => `(${w.daysAgo}, '${w.start}', '${w.end}')`).join(', ')};`,
  `DO $$
DECLARE col record; w record;
BEGIN
  FOR w IN SELECT * FROM demo_windows LOOP
    FOR col IN
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type = 'timestamp with time zone'
        AND table_name NOT IN ('schema_migrations')
    LOOP
      EXECUTE format('UPDATE %I SET %I = %I - make_interval(days => $1) WHERE %I BETWEEN $2 AND $3',
        col.table_name, col.column_name, col.column_name, col.column_name)
      USING w.days_ago, w.w_start, w.w_end;
    END LOOP;
  END LOOP;
END $$;`,
  // Business hours: the restaurant 11:00-21:30, the bar 17:00-23:30 (sessions half an hour around them).
  `CREATE TEMP TABLE demo_hours (business_id uuid PRIMARY KEY, first_order time, span interval, opens time, closes time) ON COMMIT DROP;`,
  `INSERT INTO demo_hours VALUES ('${restaurantMe.id}', '11:00', '10 hours 30 minutes', '10:30', '22:00'), ('${bar.id}', '17:00', '6 hours 30 minutes', '16:30', '23:55');`,
  // Spread each past day's orders over its business hours, moving their items, history and payments along.
  `CREATE TEMP TABLE demo_spread ON COMMIT DROP AS
SELECT o.id,
       ((o.created_at AT TIME ZONE '${TIMEZONE}')::date + h.first_order
         + (row_number() OVER (PARTITION BY o.branch_id, (o.created_at AT TIME ZONE '${TIMEZONE}')::date ORDER BY o.created_at) - 1)
           * (h.span / GREATEST(count(*) OVER (PARTITION BY o.branch_id, (o.created_at AT TIME ZONE '${TIMEZONE}')::date), 1))
       ) AT TIME ZONE '${TIMEZONE}' - o.created_at AS delta
FROM orders o JOIN demo_hours h ON h.business_id = o.business_id
WHERE (o.created_at AT TIME ZONE '${TIMEZONE}')::date < (now() AT TIME ZONE '${TIMEZONE}')::date;`,
  `UPDATE orders o SET created_at = o.created_at + s.delta, updated_at = o.updated_at + s.delta,
   confirmed_at = o.confirmed_at + s.delta, prepared_at = o.prepared_at + s.delta,
   delivered_at = o.delivered_at + s.delta, cancelled_at = o.cancelled_at + s.delta
 FROM demo_spread s WHERE s.id = o.id;`,
  `UPDATE order_items i SET created_at = i.created_at + s.delta FROM demo_spread s WHERE s.id = i.order_id;`,
  `UPDATE order_status_history h SET created_at = h.created_at + s.delta FROM demo_spread s WHERE s.id = h.order_id;`,
  `UPDATE payments p SET created_at = p.created_at + s.delta, paid_at = p.paid_at + s.delta FROM demo_spread s WHERE s.id = p.order_id;`,
  // Past cash sessions: opened before the first order and closed after the last, in local time.
  `UPDATE cash_sessions s SET
   opened_at = ((s.opened_at AT TIME ZONE '${TIMEZONE}')::date + h.opens) AT TIME ZONE '${TIMEZONE}',
   closed_at = ((s.opened_at AT TIME ZONE '${TIMEZONE}')::date + h.closes) AT TIME ZONE '${TIMEZONE}'
 FROM branches b JOIN demo_hours h ON h.business_id = b.business_id
 WHERE b.id = s.branch_id AND s.closed_at IS NOT NULL
   AND (s.opened_at AT TIME ZONE '${TIMEZONE}')::date < (now() AT TIME ZONE '${TIMEZONE}')::date;`,
  // Cash and stock movements follow what they belong to: a sale its payment, opening/closing their session, stock its order.
  `UPDATE cash_movements m SET created_at = p.paid_at FROM payments p WHERE m.payment_id = p.id AND p.order_id IN (SELECT id FROM demo_spread);`,
  `UPDATE cash_movements m SET created_at = CASE m.movement_type
     WHEN 'OPENING' THEN s.opened_at
     WHEN 'CLOSING' THEN s.closed_at
     ELSE s.opened_at + interval '5 hours' END
 FROM cash_sessions s
 WHERE m.cash_session_id = s.id AND m.payment_id IS NULL AND s.closed_at IS NOT NULL
   AND (s.opened_at AT TIME ZONE '${TIMEZONE}')::date < (now() AT TIME ZONE '${TIMEZONE}')::date;`,
  `UPDATE inventory_movements i SET created_at = i.created_at + s.delta FROM demo_spread s WHERE i.reference_type = 'order' AND i.reference_id = s.id;`,
  // Order numbers carry the date (MMDD-NN): renumber by the new dates, then rebuild the daily counters.
  `UPDATE orders o SET order_number = 'tmp' || t.n FROM (SELECT id, row_number() OVER () AS n FROM orders) t WHERE t.id = o.id;`,
  `UPDATE orders o SET order_number = n.number FROM (
   SELECT id, to_char(day, 'MMDD') || '-' ||
          lpad(rn::text, GREATEST(2, length(rn::text)), '0') AS number
   FROM (SELECT id, (created_at AT TIME ZONE '${TIMEZONE}')::date AS day,
                row_number() OVER (PARTITION BY business_id, (created_at AT TIME ZONE '${TIMEZONE}')::date ORDER BY created_at) AS rn
         FROM orders) numbered) n WHERE n.id = o.id;`,
  `DELETE FROM daily_order_counters;`,
  `INSERT INTO daily_order_counters (business_id, order_date, last_number)
 SELECT business_id, (created_at AT TIME ZONE '${TIMEZONE}')::date, count(*) FROM orders GROUP BY 1, 2;`,
  'COMMIT;',
  '',
].join('\n');
writeFileSync(args['sql-out'], sql);

log(`\nListo. Credenciales: ${args['creds-out']} · SQL para fechar los días pasados: ${args['sql-out']}`);
if (problems.length) log(`\nPasos opcionales con problemas (${problems.length}):\n  - ${problems.join('\n  - ')}`);
