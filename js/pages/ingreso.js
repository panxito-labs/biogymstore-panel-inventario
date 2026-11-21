/* Página: ingreso-stock.html — ingreso a producto existente + creación de producto */

document.addEventListener("DOMContentLoaded", async () => {
  if (document.body.dataset.page !== "ingreso-stock" || !Store.isLoggedIn()) return;
  await Store.init();

  const restockForm = document.getElementById("restockForm");
  const restockProduct = document.getElementById("restockProduct");
  const restockQty = document.getElementById("restockQty");
  const restockDest = document.getElementById("restockDest");
  const restockCajas = document.getElementById("restockCajas");

  const newForm = document.getElementById("newProductForm");
  const newCategory = document.getElementById("newCategory");
  const newDest = document.getElementById("newDest");
  const newImage = document.getElementById("newImage");
  const newPreview = document.getElementById("newPreview");

  /* ---- Select de productos (solo los con stock propio) ---- */
  function fillProductSelect() {
    const prev = restockProduct.value;
    restockProduct.innerHTML = "";
    Store.getProducts()
      .filter((p) => !Store.isBajoPedido(p))
      .forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.sku} — ${p.nombre} (total: ${Store.totalStock(p)} u.)`;
        restockProduct.appendChild(opt);
      });
    if ([...restockProduct.options].some((o) => o.value === prev)) restockProduct.value = prev;
    updateCajas();
  }

  /* ---- Selects de bodega (desplegables dinámicos) ---- */
  function fillWarehouseSelects() {
    [restockDest, newDest].forEach((sel) => {
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
  }

  /* ---- Recuento automático de cajas (ej: barritas por caja) ---- */
  function updateCajas() {
    const p = Store.getProduct(restockProduct.value);
    if (p && p.cajaUnits > 0) {
      const cajas = (Number(restockQty.value) || 0) / p.cajaUnits;
      restockCajas.textContent = `~ ${cajas.toFixed(2)} cajas de ${p.cajaUnits} u.`;
    } else {
      restockCajas.textContent = "";
    }
  }

  restockProduct.addEventListener("change", updateCajas);
  restockQty.addEventListener("input", updateCajas);

  /* ---- Ingreso en grupo: lista editable + registro de todo junto ---- */
  const listaWrap = document.getElementById("ingresoLista");
  const listaBody = document.getElementById("listaBody");
  const listaCount = document.getElementById("listaCount");
  const btnRegistrar = document.getElementById("btnRegistrarGrupo");
  const btnVaciar = document.getElementById("listaVaciar");
  const listaOk = !!(listaWrap && listaBody && btnRegistrar);
  let lista = []; /* [{ pid, qty, destino }] */

  function renderLista() {
    if (!listaOk) return;
    listaCount.textContent = lista.length;
    btnRegistrar.textContent = `Registrar ingreso (${lista.length})`;
    btnRegistrar.disabled = lista.length === 0;

    if (!lista.length) {
      listaBody.innerHTML =
        `<tr><td colspan="5" class="text-center text-secondary small py-3">` +
        `Aún no hay productos. Agrega el primero con el formulario de arriba ` +
        `(aunque sea uno solo, queda en esta lista).</td></tr>`;
      return;
    }

    const bodegaOpts = (sel) =>
      Store.getWarehouses()
        .map((w) => `<option value="${w}"${w === sel ? " selected" : ""}>${w}</option>`)
        .join("");

    listaBody.innerHTML = lista
      .map((it, i) => {
        const p = Store.getProduct(it.pid);
        return `<tr data-i="${i}">
          <td>${i + 1}</td>
          <td>
            <strong>${p ? p.sku : "?"}</strong>
            <div class="text-secondary small">${p ? p.nombre : "Producto eliminado"}</div>
          </td>
          <td><input type="number" class="form-control form-control-sm lista-qty" min="1" value="${it.qty}" aria-label="Cantidad del producto ${i + 1}"></td>
          <td><select class="form-select form-select-sm lista-dest" aria-label="Destino del producto ${i + 1}">${bodegaOpts(it.destino)}</select></td>
          <td class="text-end">
            <button type="button" class="pm-close lista-del" aria-label="Quitar de la lista">&times;</button>
          </td>
        </tr>`;
      })
      .join("");
  }

  restockForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!restockForm.checkValidity()) { restockForm.classList.add("was-validated"); return; }
    if (!listaOk) return;
    const pid = Number(restockProduct.value);
    const qty = Number(restockQty.value);
    const destino = restockDest.value;
    const p = Store.getProduct(pid);
    if (!p || !(qty > 0)) return;
    lista.push({ pid, qty, destino });
    renderLista();
    toast(`"${p.nombre}" agregado a la lista (${lista.length} en el ingreso).`);
    restockQty.value = 1;
    restockForm.classList.remove("was-validated");
    updateCajas();
  });

  if (listaOk) {
    /* Cantidades y destinos se editan dentro de la tabla */
    listaBody.addEventListener("input", (e) => {
      const tr = e.target.closest("tr[data-i]");
      if (!tr) return;
      const it = lista[Number(tr.dataset.i)];
      if (!it) return;
      if (e.target.classList.contains("lista-qty")) it.qty = Number(e.target.value);
      if (e.target.classList.contains("lista-dest")) it.destino = e.target.value;
    });

    /* Quitar un producto de la lista */
    listaBody.addEventListener("click", (e) => {
      const del = e.target.closest(".lista-del");
      if (!del) return;
      const tr = del.closest("tr[data-i]");
      if (!tr) return;
      lista.splice(Number(tr.dataset.i), 1);
      renderLista();
    });

    btnVaciar.addEventListener("click", () => {
      lista = [];
      renderLista();
      toast("Lista vaciada.");
    });

    /* Registra todo el grupo de una vez y descarga el Excel (RF-10) */
    btnRegistrar.addEventListener("click", () => {
      if (!lista.length) return;

      /* Validar todo antes de tocar el stock */
      for (const it of lista) {
        const p = Store.getProduct(it.pid);
        if (!p) { toast("Hay un producto de la lista que ya no existe.", false); return; }
        if (!(Number(it.qty) > 0)) { toast(`Cantidad inválida para ${p.sku}.`, false); return; }
        if (!it.destino) { toast(`Falta el destino de ${p.sku}.`, false); return; }
      }

      /* Registrar (addStock descuenta/suma y deja el movimiento) */
      const registrados = [];
      for (const it of lista) {
        const p = Store.getProduct(it.pid);
        const res = Store.addStock(p.id, Number(it.qty), it.destino);
        if (!res.ok) { toast(res.msg, false); break; }
        registrados.push({ p, qty: Number(it.qty), destino: it.destino });
      }
      if (!registrados.length) return;

      /* Excel con todo lo ingresado, listo para adjuntar al correo */
      try {
        const ahora = new Date();
        const fechaTxt = ahora.toLocaleString("es-CL");
        const usuario = (Store.currentUser() || {}).nombre || "";
        const filas = registrados.map((it, i) => [
          i + 1, it.p.sku, it.p.nombre, it.qty, it.destino,
          it.p.precio, it.p.precio * it.qty, fechaTxt, usuario
        ]);
        const total = registrados.reduce((s, it) => s + it.p.precio * it.qty, 0);
        filas.push(["", "", "", "", "", "TOTAL", total, "", ""]);
        Excel.descargar(
          `ingreso-${Excel.fechaArchivo(ahora)}.xlsx`,
          "Ingreso de stock",
          ["#", "SKU", "Producto", "Cantidad", "Bodega destino", "Precio unitario", "Valor total", "Fecha", "Responsable"],
          filas
        );
      } catch (err) {
        console.warn("No se pudo generar el Excel:", err);
      }

      const n = registrados.length;
      toast(`Ingreso registrado: ${n} producto${n === 1 ? "" : "s"}. Excel descargado — adjúntalo a tu correo.`);
      lista = [];
      renderLista();
      restockQty.value = 1;
      fillProductSelect();
    });
  }

  /* Estado inicial de la lista (siempre visible, aunque esté vacía) */
  if (listaOk) renderLista();

  /* ---- Categorías del catálogo ---- */
  Store.getCategories().forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    newCategory.appendChild(opt);
  });

  /* ---- Imagen: modo URL o archivo subido ---- */
  const imgModes = document.getElementById("imgModes");
  const imgPanelUrl = document.getElementById("imgPanelUrl");
  const imgPanelFile = document.getElementById("imgPanelFile");
  const imgFile = document.getElementById("newImageFile");
  const imgDrop = document.getElementById("imgDrop");
  const imgDropText = document.getElementById("imgDropText");

  let imgMode = "url";
  let imgData = ""; /* data URL de la imagen subida (vacío si no hay) */

  function renderPreview(src) {
    if (/^(https?:\/\/|data:image\/)/.test(src)) {
      newPreview.innerHTML = `<img src="${src}" alt="" class="thumb-img">`;
    } else {
      newPreview.innerHTML = icon("package");
    }
  }

  function setImgMode(mode) {
    imgMode = mode;
    imgModes.querySelectorAll("button").forEach((b) =>
      b.classList.toggle("active", b.dataset.mode === mode)
    );
    imgPanelUrl.classList.toggle("d-none", mode !== "url");
    imgPanelFile.classList.toggle("d-none", mode !== "file");
    /* Al ocultar el input de URL se deshabilita para que su validación
       (type=url) no bloquee el envío del formulario en modo archivo */
    newImage.disabled = mode !== "url";
    renderPreview(mode === "file" ? imgData : newImage.value.trim());
  }

  imgModes.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-mode]");
    if (btn) setImgMode(btn.dataset.mode);
  });

  newImage.addEventListener("input", () => {
    if (imgMode === "url") renderPreview(newImage.value.trim());
  });

  /* Redimensiona y comprime a 600 px antes de guardar (la imagen viaja en
     base64 dentro de sessionStorage, hay que mantenerla liviana) */
  function processImage(file) {
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
        /* PNG conserva transparencia; el resto va a JPEG para pesar menos */
        const tieneAlfa = file.type === "image/png" || file.type === "image/webp";
        imgData = canvas.toDataURL(tieneAlfa ? "image/png" : "image/jpeg", 0.82);
        imgDrop.classList.add("has-file");
        imgDropText.textContent = `${file.name} · ${w}×${h}px`;
        renderPreview(imgData);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  imgFile.addEventListener("change", () => processImage(imgFile.files[0]));

  /* Arrastrar y soltar sobre la zona de la imagen */
  ["dragenter", "dragover"].forEach((ev) =>
    imgDrop.addEventListener(ev, (e) => {
      e.preventDefault();
      imgDrop.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    imgDrop.addEventListener(ev, (e) => {
      e.preventDefault();
      imgDrop.classList.remove("dragover");
    })
  );
  imgDrop.addEventListener("drop", (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) processImage(f);
  });

  function clearImage() {
    imgData = "";
    imgFile.value = "";
    imgDrop.classList.remove("has-file");
    imgDropText.textContent = "Haz clic o arrastra una imagen aquí";
    renderPreview(imgMode === "file" ? "" : newImage.value.trim());
  }

  /* ---- Crear producto nuevo ---- */
  newForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!newForm.checkValidity()) { newForm.classList.add("was-validated"); return; }
    const sku = document.getElementById("newSku").value;
    if (Store.skuExists(sku)) {
      toast(`El SKU ${sku.toUpperCase()} ya existe en el catálogo.`, false);
      return;
    }
    const precio = Number(document.getElementById("newPrice").value);
    if (!(precio >= 0)) {
      toast("Ingrese un precio válido.", false);
      return;
    }
    const imagen = imgMode === "file"
      ? imgData
      : (/^https?:\/\//.test(newImage.value.trim()) ? newImage.value.trim() : "");
    const product = Store.addProduct({
      nombre: document.getElementById("newName").value,
      sku,
      categoria: newCategory.value,
      precio,
      descripcion: document.getElementById("newDesc").value,
      imagen,
      icon: "box",
      cajaUnits: document.getElementById("newBoxUnits").value,
      cantidad: document.getElementById("newQty").value,
      destino: newDest.value
    });
    toast(`Producto "${product.nombre}" agregado al catálogo.`);
    newForm.reset();
    clearImage();
    setImgMode("url");
    fillProductSelect();
    fillWarehouseSelects();
  });

  fillProductSelect();
  fillWarehouseSelects();
});
