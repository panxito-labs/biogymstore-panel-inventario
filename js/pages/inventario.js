/* Página: inventario.html — tabla con búsqueda y filtro por categoría */

document.addEventListener("DOMContentLoaded", async () => {
  if (document.body.dataset.page !== "inventario" || !Store.isLoggedIn()) return;
  await Store.init();

  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");
  const head = document.getElementById("inventoryHead");
  const body = document.getElementById("inventoryBody");
  const empty = document.getElementById("emptyState");
  const count = document.getElementById("resultCount");

  /* ---- Ventana de detalle de producto ---- (con guards: si la caché del
     navegador sirve un HTML viejo, que falte un elemento no debe tumbar
     el buscador ni la tabla) */
  const modalEl = document.getElementById("productModal");
  const filterEl = document.getElementById("pmFilter");
  const kpisEl = document.getElementById("pmKpis");
  const chartEl = document.getElementById("pmChart");
  const axisEl = document.getElementById("pmAxis");
  const noSalesEl = document.getElementById("pmNoSales");
  const statsOk = !!(modalEl && filterEl && kpisEl && chartEl && axisEl && noSalesEl);

  let currentProduct = null;
  let currentPeriod = "mes";

  /* Estadística del producto según el periodo elegido */
  function renderStats() {
    if (!currentProduct || !statsOk || typeof Store.statsFor !== "function") return;
    const s = Store.statsFor(currentProduct.id, currentPeriod);

    kpisEl.innerHTML = `
      <div class="pm-kpi">
        <div class="k-label">Unidades</div>
        <div class="k-value accent">${s.unidades}</div>
      </div>
      <div class="pm-kpi">
        <div class="k-label">Ingresos</div>
        <div class="k-value">${fmtCLP(s.ingresos)}</div>
      </div>
      <div class="pm-kpi">
        <div class="k-label">Ventas</div>
        <div class="k-value">${s.ventas}</div>
      </div>`;

    const max = Math.max.apply(null, s.buckets.concat([1]));
    chartEl.innerHTML = s.buckets
      .map((v) => {
        const h = v > 0 ? Math.max((v / max) * 100, 10) : 4;
        return `<div class="pm-bar${v > 0 ? "" : " empty"}" style="height:${h}%" title="${v} u."></div>`;
      })
      .join("");

    axisEl.innerHTML = s.labels.map((l) => `<span>${l}</span>`).join("");
    noSalesEl.classList.toggle("d-none", s.ventas > 0);
    chartEl.classList.toggle("d-none", s.ventas === 0);
    axisEl.classList.toggle("d-none", s.ventas === 0);
  }

  if (statsOk) {
    filterEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-period]");
      if (!btn) return;
      currentPeriod = btn.dataset.period;
      filterEl.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
      renderStats();
    });
  }

  function showDetail(id) {
    const p = Store.getProduct(id);
    if (!p || !modalEl) return;
    currentProduct = p;
    const set = (el, txt) => { const n = document.getElementById(el); if (n) n.textContent = txt; };
    set("pmSku", p.sku);
    set("pmName", p.nombre);
    set("pmCat", p.categoria);
    set("pmPrice", fmtCLP(p.precio));
    const status = document.getElementById("pmStatus");
    if (status) status.innerHTML = statusBadge(p);
    set("pmDesc", p.descripcion || "Sin descripción disponible.");
    const photo = document.getElementById("pmPhoto");
    if (photo) photo.innerHTML = productThumb(p);
    renderStats();

    if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    } else {
      /* Respaldo sin Bootstrap JS */
      modalEl.classList.add("show");
      modalEl.style.display = "block";
      modalEl.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    }
  }

  function hideDetail() {
    if (!modalEl) return;
    if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
      const inst = bootstrap.Modal.getInstance(modalEl);
      if (inst) inst.hide();
    } else {
      modalEl.classList.remove("show");
      modalEl.style.display = "none";
      modalEl.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    }
  }

  if (modalEl) {
    modalEl.querySelectorAll("[data-bs-dismiss='modal']").forEach((b) =>
      b.addEventListener("click", hideDetail)
    );
    modalEl.addEventListener("click", (e) => {
      if (e.target === modalEl) hideDetail(); /* clic en el fondo cierra */
    });
  }

  /* ---- Edición de producto (RF-03): botón amarillo junto a la X ---- */
  const editModalEl = document.getElementById("editModal");
  const editForm = document.getElementById("editForm");
  const editBtn = document.getElementById("pmEditBtn");
  const editCancel = document.getElementById("editCancel");
  const ep = {
    skuTag: document.getElementById("editSkuTag"),
    name: document.getElementById("epName"),
    sku: document.getElementById("epSku"),
    cat: document.getElementById("epCategory"),
    price: document.getElementById("epPrice"),
    desc: document.getElementById("epDesc"),
    modes: document.getElementById("epModes"),
    panelUrl: document.getElementById("epPanelUrl"),
    panelFile: document.getElementById("epPanelFile"),
    url: document.getElementById("epImage"),
    file: document.getElementById("epImageFile"),
    drop: document.getElementById("epDrop"),
    dropText: document.getElementById("epDropText"),
    preview: document.getElementById("epPreview")
  };
  const editOk = !!(editModalEl && editForm && editBtn && ep.name &&
                    typeof Store.updateProduct === "function");

  let editImgMode = "url";
  let editImgData = "";        /* imagen en modo archivo (data URL) */
  let reopenDetail = false;    /* ¿volver al detalle al cerrar la edición? */
  let pendingDetailId = null;

  function epRenderPreview(src) {
    if (/^(https?:\/\/|data:image\/)/.test(src)) {
      ep.preview.innerHTML = `<img src="${src}" alt="" class="thumb-img">`;
    } else {
      ep.preview.innerHTML = icon("package");
    }
  }

  function epSetMode(mode) {
    editImgMode = mode;
    ep.modes.querySelectorAll("button").forEach((b) =>
      b.classList.toggle("active", b.dataset.mode === mode)
    );
    ep.panelUrl.classList.toggle("d-none", mode !== "url");
    ep.panelFile.classList.toggle("d-none", mode !== "file");
    /* Al ocultar el input de URL se deshabilita para que su validación
       (type=url) no bloquee el envío del formulario en modo archivo */
    ep.url.disabled = mode !== "url";
    epRenderPreview(mode === "file" ? editImgData : ep.url.value.trim());
  }

  /* Redimensiona y comprime a 600 px (la imagen viaja en base64 en
     sessionStorage, hay que mantenerla liviana) */
  function epProcessImage(file) {
    if (!file || !/^image\//.test(file.type)) {
      toast("El archivo debe ser una imagen (JPG, PNG o WebP).", false);
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => toast("No se pudo leer la imagen.", false);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => toast("La imagen no es válida.", false);
      img.onload = () => {
        const MAX = 600;
        const ratio = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const tieneAlfa = file.type === "image/png" || file.type === "image/webp";
        editImgData = canvas.toDataURL(tieneAlfa ? "image/png" : "image/jpeg", 0.82);
        ep.drop.classList.add("has-file");
        ep.dropText.textContent = `${file.name} · ${w}×${h}px`;
        epRenderPreview(editImgData);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function showEditModal() {
    if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(editModalEl).show();
    } else {
      editModalEl.classList.add("show");
      editModalEl.style.display = "block";
      editModalEl.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    }
  }

  /* Bootstrap ignora hide()/show() mientras la ventana está en su fade
     (~300 ms). Si el clic llega dentro de esa ventana, reintenta desde la
     página hasta que la transición termine, para no perder el cambio. */
  function cuandoQuieta(el, accion) {
    const inst = (typeof bootstrap !== "undefined" && bootstrap.Modal && el)
      ? bootstrap.Modal.getInstance(el) : null;
    if (inst && inst._isTransitioning) {
      setTimeout(() => cuandoQuieta(el, accion), 100);
      return;
    }
    accion(inst);
  }

  function hideEdit() {
    if (!editModalEl) return;
    const doReopen = reopenDetail;
    const id = pendingDetailId;
    reopenDetail = false;
    const finish = () => { if (doReopen && id != null) showDetail(id); };

    if (typeof bootstrap === "undefined" || !bootstrap.Modal) {
      editModalEl.classList.remove("show");
      editModalEl.style.display = "none";
      editModalEl.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
      finish();
      return;
    }
    cuandoQuieta(editModalEl, (inst) => {
      if (!editModalEl.classList.contains("show")) { finish(); return; }
      editModalEl.addEventListener("hidden.bs.modal", function h() {
        editModalEl.removeEventListener("hidden.bs.modal", h);
        finish();
      });
      (inst || bootstrap.Modal.getOrCreateInstance(editModalEl)).hide();
    });
  }

  /* Cambia detalle -> edición sin apilar ventanas */
  function openEdit() {
    if (!editOk || !currentProduct) return;
    const p = currentProduct;
    pendingDetailId = p.id;
    reopenDetail = false;

    ep.skuTag.textContent = p.sku;
    ep.name.value = p.nombre;
    ep.sku.value = p.sku;
    ep.cat.value = p.categoria;
    ep.price.value = p.precio;
    ep.desc.value = p.descripcion || "";
    editForm.classList.remove("was-validated");

    editImgData = "";
    ep.file.value = "";
    ep.drop.classList.remove("has-file");
    ep.dropText.textContent = "Haz clic o arrastra una imagen aquí";
    if (/^https?:\/\//.test(p.imagen || "")) {
      ep.url.value = p.imagen;
      epSetMode("url");
    } else if (/^data:image\//.test(p.imagen || "")) {
      editImgData = p.imagen;
      ep.url.value = "";
      ep.drop.classList.add("has-file");
      ep.dropText.textContent = "Imagen actual del producto";
      epSetMode("file");
    } else {
      ep.url.value = "";
      epSetMode("url");
    }

    if (typeof bootstrap === "undefined" || !bootstrap.Modal || !modalEl) {
      hideDetail(); /* respaldo sin Bootstrap JS */
      showEditModal();
      return;
    }
    /* Cierra el detalle y abre la edición. Si el detalle aún está en su
       fade, reintenta: un hide() dentro de la transición sería ignorado
       y la ventana de edición quedaría sin abrir. */
    cuandoQuieta(modalEl, (inst) => {
      if (!modalEl.classList.contains("show")) { showEditModal(); return; }
      modalEl.addEventListener("hidden.bs.modal", function h() {
        modalEl.removeEventListener("hidden.bs.modal", h);
        showEditModal();
      });
      (inst || bootstrap.Modal.getOrCreateInstance(modalEl)).hide();
    });
  }

  if (editOk) {
    Store.getCategories().forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      ep.cat.appendChild(opt);
    });

    ep.modes.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-mode]");
      if (btn) epSetMode(btn.dataset.mode);
    });
    ep.url.addEventListener("input", () => {
      if (editImgMode === "url") epRenderPreview(ep.url.value.trim());
    });
    ep.file.addEventListener("change", () => epProcessImage(ep.file.files[0]));
    ["dragenter", "dragover"].forEach((ev) =>
      ep.drop.addEventListener(ev, (e) => {
        e.preventDefault();
        ep.drop.classList.add("dragover");
      })
    );
    ["dragleave", "drop"].forEach((ev) =>
      ep.drop.addEventListener(ev, (e) => {
        e.preventDefault();
        ep.drop.classList.remove("dragover");
      })
    );
    ep.drop.addEventListener("drop", (e) => {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) epProcessImage(f);
    });

    editBtn.addEventListener("click", openEdit);

    /* Cancelar vuelve al detalle; la X o el fondo cierran sin volver */
    editCancel.addEventListener("click", () => {
      reopenDetail = true;
      hideEdit();
    });

    editModalEl.querySelectorAll("[data-bs-dismiss='modal']").forEach((b) =>
      b.addEventListener("click", hideEdit)
    );
    editModalEl.addEventListener("click", (e) => {
      if (e.target === editModalEl) hideEdit(); /* clic en el fondo cierra */
    });

    editForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!editForm.checkValidity()) { editForm.classList.add("was-validated"); return; }
      if (!currentProduct) return;
      const imagen = editImgMode === "file"
        ? editImgData
        : (/^https?:\/\//.test(ep.url.value.trim()) ? ep.url.value.trim() : "");
      const r = Store.updateProduct(currentProduct.id, {
        nombre: ep.name.value,
        sku: ep.sku.value,
        categoria: ep.cat.value,
        precio: ep.price.value,
        descripcion: ep.desc.value,
        imagen
      });
      if (!r.ok) { toast(r.msg, false); return; }
      toast(`Producto "${r.product.nombre}" actualizado.`);
      render();
      reopenDetail = true; /* mostramos el detalle con los datos nuevos */
      hideEdit();
    });
  }

  /* Clic o Enter sobre una fila abre la ventana */
  body.addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr) showDetail(tr.dataset.id);
  });
  body.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const tr = e.target.closest("tr[data-id]");
    if (tr) showDetail(tr.dataset.id);
  });

  Store.getCategories().forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    categoryFilter.appendChild(opt);
  });

  function render() {
    const warehouses = Store.getWarehouses();
    const q = searchInput.value.trim().toLowerCase();
    const cat = categoryFilter.value;

    const filtered = Store.getProducts().filter((p) => {
      const matchQ = !q || [p.sku, p.nombre, p.categoria].some((v) => v.toLowerCase().includes(q));
      const matchCat = !cat || p.categoria === cat;
      return matchQ && matchCat;
    });

    head.innerHTML = `<tr>
      <th>SKU</th>
      <th>Producto</th>
      <th>Categoría</th>
      ${warehouses.map((w) => `<th class="text-end">${w}</th>`).join("")}
      <th class="text-end">Total</th>
      <th class="text-end">Precio</th>
      <th>Estado</th>
    </tr>`;

    body.innerHTML = filtered.map((p) => `
      <tr class="product-row" data-id="${p.id}" tabindex="0" role="button" aria-label="Ver detalle de ${p.nombre}">
        <td class="sku-code">${p.sku}</td>
        <td>
          <div class="d-flex align-items-center gap-2">
            <span class="thumb">${productThumb(p)}</span>
            <div class="d-flex flex-column">
              <strong>${p.nombre}</strong>
              <small class="text-secondary">${p.descripcion || ""}</small>
            </div>
          </div>
        </td>
        <td>${p.categoria}</td>
        ${warehouses.map((w) => `<td class="text-end">${Store.isBajoPedido(p) ? "—" : (p.stock[w] || 0)}</td>`).join("")}
        <td class="text-end fw-bold">${Store.isBajoPedido(p) ? "—" : Store.totalStock(p)}</td>
        <td class="text-end">${fmtCLP(p.precio)}</td>
        <td>${statusBadge(p)}</td>
      </tr>`).join("");

    empty.classList.toggle("d-none", filtered.length > 0);
    count.textContent = `${filtered.length} producto${filtered.length === 1 ? "" : "s"} en la lista`;
  }

  searchInput.addEventListener("input", render);
  categoryFilter.addEventListener("change", render);
  render();

  /* ---- Historial de movimientos (RF-09) ---- */
  function renderMovements() {
    const tbody = document.getElementById("movementsBody");
    if (!tbody) return;
    const movs = Store.getMovements();
    tbody.innerHTML = movs.length
      ? movs.map((m) => `
          <tr>
            <td class="text-secondary">${fechaCorta(m.fecha)}</td>
            <td>${m.producto}</td>
            <td><span class="badge ${m.tipo === "traslado" ? "badge-soft-warning" : "badge-soft-success"}">${m.tipo === "traslado" ? "Traslado" : "Ingreso"}</span></td>
            <td class="text-secondary">${m.origen} -&gt; ${m.destino}</td>
            <td class="text-end fw-bold">${m.unidades}</td>
            <td class="text-secondary">${m.usuario}</td>
          </tr>`).join("")
      : `<tr><td colspan="6" class="text-center text-secondary py-3">Aún no hay movimientos registrados.</td></tr>`;
  }
  renderMovements();

  /* ---- Exportación de reportes a Excel (RF-10, solo administrador) ---- */
  function exportarInventario() {
    if (!Store.isAdmin()) { toast("Solo el administrador puede exportar reportes.", false); return; }
    if (typeof Excel === "undefined") { toast("Exportación no disponible.", false); return; }
    const warehouses = Store.getWarehouses();
    const encabezados = ["#", "SKU", "Producto", "Categoría", "Precio"]
      .concat(warehouses, ["Total", "Estado"]);
    const filas = Store.getProducts().map((p, i) => {
      const meta = STATUS_META[Store.statusOf(p)];
      const stockCols = warehouses.map((w) => (Store.isBajoPedido(p) ? "" : p.stock[w] || 0));
      return [i + 1, p.sku, p.nombre, p.categoria, p.precio]
        .concat(stockCols, [Store.isBajoPedido(p) ? "" : Store.totalStock(p), meta.label]);
    });
    Excel.descargar(`inventario-${Excel.fechaArchivo()}.xlsx`, "Inventario", encabezados, filas);
    toast(`Inventario exportado: ${filas.length} productos.`);
  }

  function exportarHistorial() {
    if (!Store.isAdmin()) { toast("Solo el administrador puede exportar reportes.", false); return; }
    if (typeof Excel === "undefined") { toast("Exportación no disponible.", false); return; }
    const movs = Store.getMovements();
    if (!movs.length) { toast("No hay movimientos registrados.", false); return; }
    const encabezados = ["#", "Fecha", "Producto", "Tipo", "Origen", "Destino", "Unidades", "Responsable"];
    const filas = movs.map((m, i) => [
      i + 1,
      new Date(m.fecha).toLocaleString("es-CL"),
      m.producto,
      m.tipo,
      m.origen || "—",
      m.destino || "—",
      m.unidades,
      m.usuario || ""
    ]);
    Excel.descargar(`movimientos-${Excel.fechaArchivo()}.xlsx`, "Historial de movimientos", encabezados, filas);
    toast(`Historial exportado: ${filas.length} movimientos.`);
  }

  const btnExportInv = document.getElementById("btnExportInv");
  const btnExportHist = document.getElementById("btnExportHist");
  if (btnExportInv) btnExportInv.addEventListener("click", exportarInventario);
  if (btnExportHist) btnExportHist.addEventListener("click", exportarHistorial);
});
