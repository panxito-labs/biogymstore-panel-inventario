/* Página: traslado.html — traslado entre bodegas y gestión de bodegas (solo jefe) */

document.addEventListener("DOMContentLoaded", async () => {
  if (document.body.dataset.page !== "traslado" || !Store.isLoggedIn()) return;
  await Store.init();

  /* RF-02: el traslado es exclusivo del jefe/administrador */
  if (!Store.isAdmin()) {
    window.location.replace("dashboard.html");
    return;
  }

  const form = document.getElementById("transferForm");
  const prodSel = document.getElementById("transferProduct");
  const fromSel = document.getElementById("transferFrom");
  const toSel = document.getElementById("transferTo");
  const qtyInput = document.getElementById("transferQty");
  const availInfo = document.getElementById("availableInfo");

  const whForm = document.getElementById("warehouseForm");
  const whName = document.getElementById("warehouseName");
  const whList = document.getElementById("warehouseList");

  function fillProducts() {
    const prev = prodSel.value;
    prodSel.innerHTML = "";
    Store.getProducts()
      .filter((p) => !Store.isBajoPedido(p) && Store.totalStock(p) > 0)
      .forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.sku} — ${p.nombre}`;
        prodSel.appendChild(opt);
      });
    if ([...prodSel.options].some((o) => o.value === prev)) prodSel.value = prev;
    updateAvailable();
  }

  function fillWarehouseSelects() {
    [fromSel, toSel].forEach((sel) => {
      const prev = sel.value;
      sel.innerHTML = "";
      Store.getWarehouses().forEach((w) => {
        const opt = document.createElement("option");
        opt.value = w;
        opt.textContent = w;
        sel.appendChild(opt);
      });
      if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
    });
    renderWarehouses();
    updateAvailable();
  }

  function updateAvailable() {
    const p = Store.getProduct(prodSel.value);
    if (!p) {
      availInfo.textContent = "No hay productos con stock para trasladar.";
      return;
    }
    availInfo.textContent = `Disponible en ${fromSel.value}: ${p.stock[fromSel.value] || 0} u.`;
  }

  [prodSel, fromSel].forEach((el) => el.addEventListener("change", updateAvailable));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.classList.add("was-validated"); return; }
    const res = Store.transfer(prodSel.value, fromSel.value, toSel.value, qtyInput.value);
    toast(res.msg, res.ok);
    if (res.ok) {
      qtyInput.value = 1;
      fillProducts();
    }
  });

  /* ---- Gestión de bodegas (agregar / eliminar) ---- */
  function renderWarehouses() {
    whList.innerHTML = Store.getWarehouses().map((w) => `
      <li class="list-group-item d-flex justify-content-between align-items-center bg-transparent border-secondary">
        <span class="d-flex align-items-center gap-2">${icon("package")}${w}</span>
        <button type="button" class="btn btn-outline-danger btn-sm py-0" data-warehouse="${w}" aria-label="Eliminar ${w}">${icon("trash")}</button>
      </li>`).join("");

    whList.querySelectorAll("button[data-warehouse]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const w = btn.dataset.warehouse;
        if (!window.confirm(`¿Eliminar la bodega "${w}"? Se quitará del sistema junto con su stock registrado.`)) return;
        const res = Store.removeWarehouse(w);
        toast(res.msg, res.ok);
        if (res.ok) {
          fillWarehouseSelects();
          fillProducts();
        }
      });
    });
  }

  whForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!whForm.checkValidity()) { whForm.classList.add("was-validated"); return; }
    const res = Store.addWarehouse(whName.value);
    toast(res.msg, res.ok);
    if (res.ok) {
      whName.value = "";
      fillWarehouseSelects();
      fillProducts();
    }
  });

  /* ---- Historial de movimientos: ahora vive en inventario.html (RF-09) ---- */

  fillProducts();
  fillWarehouseSelects();
});
