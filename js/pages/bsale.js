/* Página: bsale.html — RF-08: integración con Bsale (simulación).
   Una venta en Bsale descuenta el stock de la aplicación; un ingreso en la
   aplicación "actualiza" el stock en Bsale. Todo queda en el registro de
   sincronización y en el historial de movimientos. */

document.addEventListener("DOMContentLoaded", async () => {
  if (document.body.dataset.page !== "bsale" || !Store.isLoggedIn()) return;
  await Store.init();

  /* RF-08: la integración es exclusiva del jefe/administrador */
  if (!Store.isAdmin()) {
    window.location.replace("dashboard.html");
    return;
  }

  const form = document.getElementById("saleForm");
  const prodSel = document.getElementById("saleProduct");
  const qtyInput = document.getElementById("saleQty");
  const whSel = document.getElementById("saleWarehouse");
  const info = document.getElementById("saleInfo");

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
    updateInfo();
  }

  function fillWarehouses() {
    const prev = whSel.value;
    whSel.innerHTML = "";
    Store.getWarehouses().forEach((w) => {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      whSel.appendChild(opt);
    });
    if ([...whSel.options].some((o) => o.value === prev)) whSel.value = prev;
    updateInfo();
  }

  function updateInfo() {
    const p = Store.getProduct(prodSel.value);
    if (!p) {
      info.textContent = "No hay productos con stock disponibles para vender.";
      return;
    }
    const qty = Number(qtyInput.value) || 0;
    const disp = p.stock[whSel.value] || 0;
    info.textContent = `Disponible en ${whSel.value}: ${disp} u. · Total de la venta: ${fmtCLP(p.precio * qty)}`;
  }

  prodSel.addEventListener("change", updateInfo);
  whSel.addEventListener("change", updateInfo);
  qtyInput.addEventListener("input", updateInfo);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.classList.add("was-validated"); return; }
    const res = Store.registrarVentaBsale(prodSel.value, qtyInput.value, whSel.value);
    toast(res.msg, res.ok);
    if (res.ok) {
      qtyInput.value = 1;
      fillProducts();
      render();
    }
  });

  /* ---- Estado + tablas ---- */
  function render() {
    const ventas = Store.getVentasBsale();
    const log = Store.getBsaleLog();

    document.getElementById("bsaleCountVentas").textContent = ventas.length;
    document.getElementById("bsaleCountSync").textContent = log.length;

    document.getElementById("salesBody").innerHTML = ventas.length
      ? ventas.map((v) => `
          <tr>
            <td class="text-secondary">#${v.id}</td>
            <td class="text-secondary">${fechaCorta(v.fecha)}</td>
            <td>${v.producto}</td>
            <td class="text-end fw-bold">${v.unidades}</td>
            <td class="text-end fw-bold">${fmtCLP(v.total)}</td>
            <td><span class="badge badge-soft-success">Stock descontado</span></td>
          </tr>`).join("")
      : `<tr><td colspan="6" class="text-center text-secondary py-3">Aún no hay ventas simuladas. Usa el formulario para registrar la primera.</td></tr>`;

    document.getElementById("syncBody").innerHTML = log.length
      ? log.map((s) => `
          <tr>
            <td class="text-secondary">${fechaCorta(s.fecha)}</td>
            <td><span class="badge ${s.tipo === "venta" ? "badge-soft-danger" : "badge-soft-success"}">${s.tipo === "venta" ? "Venta" : "Ingreso"}</span></td>
            <td class="text-secondary">${s.detalle}</td>
          </tr>`).join("")
      : `<tr><td colspan="3" class="text-center text-secondary py-3">Aún no hay sincronizaciones: registra una venta o un ingreso de stock para verlas aquí.</td></tr>`;
  }

  fillProducts();
  fillWarehouses();
  render();
});
