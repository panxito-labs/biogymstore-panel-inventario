/* RF-02: Gestión de usuarios — inyecta la ventana y maneja el CRUD.
   - Administrador (Jefe): crea, edita, desactiva/reactiva cuentas y restablece contraseñas.
   - Vendedor: al presionar su nombre solo ve su perfil (no existe esta opción para él). */

(function () {
  let passTargetId = null; // usuario al que se le restablece la contraseña

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.page === "login") return;
    inyectarModal();
    enlazarEventos();
  });

  /* ---------- Inyección de la ventana (patrón product-modal, con respaldo sin Bootstrap JS) ---------- */

  function inyectarModal() {
    if (document.getElementById("usersModal")) return;
    const html = `
  <div class="modal fade product-modal" id="usersModal" tabindex="-1" role="dialog" aria-labelledby="usersTitle" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content">

        <div class="modal-header">
          <span class="section-title" id="usersTitle">Usuarios</span>
          <button type="button" class="pm-close" data-bs-dismiss="modal" aria-label="Cerrar ventana">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="modal-body">

          <!-- VISTA: lista de cuentas (solo administrador) -->
          <div id="uvLista">
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <span class="text-secondary small mb-0">Cuentas del sistema</span>
              <button type="button" class="pm-edit" id="uvNuevo">Nuevo usuario</button>
            </div>
            <div class="table-responsive">
              <table class="table mb-0">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th class="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody id="uvRows"></tbody>
              </table>
            </div>
          </div>

          <!-- VISTA: perfil propio (vendedor) -->
          <div id="uvPerfil" class="d-none"></div>

          <!-- VISTA: formulario crear / editar -->
          <form id="uvForm" class="d-none needs-validation" novalidate>
            <h2 class="h6 fw-bold mb-3" id="uvFormTitle">Nuevo usuario</h2>
            <input type="hidden" id="uvId">
            <div class="mb-3">
              <label for="uvNombre" class="form-label">Nombre</label>
              <input type="text" id="uvNombre" class="form-control" required>
              <div class="invalid-feedback">Ingresa el nombre.</div>
            </div>
            <div class="mb-3">
              <label for="uvEmail" class="form-label">Correo</label>
              <input type="email" id="uvEmail" class="form-control" required>
              <div class="invalid-feedback">Ingresa un correo válido.</div>
            </div>
            <div class="mb-3" id="uvPassField">
              <label for="uvPass" class="form-label">Contraseña</label>
              <input type="password" id="uvPass" class="form-control" minlength="6" autocomplete="new-password">
              <div class="form-text text-secondary">Mínimo 6 caracteres.</div>
              <div class="invalid-feedback">La contraseña debe tener al menos 6 caracteres.</div>
            </div>
            <div class="mb-3">
              <label for="uvRol" class="form-label">Rol</label>
              <select id="uvRol" class="form-select">
                <option value="admin">Jefe / Administrador — acceso total</option>
                <option value="vendedor">Vendedor — acceso limitado</option>
              </select>
              <div class="form-text text-secondary">El vendedor no ve traslado, gestión de usuarios ni exportación de reportes.</div>
            </div>
            <div class="d-flex flex-column gap-2">
              <button type="submit" class="btn btn-accent w-100">Guardar</button>
              <button type="button" class="btn btn-accent w-100" id="uvCancelar">Cancelar</button>
            </div>
          </form>

          <!-- VISTA: restablecer contraseña -->
          <form id="uvPassForm" class="d-none needs-validation" novalidate>
            <h2 class="h6 fw-bold mb-1">Restablecer contraseña</h2>
            <p class="text-secondary small" id="uvPassUser">—</p>
            <div class="mb-3">
              <label for="uvPassNew" class="form-label">Nueva contraseña</label>
              <input type="password" id="uvPassNew" class="form-control" minlength="6" required autocomplete="new-password">
              <div class="form-text text-secondary">Mínimo 6 caracteres.</div>
              <div class="invalid-feedback">La contraseña debe tener al menos 6 caracteres.</div>
            </div>
            <div class="d-flex flex-column gap-2">
              <button type="submit" class="btn btn-accent w-100">Guardar contraseña</button>
              <button type="button" class="btn btn-accent w-100" id="uvPassCancelar">Cancelar</button>
            </div>
          </form>

        </div>
      </div>
    </div>
  </div>`;
    document.body.insertAdjacentHTML("beforeend", html);
  }

  /* ---------- Apertura / cierre ---------- */

  function mostrar() {
    const el = document.getElementById("usersModal");
    if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(el).show();
    } else {
      el.classList.add("show");
      el.style.display = "block";
      el.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    }
  }

  function ocultar() {
    const el = document.getElementById("usersModal");
    if (!el) return;
    if (typeof bootstrap !== "undefined" && bootstrap.Modal && bootstrap.Modal.getInstance(el)) {
      bootstrap.Modal.getInstance(el).hide();
    } else {
      el.classList.remove("show");
      el.style.display = "none";
      el.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    }
  }

  function mostrarVista(nombre) {
    const vistas = { lista: "uvLista", perfil: "uvPerfil", form: "uvForm", pass: "uvPassForm" };
    Object.values(vistas).forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.add("d-none");
    });
    const activo = document.getElementById(vistas[nombre]);
    if (activo) activo.classList.remove("d-none");
  }

  /* ---------- Punto de entrada (lo llama app.js desde el badge del navbar) ---------- */

  window.abrirGestorUsuarios = async function () {
    await Store.init();
    const yo = Store.currentUser();
    if (!yo) return;
    const titulo = document.getElementById("usersTitle");
    if (Store.isAdmin()) {
      if (titulo) titulo.textContent = "Gestión de usuarios";
      renderLista();
      mostrarVista("lista");
    } else {
      if (titulo) titulo.textContent = "Mi perfil";
      renderPerfil(yo);
      mostrarVista("perfil");
    }
    mostrar();
  };

  /* ---------- Vistas ---------- */

  function renderLista() {
    const tbody = document.getElementById("uvRows");
    if (!tbody) return;
    const yo = Store.currentUser();
    const users = Store.getUsers();
    tbody.innerHTML = users.length
      ? users.map((u) => {
          const esYo = yo && String(yo.id) === String(u.id);
          const acciones = [];
          acciones.push(`<button type="button" class="pm-edit" data-act="editar" data-id="${u.id}">Editar</button>`);
          acciones.push(`<button type="button" class="pm-edit" data-act="clave" data-id="${u.id}">Contraseña</button>`);
          if (u.activo) {
            acciones.push(esYo
              ? `<span class="text-secondary small align-self-center">Tu cuenta</span>`
              : `<button type="button" class="btn btn-outline-danger btn-sm py-0" data-act="toggle" data-id="${u.id}">Desactivar</button>`);
          } else {
            acciones.push(`<button type="button" class="pm-edit" data-act="toggle" data-id="${u.id}">Reactivar</button>`);
          }
          return `
          <tr>
            <td>
              <div class="d-flex align-items-center gap-2">
                <span class="avatar">${u.iniciales || "--"}</span>
                <div class="user-info">
                  <span class="user-name">${u.nombre}</span>
                  <span class="user-role">${u.email}</span>
                </div>
              </div>
            </td>
            <td><span class="badge ${u.rol === "admin" ? "badge-soft-success" : "badge-soft-secondary"}">${u.rol === "admin" ? "Jefe / Administrador" : "Vendedor"}</span></td>
            <td><span class="badge ${u.activo ? "badge-soft-success" : "badge-soft-danger"}">${u.activo ? "Activo" : "Desactivado"}</span></td>
            <td><div class="d-flex gap-2 justify-content-end flex-wrap">${acciones.join("")}</div></td>
          </tr>`;
        }).join("")
      : `<tr><td colspan="4" class="text-center text-secondary py-3">No hay usuarios registrados.</td></tr>`;
  }

  function renderPerfil(yo) {
    const el = document.getElementById("uvPerfil");
    if (!el) return;
    el.innerHTML = `
      <div class="text-center mb-3">
        <span class="avatar avatar-lg">${yo.iniciales || "--"}</span>
        <h2 class="h6 fw-bold mt-2 mb-0">${yo.nombre}</h2>
        <p class="text-secondary small mb-2">${yo.email}</p>
        <span class="badge badge-soft-secondary">Vendedor — acceso limitado</span>
      </div>
      <div class="text-secondary small">
        <p class="fw-bold mb-1">Puedes:</p>
        <ul class="mb-2 ps-4">
          <li>Consultar el stock por bodega y el historial de movimientos</li>
          <li>Ingresar mercadería y crear o editar fichas de producto</li>
          <li>Ver el módulo de proveedores</li>
        </ul>
        <p class="mb-0">La gestión de usuarios, el traslado de stock, la gestión de bodegas y la exportación de reportes son exclusivas del jefe / administrador.</p>
      </div>`;
  }

  /* ---------- Eventos ---------- */

  function enlazarEventos() {
    /* Cerrar: botón X y clic en el fondo */
    document.addEventListener("click", (e) => {
      const modal = document.getElementById("usersModal");
      if (!modal) return;
      if (e.target.closest("[data-bs-dismiss='modal']") && modal.contains(e.target)) ocultar();
      if (e.target === modal) ocultar();
    });

    /* Acciones de la lista (delegación) */
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("#uvRows [data-act]");
      if (!btn) return;
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      const user = Store.getUsers().find((u) => String(u.id) === String(id));

      if (act === "editar" && user) {
        document.getElementById("uvFormTitle").textContent = "Editar usuario";
        document.getElementById("uvId").value = user.id;
        document.getElementById("uvNombre").value = user.nombre;
        document.getElementById("uvEmail").value = user.email;
        document.getElementById("uvRol").value = user.rol;
        document.getElementById("uvPass").value = "";
        document.getElementById("uvPassField").classList.add("d-none");
        document.getElementById("uvForm").classList.remove("was-validated");
        mostrarVista("form");
      } else if (act === "clave" && user) {
        passTargetId = user.id;
        document.getElementById("uvPassUser").textContent = `${user.nombre} · ${user.email}`;
        document.getElementById("uvPassNew").value = "";
        document.getElementById("uvPassForm").classList.remove("was-validated");
        mostrarVista("pass");
      } else if (act === "toggle" && user) {
        const activar = !user.activo;
        if (!activar && !window.confirm(`¿Desactivar la cuenta de "${user.nombre}"? No podrá iniciar sesión.`)) return;
        const res = Store.cambiarEstadoUsuario(user.id, activar);
        toast(res.msg, res.ok);
        renderLista();
      }
    });

    /* Nuevo usuario */
    const btnNuevo = document.getElementById("uvNuevo");
    if (btnNuevo) {
      btnNuevo.addEventListener("click", () => {
        document.getElementById("uvFormTitle").textContent = "Nuevo usuario";
        document.getElementById("uvId").value = "";
        document.getElementById("uvNombre").value = "";
        document.getElementById("uvEmail").value = "";
        document.getElementById("uvPass").value = "";
        document.getElementById("uvRol").value = "vendedor";
        document.getElementById("uvPassField").classList.remove("d-none");
        document.getElementById("uvForm").classList.remove("was-validated");
        mostrarVista("form");
      });
    }

    /* Guardar crear / editar */
    const form = document.getElementById("uvForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!form.checkValidity()) { form.classList.add("was-validated"); return; }
        const data = {
          nombre: document.getElementById("uvNombre").value,
          email: document.getElementById("uvEmail").value,
          rol: document.getElementById("uvRol").value,
          password: document.getElementById("uvPass").value
        };
        const id = document.getElementById("uvId").value;
        const res = id ? Store.editarUsuario(id, data) : Store.crearUsuario(data);
        toast(res.msg, res.ok);
        if (res.ok) { renderLista(); mostrarVista("lista"); }
      });
    }

    const btnCancelar = document.getElementById("uvCancelar");
    if (btnCancelar) btnCancelar.addEventListener("click", () => { renderLista(); mostrarVista("lista"); });

    /* Restablecer contraseña */
    const passForm = document.getElementById("uvPassForm");
    if (passForm) {
      passForm.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!passForm.checkValidity()) { passForm.classList.add("was-validated"); return; }
        const res = Store.restablecerPassword(passTargetId, document.getElementById("uvPassNew").value);
        toast(res.msg, res.ok);
        if (res.ok) mostrarVista("lista");
      });
    }

    const btnPassCancelar = document.getElementById("uvPassCancelar");
    if (btnPassCancelar) btnPassCancelar.addEventListener("click", () => mostrarVista("lista"));
  }
})();
