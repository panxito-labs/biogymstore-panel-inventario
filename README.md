# BioGymStore — Sistema de Inventario

Sitio web para la **gestión de inventario de BioGymStore**, desarrollado como
proyecto del curso de Interfaz de Usuario. Resuelve una necesidad real del negocio:
llevar el control de stock de productos (suplementos, pesas, indumentaria) entre
múltiples bodegas, con ingresos, traslados, ventas, usuarios con roles y reportes.

---

### Sitio en línea

🔗 **https://panxito-labs.github.io/biogymstore-panel-inventario/**

---

## Cómo ejecutar

**Opción 1 — Sitio publicado:** entrar al enlace de arriba. No requiere instalación.

**Opción 2 — En local:**

```bash
git clone https://github.com/panxito-labs/biogymstore-panel-inventario.git
cd biogymstore-panel-inventario
python -m http.server 8099
```

Abrir `http://localhost:8099` en el navegador. También sirve la extensión
*Live Server* de VS Code.

> También se puede abrir `index.html` directamente (funciona con la semilla de
> respaldo de `js/data.js`), pero se recomienda un servidor local.

---

## Acceso de demostración

| Rol | Usuario | Contraseña | Permisos |
|-----|---------|------------|----------|
| **Jefe / Administrador** | `demo@biogym.cl` | `demo1234` | Acceso total: traslado, bodegas, gestión de usuarios, Bsale y exportación a Excel |
| **Vendedor** | `vendedor@biogym.cl` | `vendedor1234` | Consulta inventario e historial, ingresa mercadería, crea/edita fichas y ve proveedores |

Para restaurar los datos de prueba: consola del navegador (F12) → `Store.reset()`.

---

## Funcionalidades

- **Login privado** con roles diferenciados (jefe / vendedor); sin sesión no se
  muestra ninguna funcionalidad.
- **Dashboard** — indicadores (total productos, unidades, alertas de stock, bodegas),
  accesos rápidos y movimientos recientes.
- **Inventario** — listado de productos con stock por bodega, búsqueda en vivo y
  filtro por categoría.
- **Ficha de producto** — ventana emergente al hacer clic o `Enter` sobre una fila:
  foto real, SKU, nombre, categoría, estado, precio y descripción, con botón para
  **editar la ficha** (nombre, SKU único, categoría, precio, descripción e imagen).
- **Estadística de ventas** (dentro de la ficha) — indicadores de unidades, ingresos
  y ventas, con gráfico de barras CSS y filtro **semana / mes / año**.
- **Historial de movimientos** — cada ingreso, traslado y venta queda registrado con
  fecha, usuario y detalle (página de Inventario).
- **Ingreso de stock** — formato de grupo (1 o N productos a la vez), creación de
  productos nuevos (SKU único, recuento automático de cajas) e imagen por URL o
  archivo. Al registrarlo se genera y descarga el comprobante en Excel.
- **Traslado de stock** *(solo jefe)* — mueve unidades entre bodegas con validación
  de disponibilidad y gestiona bodegas (agregar/eliminar).
- **Proveedores** — fichas de proveedores y productos "bajo pedido" con cotización
  directa a su sitio web.
- **Integración con Bsale** *(solo jefe)* — simulación de la sincronización
  bidireccional: una venta registrada en Bsale **descuenta el stock** de la
  aplicación y un ingreso en la aplicación **actualiza el stock** en Bsale, con
  registro de sincronización. *(Ver detalle en el ERS más abajo.)*
- **Gestión de usuarios** *(solo jefe)* — crear, editar, desactivar/reactivar cuentas
  y restablecer contraseñas, desde el badge de usuario del navbar. El vendedor solo
  ve su perfil.
- **Reportes en Excel** *(solo jefe)* — estado del inventario, historial de
  movimientos e ingreso de stock, en formato `.xlsx` con bordes, columnas ajustadas
  al texto y fila TOTAL, **sin librerías externas** (`js/excel.js`).

---

## Roles y permisos

| Función | Jefe / Administrador | Vendedor |
|---|---|---|
| Dashboard, inventario, ingreso de stock, proveedores | ✅ | ✅ |
| Historial de movimientos | ✅ | ✅ |
| Crear y editar fichas de producto | ✅ | ✅ |
| Traslado de stock y gestión de bodegas | ✅ | ❌ |
| Integración con Bsale | ✅ | ❌ |
| Gestión de usuarios | ✅ | ❌ (solo ve su perfil) |
| Exportar reportes a Excel | ✅ | ❌ |

