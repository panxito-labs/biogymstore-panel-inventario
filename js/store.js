const Store = (() => {
  const DB_KEY = "biogym_db_v1";
  const SESSION_KEY = "biogym_session";
  const LOW_STOCK = 3;
  const storage = window.localStorage; // Persistencia: los datos sobreviven al cerrar el navegador

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
      ensureUsers();
      ensureBsale();
      return;
    }
    try {
      db = await loadSeedData();
    } catch (e) {
      db = clone(SEED);
    }
    ensureSales();
    ensureUsers();
    ensureBsale();
    save();
  }

  function init() {
    if (!ready) {
      ready = load().catch(() => { db = clone(SEED); ensureSales(); ensureUsers(); ensureBsale(); });
    }
    return ready;
  }

  function save() {
    try { storage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { /* sin espacio */ }
  }

  init();

  /* ---------- Sesión y usuarios (RF-01 / RF-02) ---------- */

  /* Migración: bases antiguas solo tenían db.user (un único administrador) */
  function ensureUsers() {
    if (!Array.isArray(db.users) || !db.users.length) {
      const legado = db.user || {};
      db.users = [
        { id: 1, email: legado.email || "demo@biogym.cl", password: legado.password || "demo1234",
          nombre: legado.nombre || "Usuario Demo", rol: "admin",
          iniciales: legado.iniciales || "UD", activo: true }
      ];
      save();
    }
  }

  /* Sesión: guarda el id del usuario (los valores antiguos "true" = admin) */
  function login(email, password) {
    ensureUsers();
    if (typeof email !== "string") return false;
    const key = email.trim().toLowerCase();
    const u = db.users.find((x) => x.email.toLowerCase() === key && x.password === password);
    if (!u) return false;
    if (u.activo === false) {
      loginError = "La cuenta está desactivada. Contacta al administrador.";
      return false;
    }
    loginError = "";
    storage.setItem(SESSION_KEY, String(u.id));
    return true;
  }

  let loginError = "";

  function loginMensaje() {
    return loginError || "Usuario o contraseña incorrectos.";
  }

  function logout() {
    storage.removeItem(SESSION_KEY);
  }

  function isLoggedIn() {
    const v = storage.getItem(SESSION_KEY);
    return v === "true" || (v !== null && v !== "" && !isNaN(Number(v)));
  }

  function currentUser() {
    if (!isLoggedIn()) return null;
    ensureUsers();
    const raw = storage.getItem(SESSION_KEY);
    /* Sesión antigua ("true") = administrador */
    if (raw === "true") return db.users.find((u) => u.rol === "admin") || db.users[0];
    const u = db.users.find((x) => String(x.id) === raw);
    if (!u) { logout(); return null; }
    if (u.activo === false) { logout(); return null; }
    return u;
  }

  function isAdmin() {
    const u = currentUser();
    return !!u && u.rol === "admin";
  }

  /* ---- CRUD de usuarios (solo administrador) ---- */

  function getUsers() {
    ensureUsers();
    if (!isAdmin()) return []; /* solo el administrador ve las cuentas */
    /* Nunca exponer la contraseña al listado */
    return db.users.map((u) => ({
      id: u.id, email: u.email, nombre: u.nombre,
      rol: u.rol, iniciales: u.iniciales, activo: u.activo !== false
    }));
  }

  function crearUsuario(data) {
    if (!isAdmin()) return { ok: false, msg: "Solo el administrador puede crear usuarios." };
    ensureUsers();
    const nombre = String(data.nombre || "").trim();
    const email = String(data.email || "").trim().toLowerCase();
    const password = String(data.password || "");
    const rol = data.rol === "vendedor" ? "vendedor" : "admin";
    if (!nombre) return { ok: false, msg: "Ingresa el nombre del usuario." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, msg: "Ingresa un correo válido." };
    if (password.length < 6) return { ok: false, msg: "La contraseña debe tener al menos 6 caracteres." };
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      return { ok: false, msg: `El correo ${email} ya está registrado.` };
    }
    const id = db.users.reduce((m, u) => Math.max(m, Number(u.id) || 0), 0) + 1;
    const iniciales = nombre.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
    db.users.push({ id, email, password, nombre, rol, iniciales, activo: true });
    save();
    return { ok: true, msg: `Usuario "${nombre}" creado correctamente.` };
  }

  function editarUsuario(id, data) {
    if (!isAdmin()) return { ok: false, msg: "Solo el administrador puede editar usuarios." };
    ensureUsers();
    const u = db.users.find((x) => String(x.id) === String(id));
    if (!u) return { ok: false, msg: "Usuario no encontrado." };
    const nombre = String(data.nombre || "").trim();
    const email = String(data.email || "").trim().toLowerCase();
    const rol = data.rol === "vendedor" ? "vendedor" : "admin";
    if (!nombre) return { ok: false, msg: "Ingresa el nombre del usuario." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, msg: "Ingresa un correo válido." };
    if (db.users.some((x) => x.id !== u.id && x.email.toLowerCase() === email)) {
      return { ok: false, msg: `El correo ${email} ya está registrado.` };
    }
    /* No permitir degradar al último administrador activo */
    if (u.rol === "admin" && rol !== "admin" && esUnicoAdminActivo(u.id)) {
      return { ok: false, msg: "Debe existir al menos un administrador activo." };
    }
    u.nombre = nombre;
    u.email = email;
    u.rol = rol;
    u.iniciales = nombre.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
    save();
    return { ok: true, msg: `Usuario "${nombre}" actualizado.` };
  }

  function esUnicoAdminActivo(exceptoId) {
    return !db.users.some((u) => u.id !== exceptoId && u.rol === "admin" && u.activo !== false);
  }

  function restablecerPassword(id, nueva) {
    if (!isAdmin()) return { ok: false, msg: "Solo el administrador puede restablecer contraseñas." };
    ensureUsers();
    const u = db.users.find((x) => String(x.id) === String(id));
    if (!u) return { ok: false, msg: "Usuario no encontrado." };
    nueva = String(nueva || "");
    if (nueva.length < 6) return { ok: false, msg: "La contraseña debe tener al menos 6 caracteres." };
    u.password = nueva;
    save();
    return { ok: true, msg: `Contraseña de "${u.nombre}" restablecida.` };
  }

  function cambiarEstadoUsuario(id, activo) {
    if (!isAdmin()) return { ok: false, msg: "Solo el administrador puede desactivar cuentas." };
    ensureUsers();
    const u = db.users.find((x) => String(x.id) === String(id));
    if (!u) return { ok: false, msg: "Usuario no encontrado." };
    const yo = currentUser();
    if (yo && yo.id === u.id && !activo) {
      return { ok: false, msg: "No puedes desactivar tu propia cuenta." };
    }
    if (!activo && u.rol === "admin" && esUnicoAdminActivo(u.id)) {
      return { ok: false, msg: "Debe existir al menos un administrador activo." };
    }
    u.activo = !!activo;
    save();
    return { ok: true, msg: activo
      ? `Cuenta de "${u.nombre}" reactivada.`
      : `Cuenta de "${u.nombre}" desactivada.` };
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
      syncLog("ingreso", `Ingreso en la aplicación: +${product.stock[data.destino]} u. de ${product.nombre} (${data.destino}) → stock actualizado en Bsale.`);
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
    syncLog("ingreso", `Ingreso en la aplicación: +${cantidad} u. de ${p.nombre} (${destino}) → stock actualizado en Bsale.`);
    save();
    return { ok: true, msg: `Se ingresaron ${cantidad} unidades a ${destino}.` };
  }

  /* ---------- Traslados ---------- */

  function transfer(id, from, to, cantidad) {
    if (!isAdmin()) return { ok: false, msg: "Solo el jefe puede trasladar stock." };
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
    if (!isAdmin()) return { ok: false, msg: "Solo el jefe puede gestionar bodegas." };
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
    if (!isAdmin()) return { ok: false, msg: "Solo el jefe puede gestionar bodegas." };
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
    const autor = currentUser();
    db.movements.unshift({
      id: Date.now() + Math.random(),
      fecha: new Date().toISOString(),
      producto,
      tipo,
      origen,
      destino,
      unidades: Number(unidades),
      usuario: autor ? autor.nombre : "Sistema"
    });
    if (db.movements.length > 50) db.movements.pop();
  }

  function getMovements() {
    return db.movements.slice();
  }

  /* ---------- RF-08: Integración con Bsale (simulación) ---------- */
  /* El sitio es estático (sin backend), así que la integración se simula:
     - Una venta registrada en Bsale descuenta el stock de la aplicación.
     - Un ingreso en la aplicación "actualiza" el stock en Bsale. */

  function ensureBsale() {
    if (!db) return;
    if (!Array.isArray(db.bsales)) db.bsales = [];
    if (!Array.isArray(db.bsaleLog)) db.bsaleLog = [];
  }

  function syncLog(tipo, detalle) {
    ensureBsale();
    db.bsaleLog.unshift({
      id: Date.now() + Math.random(),
      fecha: new Date().toISOString(),
      tipo,
      detalle
    });
    if (db.bsaleLog.length > 50) db.bsaleLog.pop();
  }

  /* Venta registrada en Bsale: descuenta el stock en la aplicación */
  function registrarVentaBsale(id, cantidad, bodega) {
    if (!isAdmin()) return { ok: false, msg: "Solo el jefe puede registrar ventas de Bsale." };
    ensureBsale();
    const p = getProduct(id);
    if (!p) return { ok: false, msg: "Producto no encontrado." };
    cantidad = Number(cantidad);
    if (!(cantidad > 0)) return { ok: false, msg: "La cantidad debe ser mayor a 0." };
    const disponible = p.stock[bodega] || 0;
    if (cantidad > disponible) {
      return { ok: false, msg: `Stock insuficiente en ${bodega} (disponible: ${disponible}).` };
    }
    p.stock[bodega] = disponible - cantidad;
    const idVenta = db.bsales.reduce((m, v) => Math.max(m, Number(v.id) || 0), 0) + 1;
    const venta = {
      id: idVenta,
      fecha: new Date().toISOString(),
      productoId: p.id,
      sku: p.sku,
      producto: p.nombre,
      unidades: cantidad,
      precioUnit: p.precio,
      total: p.precio * cantidad,
      bodega,
      usuario: (currentUser() || {}).nombre || "Sistema"
    };
    db.bsales.unshift(venta);
    addMovement(p.nombre, "venta", bodega, "Bsale (venta)", cantidad);
    syncLog("venta", `Venta #${idVenta} en Bsale: ${cantidad} × ${p.nombre} → stock descontado en la aplicación (${bodega}).`);
    save();
    return {
      ok: true,
      msg: `Venta #${idVenta} registrada en Bsale: ${cantidad} u. de ${p.nombre}. Stock descontado de ${bodega}.`,
      venta
    };
  }

  function getVentasBsale() {
    ensureBsale();
    return db.bsales.slice();
  }

  function getBsaleLog() {
    ensureBsale();
    return db.bsaleLog.slice();
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
    init, login, loginMensaje, logout, isLoggedIn, currentUser, isAdmin,
    getUsers, crearUsuario, editarUsuario, restablecerPassword, cambiarEstadoUsuario,
    getProducts, getProduct, getCategories, totalStock, isBajoPedido, statusOf,
    skuExists, addProduct, updateProduct, addStock,
    transfer,
    getWarehouses, addWarehouse, removeWarehouse,
    getMovements,
    registrarVentaBsale, getVentasBsale, getBsaleLog,
    getSales, statsFor,
    getSuppliers, getBajoPedido,
    reset, LOW_STOCK
  };
})();
