/**
 * Runs the inventory and product tools against a local POS, as a signed-in
 * user, without the model: each change is made and then undone. For
 * development only:
 *
 *   POS_API_TARGET=local npx tsx src/testing/tools-against-local-pos.ts <email> <password>
 */
import { PosClient } from '../pos/pos-client.js';
import { config } from '../config.js';
import { NO_BRANCHES, type Session } from '../auth.js';
import { consultarInventario } from '../tools/consultar-inventario.js';
import { consultarProductos } from '../tools/consultar-productos.js';
import { ajustarExistencias } from '../tools/ajustar-existencias.js';
import { modificarInsumo } from '../tools/modificar-insumo.js';
import { modificarProducto } from '../tools/modificar-producto.js';

const [email, password] = process.argv.slice(2);
if (config.posApiTarget !== 'local' || !email || !password) {
  console.error('Only against a local POS, with an email and password.');
  process.exit(1);
}

const login = await fetch(`${config.posApiUrl}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
}).then((r) => r.json() as Promise<{ data: { accessToken: string } }>);
const token = login.data.accessToken;
const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as {
  sub: string;
  businessId: string;
  branchId: string | null;
  roleName: string;
  permissions: string[];
};
const session: Session = {
  pos: new PosClient(token),
  userId: claims.sub,
  businessId: claims.businessId,
  firstName: 'Prueba',
  businessName: null,
  roleName: claims.roleName,
  branchId: claims.branchId,
  branches: NO_BRANCHES,
  permissions: claims.permissions,
};
const ctx = { session };

async function change<T>(label: string, tool: typeof ajustarExistencias, args: T) {
  const { message } = await tool.run(args, ctx);
  console.log(`${label}\n   ${message}`);
}

const inventory = (await consultarInventario.execute({ buscar: 'agua', limite: 3 }, ctx)) as {
  insumos: { id: string; nombre: string; existencias: number; unidad: string; minimo: number }[];
};
const water = inventory.insumos[0];
console.log(`insumo de prueba: ${water.nombre} (${water.existencias} ${water.unidad}, mínimo ${water.minimo})\n`);

await change('1. sumar existencias', ajustarExistencias, { insumo_id: water.id, operacion: 'sumar', cantidad: 2, motivo: 'prueba de TURA' });
await change('2. fijar el conteo (vuelve a como estaba)', ajustarExistencias, {
  insumo_id: water.id,
  operacion: 'fijar',
  cantidad: water.existencias,
  motivo: 'prueba de TURA, deshacer',
});
await change('3. cambiar el mínimo', modificarInsumo, { insumo_id: water.id, accion: 'cambiar_minimo', minimo: water.minimo + 1 });
await change('4. volver al mínimo', modificarInsumo, { insumo_id: water.id, accion: 'cambiar_minimo', minimo: water.minimo });

const products = (await consultarProductos.execute({ buscar: 'agua', limite: 3 }, ctx)) as {
  productos: { id: string; nombre: string; precio: number; visible_en_menu: boolean }[];
};
const product = products.productos.find((p) => p.visible_en_menu) ?? products.productos[0];
console.log(`\nproducto de prueba: ${product.nombre} (${product.precio} pesos)\n`);
await change('5. ocultar del menú', modificarProducto, { producto_id: product.id, accion: 'ocultar' });
await change('6. mostrar otra vez', modificarProducto, { producto_id: product.id, accion: 'mostrar' });
await change('7. cambiar el precio', modificarProducto, { producto_id: product.id, accion: 'cambiar_precio', precio: product.precio + 500 });
await change('8. volver al precio', modificarProducto, { producto_id: product.id, accion: 'cambiar_precio', precio: product.precio });
await change('9. desactivar el producto', modificarProducto, { producto_id: product.id, accion: 'desactivar' });
await change('10. activarlo otra vez', modificarProducto, { producto_id: product.id, accion: 'activar' });
await change('11. desactivar el insumo', modificarInsumo, { insumo_id: water.id, accion: 'desactivar' });
await change('12. activarlo otra vez', modificarInsumo, { insumo_id: water.id, accion: 'activar' });

try {
  await ajustarExistencias.run(
    { insumo_id: water.id, operacion: 'restar', cantidad: water.existencias + 1000, motivo: 'prueba' },
    ctx,
  );
} catch (error) {
  console.log(`\n13. restar más de lo que hay -> rechazado: ${(error as Error).message}`);
}

const after = (await consultarInventario.execute({ buscar: water.nombre, limite: 1 }, ctx)) as typeof inventory;
console.log(`\nal final: ${after.insumos[0].nombre} con ${after.insumos[0].existencias} ${after.insumos[0].unidad}, mínimo ${after.insumos[0].minimo}`);
