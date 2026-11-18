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

  /* ---- Ventana de detalle de producto ---- */
  const modalEl = document.getElementById("productModal");
  const filterEl = document.getElementById("pmFilter");
  const kpisEl = document.getElementById("pmKpis");
  const chartEl = document.getElementById("pmChart");
  const axisEl = document.getElementById("pmAxis");
  const noSalesEl = document.getElementById("pmNoSales");

  let currentProduct = null;
  let currentPeriod = "mes";

  /* Estadística del producto según el periodo elegido */
  function renderStats() {
    if (!currentProduct) return;
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

  filterEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-period]");
    if (!btn) return;
    currentPeriod = btn.dataset.period;
    filterEl.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
    renderStats();
  });

  function showDetail(id) {
    const p = Store.getProduct(id);
    if (!p) return;
    currentProduct = p;
    document.getElementById("pmSku").textContent = p.sku;
    document.getElementById("pmName").textContent = p.nombre;
    document.getElementById("pmCat").textContent = p.categoria;
    document.getElementById("pmPrice").textContent = fmtCLP(p.precio);
    document.getElementById("pmStatus").innerHTML = statusBadge(p);
    document.getElementById("pmDesc").textContent = p.descripcion || "Sin descripción disponible.";
    document.getElementById("pmPhoto").innerHTML = productThumb(p);
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

  modalEl.querySelectorAll("[data-bs-dismiss='modal']").forEach((b) =>
    b.addEventListener("click", hideDetail)
  );
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) hideDetail(); /* clic en el fondo cierra */
  });

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
});