La restricción no es solo visual: las operaciones sensibles están validadas también
en `js/store.js`. Por ejemplo, un vendedor que escriba `traslado.html` a mano es
redirigido al dashboard y cualquier traslado intentado por consola es rechazado
por código. Además, no se puede desactivar la propia cuenta y siempre queda al
menos un administrador activo.

---

## Estructura del proyecto

```
index.html            Inicio de sesión
dashboard.html        Panel principal
inventario.html       Productos, ficha, edición e historial de movimientos
ingreso-stock.html    Ingreso en grupo y creación de productos
traslado.html         Traslados y bodegas (solo jefe)
proveedores.html      Proveedores y pedidos
bsale.html            Integración con Bsale — simulación (solo jefe)
css/styles.css        Estilos propios (paleta #0d0d0d / #121212 / #ffe600)
data/seed.json        Datos semilla canónicos (productos, usuarios, bodegas)
js/data.js            Respaldo de datos semilla + carga de seed.json
js/store.js           Estado, sesión, usuarios, roles y persistencia
js/excel.js           Generador de archivos .xlsx sin librerías (ZIP + OOXML)
js/usuarios.js        Ventana de gestión de usuarios (RF-02)
js/icons.js           Set de iconos SVG propios (sin emojis)
js/app.js             Compartido: sesión, navbar, permisos y utilidades
js/pages/*.js         Lógica específica de cada página
img/                  Logo BioGym (PNG oficial)
vendor/               Bootstrap 5.3.3 local (CSS + JS bundle)
```

---

## Cumplimiento del ERS (RF-01 a RF-10)

| RF | Requisito | Estado | Dónde |
|----|-----------|--------|-------|
| RF-01 | Login privado | ✅ | `index.html` — sin sesión no hay panel |
| RF-02 | Gestión de usuarios | ✅ | Badge del navbar → gestión de usuarios (solo jefe) |
| RF-03 | Catálogo de productos | ✅ | Alta en `ingreso-stock.html`, edición de ficha en `inventario.html` |
| RF-04 | Stock por ubicación | ✅ | `inventario.html` y `dashboard.html` — por bodega y total consolidado |
| RF-05 | Ingreso de stock | ✅ | `ingreso-stock.html` — producto, cantidad, destino, fecha y responsable |
| RF-06 | Traslado y bodegas | ✅ | `traslado.html` — traslado + alta/baja de bodegas |
| RF-07 | Proveedores | ✅ | `proveedores.html` — categoría, sitio web y cotizaciones |
| RF-08 | Integración con Bsale | ✅ | `bsale.html` — simulación bidireccional¹ |
| RF-09 | Historial de movimientos | ✅ | `inventario.html` — fecha, usuario y detalle |
| RF-10 | Exportación de reportes | ✅ | Excel: inventario, historial e ingreso (solo jefe) |

¹ El sitio es estático (sin backend), por lo que la integración se **simula**
conservando el flujo completo del requisito: una venta en Bsale descuenta el stock
de la aplicación y un ingreso en la aplicación actualiza el stock en Bsale, dejando
constancia en el registro de sincronización. Una integración real requiere
credenciales de la API de Bsale y un servidor que reciba y procese los webhooks.

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

## Reportes en Excel (sin librerías)

`js/excel.js` genera archivos `.xlsx` reales desde cero: construye el ZIP sin
compresión (cabeceras + CRC32) y el XML del formato Office Open XML, sin ninguna
dependencia externa. Los reportes incluyen bordes en todas las celdas, anchos de
columna calculados del contenido y fila TOTAL en negrita.

---

## Tecnologías

- **HTML5 semántico** — `header`, `nav`, `main`, `section`, `article`, `footer`.
- **CSS3 + Bootstrap 5** — grid, componentes y utilidades; customización con
  variables CSS propias.
- **JavaScript (ES6)** — módulos por IIFE, sin dependencias ni frameworks.
- **Bootstrap local en `vendor/`** — funciona sin conexión a internet.

---

## Accesibilidad

- Todos los campos del formulario tienen `label` asociado.
- Contraste de texto verificado con Lighthouse: **100 % accesibilidad,
  100 % buenas prácticas, 100 % SEO**.
- Iconos SVG propios con `aria-hidden` y botones con `aria-label`.

---

## Seguridad (importante)

El inicio de sesión es una **simulación académica**: en un proyecto 100 % frontend
las credenciales de demostración son visibles a propósito (`js/data.js`). Proteger
un acceso de verdad requiere un backend. Sí se aplican medidas de seguridad
frontend en todas las páginas: **Content-Security-Policy**, **Referrer-Policy**
y **`robots noindex, nofollow`** (el sistema es privado y no
debe aparecer en buscadores).

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
