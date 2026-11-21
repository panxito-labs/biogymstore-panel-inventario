const Store = (() => {
  const DB_KEY = "biogym_db_v1";
  const SESSION_KEY = "biogym_session";
  const LOW_STOCK = 3;
  const storage = window.sessionStorage; // Semana 5: pasar a localStorage

  let db = null;
  let ready = null;

  const clone = (obj) => JSON.parse(JSON.stringify(obj));

  function safeGet(key) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  async function load() {
    const cached = safeGet(DB_KEY);
    if (cached) {
      db = cached;
      ensureSales();
      return;
    }
    try {
      db = await loadSeedData();
    } catch (e) {
      db = clone(SEED);
    }
    ensureSales();
    save();
  }

  function init() {
    if (!ready) {
      ready = load().catch(() => { db = clone(SEED); ensureSales(); });
    }
    return ready;
  }

  function save() {
    try { storage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { /* sin espacio */ }
  }

  init();

  /* ---------- Sesión ---------- */

  function login(email, password) {
    const u = db.user;
    if (
      typeof email === "string" &&
      email.trim().toLowerCase() === u.email.toLowerCase() &&
      password === u.password
    ) {
      storage.setItem(SESSION_KEY, "true");
      return true;
    }
    return false;
  }

  function logout() {
    storage.removeItem(SESSION_KEY);
  }

  function isLoggedIn() {
    return storage.getItem(SESSION_KEY) === "true";
  }

  function currentUser() {
    return db.user;
  }

  /* ---------- Productos ---------- */

  function getProducts() {
    return db.products.slice();
  }

  function getProduct(id) {
    return db.products.find((p) => p.id === Number(id)) || null;
  }

  function getCategories() {
    return db.categories.slice();
  }

  function totalStock(p) {
    return Object.values(p.stock || {}).reduce((a, b) => a + b, 0);
  }

  function isBajoPedido(p) {
    return Boolean(p.bajoPedido);
  }

  // Estado general del producto
  function statusOf(p) {
    if (isBajoPedido(p)) return "pedido";
    const total = totalStock(p);
    if (total === 0) return "agotado";
    if (total <= LOW_STOCK) return "bajo";
    return "ok";
  }

  function skuExists(sku) {
    return db.products.some((p) => p.sku.toUpperCase() === String(sku).trim().toUpperCase());
  }

  function addProduct(data) {
    const id = Date.now();
    const stock = {};
    if (!data.bajoPedido) stock[data.destino] = Number(data.cantidad) || 0;
    const product = {
      id,
      sku: String(data.sku).trim().toUpperCase(),
      nombre: String(data.nombre).trim(),
      categoria: data.categoria,
      precio: Number(data.precio),
      descripcion: String(data.descripcion || "").trim(),
      imagen: String(data.imagen || "").trim(),
      icon: data.icon || "box",
      cajaUnits: Number(data.cajaUnits) || 0,
      stock
    };
    if (data.bajoPedido) product.bajoPedido = data.bajoPedido;
    db.products.push(product);
    if (!data.bajoPedido) {
      addMovement(product.nombre, "ingreso", "Ingreso manual", data.destino, product.stock[data.destino]);
    }
    save();
    return product;
  }

  /* Edita la ficha de un producto (RF-03): nombre, SKU, categoría,
     precio, descripción e imagen. No toca el stock ni genera movimiento. */
  function updateProduct(id, data) {
    const p = getProduct(id);
    if (!p) return { ok: false, msg: "Producto no encontrado." };

    const nombre = String(data.nombre || "").trim();
    if (!nombre) return { ok: false, msg: "El nombre es obligatorio." };

    const sku = String(data.sku || "").trim().toUpperCase();
    if (!sku) return { ok: false, msg: "El SKU es obligatorio." };
    if (db.products.some((x) => x.id !== p.id && x.sku.toUpperCase() === sku)) {
      return { ok: false, msg: `El SKU ${sku} ya está en uso por otro producto.` };
    }

    const precio = Number(data.precio);
    if (!Number.isFinite(precio) || precio < 0) {
      return { ok: false, msg: "Ingrese un precio válido." };
    }

    p.nombre = nombre;
    p.sku = sku;
    if (data.categoria) p.categoria = data.categoria;
    p.precio = Math.round(precio);
    p.descripcion = String(data.descripcion || "").trim();
    if (typeof data.imagen === "string") p.imagen = data.imagen.trim();

    save();
    return { ok: true, product: p };
  }

  function addStock(id, cantidad, destino) {
    const p = getProduct(id);
    if (!p) return { ok: false, msg: "Producto no encontrado." };
    cantidad = Number(cantidad);
    if (!(cantidad > 0)) return { ok: false, msg: "La cantidad debe ser mayor a 0." };
    p.stock[destino] = (p.stock[destino] || 0) + cantidad;
    addMovement(p.nombre, "ingreso", "Ingreso manual", destino, cantidad);
    save();
    return { ok: true, msg: `Se ingresaron ${cantidad} unidades a ${destino}.` };
  }

  /* ---------- Traslados ---------- */

  function transfer(id, from, to, cantidad) {
    const p = getProduct(id);
    if (!p) return { ok: false, msg: "Producto no encontrado." };
    cantidad = Number(cantidad);
    if (from === to) return { ok: false, msg: "El origen y el destino deben ser distintos." };
    if (!(cantidad > 0)) return { ok: false, msg: "La cantidad debe ser mayor a 0." };
    const disponible = p.stock[from] || 0;
    if (cantidad > disponible) {
      return { ok: false, msg: `Stock insuficiente en ${from} (disponible: ${disponible}).` };
    }
    p.stock[from] = disponible - cantidad;
    p.stock[to] = (p.stock[to] || 0) + cantidad;
    addMovement(p.nombre, "traslado", from, to, cantidad);
    save();
    return { ok: true, msg: `Traslado de ${cantidad} u. de ${from} a ${to} realizado.` };
  }

  /* ---------- Bodegas ---------- */

  function getWarehouses() {
    return db.warehouses.slice();
  }

  function addWarehouse(name) {
    name = String(name || "").trim();
    if (!name) return { ok: false, msg: "Ingrese un nombre para la bodega." };
    if (db.warehouses.some((w) => w.toLowerCase() === name.toLowerCase())) {
      return { ok: false, msg: "Ya existe una bodega con ese nombre." };
    }
    db.warehouses.push(name);
    db.products.forEach((p) => {
      if (!p.bajoPedido) p.stock[name] = 0;
    });
    save();
    return { ok: true, msg: `Bodega "${name}" creada correctamente.` };
  }

  function removeWarehouse(name) {
    if (db.warehouses.length <= 1) {
      return { ok: false, msg: "Debe existir al menos una bodega." };
    }
    db.warehouses = db.warehouses.filter((w) => w !== name);
    db.products.forEach((p) => {
      delete p.stock[name];
    });
    save();
    return { ok: true, msg: `Bodega "${name}" eliminada.` };
  }

  /* ---------- Movimientos (historial) ---------- */

  function addMovement(producto, tipo, origen, destino, unidades) {
    db.movements.unshift({
      id: Date.now() + Math.random(),
      fecha: new Date().toISOString(),
      producto,
      tipo,
      origen,
      destino,
      unidades: Number(unidades),
      usuario: db.user.nombre
    });
    if (db.movements.length > 50) db.movements.pop();
  }

  function getMovements() {
    return db.movements.slice();
  }

  /* ---------- Proveedores ---------- */

  function getSuppliers() {
    return db.suppliers.slice();
  }

  function getBajoPedido() {
    return db.products.filter((p) => p.bajoPedido);
  }

  /* ---------- Ventas (historial de demostración) ---------- */

  /* PRNG determinista: genera siempre la misma serie de ventas */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Últimos 365 días. Hoy siempre tiene ventas (para que el filtro
     DÍA nunca quede vacío); el resto sigue un patrón de lunes a viernes
     con picos los sábados y bajada los domingos. */
  function generateDemoSales() {
    const rnd = mulberry32(20261015);
    const items = db.products.filter((p) => !p.bajoPedido);
    const out = [];
    const now = new Date();
    const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const margenHoy = Math.max(now.getTime() - hoy.getTime(), 1);

    for (let d = 364; d >= 0; d--) {
      const dia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - d);
      const dow = dia.getDay();
      const prob = dow === 0 ? 0.2 : dow === 6 ? 0.7 : 0.5;

      items.forEach((p) => {
        /* d === 0 (hoy): siempre; resto: según probabilidad */
        if (d !== 0 && rnd() >= prob) return;
        const n = d === 0 ? 1 + Math.floor(rnd() * 2) : 1 + Math.floor(rnd() * 2);

        for (let i = 0; i < n; i++) {
          const unidades = 1 + Math.floor(rnd() * 3);
          /* Hoy: repartido entre 00:00 y ahora. Otros días: 8:00 - 20:59 */
          const fecha = d === 0
            ? new Date(hoy.getTime() + Math.floor(rnd() * margenHoy))
            : new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(),
                       8 + Math.floor(rnd() * 13), Math.floor(rnd() * 60));
          if (fecha > now) continue;
          out.push({
            id: out.length + 1,
            fecha: fecha.toISOString(),
            productoId: p.id,
            unidades,
            total: p.precio * unidades
          });
        }
      });
    }
    return out.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }

  function ensureSales() {
    if (!db) return;
    if (!Array.isArray(db.sales) || db.sales.length === 0) {
      db.sales = generateDemoSales();
    }
  }

  /* Estadística de un producto en el periodo indicado */
  function statsFor(id, period) {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    let from, buckets, labels;

    if (period === "semana") {
      const dow = (now.getDay() + 6) % 7; /* 0 = lunes */
      from = new Date(y, m, d - dow, 0, 0, 0, 0);
      buckets = new Array(7).fill(0);
      labels = ["L", "M", "MI", "J", "V", "S", "D"];
    } else if (period === "anio") {
      from = new Date(y, 0, 1);
      buckets = new Array(12).fill(0);
      labels = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
    } else {
      /* mes (por defecto) */
      from = new Date(y, m, 1);
      const dias = new Date(y, m + 1, 0).getDate();
      buckets = new Array(dias).fill(0);
      labels = Array.from({ length: dias }, (_, i) => String(i + 1));
    }

    let unidades = 0, ingresos = 0, ventas = 0;
    const pid = Number(id);

    for (const s of db.sales) {
      if (Number(s.productoId) !== pid) continue;
      const f = new Date(s.fecha);
      if (f < from || f > now) continue;
      ventas += 1;
      unidades += s.unidades;
      ingresos += s.total;
      if (period === "semana") buckets[(f.getDay() + 6) % 7] += s.unidades;
      else if (period === "anio") buckets[f.getMonth()] += s.unidades;
      else if (f.getMonth() === m) buckets[f.getDate() - 1] += s.unidades;
    }

    return { unidades, ingresos, ventas, buckets, labels };
  }

  function getSales() {
    return db.sales.slice();
  }

  /* ---------- Utilidades ---------- */

  function reset() {
    storage.removeItem(DB_KEY);
    ready = null;
    init();
  }

  return {
    init, login, logout, isLoggedIn, currentUser,
    getProducts, getProduct, getCategories, totalStock, isBajoPedido, statusOf,
    skuExists, addProduct, updateProduct, addStock,
    transfer,
    getWarehouses, addWarehouse, removeWarehouse,
    getMovements,
    getSales, statsFor,
    getSuppliers, getBajoPedido,
    reset, LOW_STOCK
  };
})();
