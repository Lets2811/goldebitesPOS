/** A starting point to download and adapt: every marker in use. */
export const COMBO_TEMPLATE_EXAMPLE = `<!doctype html>
<html lang="es">
<head>
  <title>Arma tu combo</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;700;800&display=swap');
    body { margin: 0; font-family: 'Poppins', sans-serif; background: #fff8ec; color: #2b1d0e; }
    .portada { padding: 32px 20px; text-align: center; background: linear-gradient(135deg, #ffb703, #fb8500); color: #fff; border-radius: 0 0 28px 28px; }
    .portada h1 { margin: 0; font-size: 30px; font-weight: 800; }
    .portada p { margin: 6px 0 0; opacity: .9; }
    .seccion { padding: 20px 16px 0; }
    .seccion h2 { font-size: 18px; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 1px; color: #fb8500; }
    .productos { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
    .producto { background: #fff; border-radius: 18px; padding: 12px; box-shadow: 0 4px 14px rgba(0,0,0,.08); border: 2px solid transparent; text-align: center; }
    .producto.gb-elegido { border-color: #fb8500; }
    .producto img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 12px; background: #ffe8c2; }
    .producto img[src=""] { display: none; }
    .nombre { font-weight: 700; margin: 8px 0 2px; }
    .precio { color: #fb8500; font-weight: 800; }
    .acciones { display: flex; gap: 8px; justify-content: center; align-items: center; margin-top: 8px; }
    button { border: 0; border-radius: 999px; padding: 8px 14px; font: inherit; font-weight: 700; cursor: pointer; }
    .agregar { background: #fb8500; color: #fff; }
    .quitar { background: #ffe8c2; color: #2b1d0e; }
    /* Las opciones del producto (salsas, tamaño...) se despliegan dentro de su tarjeta. */
    .gb-opciones { margin-top: 10px; padding: 10px; border-radius: 14px; background: #fff3dc; text-align: left; }
    .gb-opciones-titulo { font-weight: 800; margin-bottom: 6px; }
    .gb-grupo-titulo { font-size: 12px; color: #8a6a3b; margin: 6px 0 4px; }
    .gb-grupo-opciones { display: flex; flex-wrap: wrap; gap: 6px; }
    .gb-opcion { background: #fff; color: #2b1d0e; border: 1px solid #ffb703; padding: 6px 12px; }
    .gb-opcion.gb-activa { background: #fb8500; color: #fff; border-color: #fb8500; }
    .gb-opcion:disabled { opacity: .4; }
    .gb-opciones-acciones { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; }
    .gb-opciones-cancelar { background: transparent; color: #8a6a3b; }
    .gb-opciones-agregar { background: #fb8500; color: #fff; }
    .gb-opciones-agregar:disabled { opacity: .5; }
    /* En el enlace público solo se consulta: sin botones. */
    .gb-solo-consulta .acciones { display: none; }
  </style>
</head>
<body>
  <header class="portada">
    <h1>{{combo.nombre}}</h1>
    <p>{{combo.frase}}</p>
    <p>Mínimo {{combo.minimo}} productos · Llevas <span data-gb-cantidad-total>0</span> · <span data-gb-total></span></p>
  </header>

  <section class="seccion" data-gb-repetir="secciones">
    <h2>{{seccion.nombre}}</h2>
    <div class="productos">
      <article class="producto" data-gb-repetir="productos">
        <img src="{{producto.imagen}}" alt="{{producto.nombre}}">
        <div class="nombre">{{producto.nombre}}</div>
        <div class="precio">{{producto.precio}}</div>
        <div class="acciones">
          <button class="quitar" data-gb-quitar>−</button>
          <span data-gb-cantidad>0</span>
          <button class="agregar" data-gb-agregar>Agregar</button>
        </div>
      </article>
    </div>
  </section>
</body>
</html>
`;

/** What can be used in a template, shown next to the upload. */
export const COMBO_TEMPLATE_GUIDE: { marker: string; meaning: string }[] = [
  {
    marker: '{{combo.nombre}} · {{combo.frase}} · {{combo.minimo}}',
    meaning: 'El nombre, la frase y el mínimo de productos del combo.',
  },
  {
    marker: 'data-gb-repetir="secciones"',
    meaning: 'Se repite una vez por sección. Adentro: {{seccion.nombre}}.',
  },
  {
    marker: 'data-gb-repetir="productos"',
    meaning:
      'Se repite una vez por producto (de la sección, o de todas si va por fuera). Adentro: {{producto.nombre}}, {{producto.descripcion}}, {{producto.precio}}, {{producto.imagen}}.',
  },
  {
    marker: 'data-gb-agregar · data-gb-quitar',
    meaning: 'Dentro de un producto: agregan (con sus opciones) o quitan una unidad del combo.',
  },
  {
    marker: 'data-gb-cantidad',
    meaning:
      'Dentro de un producto: cuántas unidades lleva. El producto elegido recibe la clase gb-elegido.',
  },
  {
    marker: 'data-gb-total · data-gb-cantidad-total',
    meaning: 'El total del combo y cuántos productos lleva.',
  },
  {
    marker:
      '.gb-opciones · .gb-grupo-titulo · .gb-opcion · .gb-activa · .gb-opciones-agregar · .gb-opciones-cancelar',
    meaning:
      'Las opciones de un producto (salsas, tamaño...) se despliegan dentro de su tarjeta al agregarlo; estas clases les dan estilo. Un producto sin opciones se agrega directo, sin preguntar.',
  },
  {
    marker: '.gb-solo-consulta',
    meaning:
      'Clase en <html> cuando no se puede pedir (enlace público): úsala para ocultar botones.',
  },
];
