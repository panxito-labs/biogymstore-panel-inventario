# BioGymStore — Sistema de Inventario

Sitio web para la **gestión de inventario de BioGymStore**, desarrollado como
proyecto del curso de desarrollo web. Resuelve una necesidad real del negocio:
llevar el control de stock de productos (suplementos, pesas, indumentaria) entre
múltiples bodegas, con registro de ingresos y traslados.

---

### Sitio en línea

🔗 **https://panxito-labs.github.io/biogymstore-panel-inventario/**

---

### Acceso de demostración

| Campo | Valor |
|-------|-------|
| Usuario | `demo@biogym.cl` |
| Contraseña | `demo1234` |

Para restaurar los datos de prueba: consola del navegador (F12) → `Store.reset()`.

---

## Funcionalidades

- **Dashboard** — indicadores (total productos, unidades, alertas de stock, bodegas),
  accesos rápidos y movimientos recientes.
- **Inventario** — listado de productos con stock por bodega, búsqueda en vivo y
  filtro por categoría.
- **Vista de detalle de producto** — ventana emergente (modal) al hacer clic o
  Enter sobre una fila: foto real del producto, SKU, nombre, categoría, estado,
  precio y descripción.
- **Estadística de ventas** (dentro de la ventana de detalle) — indicadores de
  unidades, ingresos y ventas, con gráfico de barras y filtro por
  **semana / mes / año**.
- **Ingreso de stock** — suma unidades a un producto existente o crea productos
  nuevos (SKU único, recuento automático de cajas) con **imagen por URL o por
  archivo**.
- **Traslado** — mueve stock entre bodegas con validación de disponibilidad;
  gestión de bodegas (agregar/eliminar) e historial de movimientos.
- **Proveedores** — fichas de proveedores y productos "bajo pedido" con cotización
  directa.

---

## Estructura del proyecto

```
index.html            Inicio de sesión
dashboard.html        Panel principal
inventario.html       Listado de productos + ventana de detalle
ingreso-stock.html    Ingreso y creación de productos
traslado.html         Traslados y bodegas
proveedores.html      Proveedores y pedidos
css/styles.css        Estilos propios (paleta #0d0d0d / #121212 / #ffe600)
data/seed.json        Datos semilla canónicos (productos, bodegas, credenciales)
js/data.js            Respaldo de datos semilla + carga de seed.json
js/store.js           Estado, persistencia y motor de estadística de ventas
js/icons.js           Set de iconos SVG propios (sin emojis)
js/app.js             Compartido: sesión, navbar, utilidades
js/pages/*.js         Lógica específica de cada página
img/                  Logo BioGym (PNG oficial)
vendor/               Bootstrap 5.3.3 local (CSS + JS bundle)
```

---

## Ventana de detalle y estadística de ventas

Al hacer clic (o `Enter`) sobre una fila del inventario se abre una ventana con
la ficha del producto:

- **Foto, SKU, nombre, categoría, estado, precio y descripción.** Las imágenes
  son las fotos reales del catálogo de [biogymstore.cl](https://biogymstore.cl/);
  los productos renombrados se ajustaron al nombre y descripción de la tienda.
- **Bloque de ventas** con filtro **Semana / Mes / Año**:
  - indicadores: *Unidades*, *Ingresos* y *Ventas* del periodo,
  - gráfico de barras CSS (sin librerías) con el eje correspondiente:
    días 1..30 en el mes, `L M MI J V S D` en la semana, `E..D` en el año.

### Motor de ventas (`js/store.js`)

No existían datos de ventas, así que se genera una colección demo en `db.sales`:

- **2463 registros** de los últimos 365 días, con patrón realista
  (picos los sábados, baja los domingos) y ventas siempre presentes "hoy".
- Generador **determinista** (`mulberry32`, semilla `20261015`): siempre produce
  la misma serie, anclada a la fecha actual.
- Cada registro: `{ fecha, productoId, unidades, total }`.
- `Store.statsFor(id, periodo)` devuelve totales, casilleros y rótulos del eje;
  la suma de las barras siempre coincide con las unidades del indicador.
- Si en el futuro se agrega un módulo "Registrar Venta", basta con
  `db.sales.push(...)` y la estadística lo lee sin cambios.

### Caché y versiones

Los assets se cargan con `?v=` (cache-busting) y el pie de página muestra la
etiqueta de versión del build: si cambias algo y no lo ves en línea, un
`Ctrl+F5` descarta la copia guardada del navegador.

---

## Imágenes de producto

Al crear un producto nuevo (`ingreso-stock.html`) el campo **Imagen** ofrece dos
orígenes, con vista previa en vivo en la miniatura:

| Modo | Cómo funciona |
|------|---------------|
| **URL** | Se pega un enlace `https://...` y la vista previa aparece al escribir. |
| **Archivo** | Zona de arrastre: clic para elegir un archivo o **arrastrar y soltar** la imagen (JPG, PNG o WebP). Muestra nombre y dimensiones al cargarla. |

Antes de guardar, la imagen subida pasa por un `<canvas>` que:

- la **redimensiona a 600 px** como máximo (manteniendo proporción),
- la recompresa: **PNG/WebP** conservan transparencia, el resto va a **JPEG**
  calidad 0.82,
- la guarda como *data URL* (`data:image/...`) dentro de `sessionStorage`.

Así una foto pesada no rellena el almacenamiento de la sesión. `productThumb()`
en `js/app.js` reconoce tanto `https://` como `data:image/` y, si no hay imagen,
muestra el icono SVG correspondiente.

---

## Tecnologías

- **HTML5 semántico** — `header`, `nav`, `main`, `section`, `article`, `footer`.
- **CSS3 + Bootstrap 5** — grid, componentes y utilidades; customización con
  variables CSS propias.
- **JavaScript (ES6)** — módulos por IIFE, sin dependencias ni frameworks.
- **Bootstrap local en `vendor/`** — funciona sin conexión a internet.

---

## Seguridad (importante)

El inicio de sesión es una **simulación académica**: en un proyecto 100% frontend
las credenciales de demostración son visibles a propósito (`js/data.js`). Proteger
un acceso de verdad requiere un backend.
Sí se aplican **cabeceras de seguridad** (CSP, `X-Frame-Options`, HSTS, etc.) vía
`vercel.json`, `_headers`, `netlify.toml` y `.htaccess`. 

---

## Especificación de Requisitos de Software (ERS)

| Campo | Valor |
|-------|-------|
| **Equipo** | Aukin Carilao – Francisco Correa |
| **Cliente** | Biogymstore |
| **Curso** | Interfaz de usuario – sección 1 |
| **Fecha** | 15-10-2026 |
| **Versión** | 1.0 |

| Integrante | Rol |
|------------|-----|
| Francisco Correa | Jefe de Proyecto / Diseñador UI UX / webmaster |
| Aukin Carilao | Diseñador UI UX / Desarrollador frontend |
