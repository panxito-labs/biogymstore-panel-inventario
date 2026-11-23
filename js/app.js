/* Si Bootstrap no cargó (sin internet), usar respaldo offline */
(function () {
  var cssLoaded = false;
  try {
    var v = getComputedStyle(document.documentElement).getPropertyValue("--bs-body-bg");
    cssLoaded = v && v.trim() !== "";
  } catch (e) { cssLoaded = false; }
  if (!cssLoaded) document.body.classList.add("no-bs");
})();

/* ---------- Utilidades globales ---------- */

function fmtCLP(n) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency", currency: "CLP", maximumFractionDigits: 0
  }).format(n);
}

function fechaCorta(iso) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
    " " +
    d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
  );
}

/* Icono SVG propio (sin emojis) */
function icon(name) {
  if (typeof ICONS !== "undefined" && ICONS[name]) {
    return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + "</svg>";
  }
  return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS.box + "</svg>";
}

const STATUS_META = {
  ok:      { label: "En Stock",    cls: "badge-soft-success" },
  bajo:    { label: "Stock Bajo",  cls: "badge-soft-warning" },
  agotado: { label: "Agotado",     cls: "badge-soft-danger" },
  pedido:  { label: "Bajo pedido", cls: "badge-soft-secondary" }
};

function statusBadge(p) {
  const meta = STATUS_META[Store.statusOf(p)];
  return `<span class="badge ${meta.cls}">${meta.label}</span>`;
}

function productThumb(p) {
  if (/^(https?:\/\/|data:image\/)/.test(p.imagen || "")) {
    return `<img src="${p.imagen}" alt="" class="thumb-img" loading="lazy">`;
  }
  if (typeof ICONS !== "undefined" && ICONS[p.icon]) {
    return icon(p.icon);
  }
  var antiguo = { "\u{1F964}": "zap", "\u{1F95B}": "zap", "\u{1F4AA}": "dumbbell", "\u2615": "coffee", "\u{1F3CB}\uFE0F": "dumbbell", "\u{1F3C5}": "dumbbell", "\u{1F455}": "tag", "\u{1F36B}": "zap", "\u{1F9F7}": "box", "\u2696\uFE0F": "truck" };
  if (antiguo[p.imagen]) return icon(antiguo[p.imagen]);
  return icon("box");
}

/* Toast de notificación (con o sin Bootstrap JS) */
function toast(msg, ok = true) {
  let host = document.getElementById("toastHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "toastHost";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = "toast align-items-center border-0 " + (ok ? "text-bg-success" : "text-bg-danger") + " show";
  el.setAttribute("role", "alert");
  el.innerHTML =
    '<div class="d-flex"><div class="toast-body">' + msg + '</div>' +
    '<button type="button" class="btn-close me-2 m-auto" aria-label="Cerrar"></button></div>';
  host.appendChild(el);

  const close = () => { if (el.parentNode) el.parentNode.removeChild(el); };
  el.querySelector(".btn-close").addEventListener("click", close);
  setTimeout(close, 3500);

  if (typeof bootstrap !== "undefined" && bootstrap.Toast) {
    try { new bootstrap.Toast(el, { delay: 3500 }).show(); } catch (e) { /* respaldo manual ya aplicado */ }
  }
}

/* ---------- Sesión global y navbar ---------- */

document.addEventListener("DOMContentLoaded", async () => {
  const page = document.body.dataset.page;

  if (page !== "login") {
    // Protección de rutas: sin sesión no hay panel
    if (!Store.isLoggedIn()) {
      window.location.replace("index.html");
      return;
    }
    await Store.init();
    // Sesión inválida (usuario eliminado o desactivado) → volver al login
    if (!Store.currentUser()) {
      Store.logout();
      window.location.replace("index.html");
      return;
    }
    // RF-02 / RF-08: Traslado y Bsale son exclusivos del jefe/administrador
    if ((page === "traslado" || page === "bsale") && !Store.isAdmin()) {
      window.location.replace("dashboard.html");
      return;
    }
    renderUser();
    aplicarPermisos();
  } else if (Store.isLoggedIn()) {
    // Con sesión iniciada, el login redirige al dashboard
    window.location.replace("dashboard.html");
    return;
  }

  // Botón hamburguesa sin Bootstrap JS (respaldo)
  document.querySelectorAll("[data-bs-toggle='collapse']").forEach((btn) => {
    const target = document.querySelector(btn.getAttribute("data-bs-target"));
    if (target && (typeof bootstrap === "undefined" || !bootstrap.Collapse)) {
      btn.addEventListener("click", () => target.classList.toggle("show"));
    }
  });

  // Botón de cerrar sesión
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      Store.logout();
      window.location.href = "index.html";
    });
  }

  // Enlace activo del navbar según la página actual
  document.querySelectorAll("#mainNav .nav-link").forEach((a) => {
    if (a.getAttribute("href") === page + ".html") {
      a.classList.add("active");
      a.setAttribute("aria-current", "page");
    }
  });
});

function renderUser() {
  const u = Store.currentUser();
  if (!u) return;
  const rolTxt = u.rol === "admin" ? "Jefe / Administrador" : "Vendedor";
  document.querySelectorAll(".js-user-name").forEach((e) => (e.textContent = u.nombre));
  document.querySelectorAll(".js-user-role").forEach((e) => (e.textContent = rolTxt));
  document.querySelectorAll(".js-user-initials").forEach((e) => (e.textContent = u.iniciales));
}

/* RF-02: oculta opciones según el rol y deja el badge de usuario como acceso
   a la gestión de usuarios (solo administrador) o al perfil propio (vendedor) */
function aplicarPermisos() {
  const admin = Store.isAdmin();

  // Opciones exclusivas del jefe (data-admin-only) y el enlace "Traslado"
  document.querySelectorAll("[data-admin-only]").forEach((el) => {
    el.classList.toggle("d-none", !admin);
  });
  document.querySelectorAll('#mainNav a[href="traslado.html"]').forEach((a) => {
    const li = a.closest("li") || a;
    li.classList.toggle("d-none", !admin);
  });

  // Exportar a Excel (RF-10) es solo del administrador
  if (!admin) {
    const btnInv = document.getElementById("btnExportInv");
    const btnHist = document.getElementById("btnExportHist");
    if (btnInv && btnInv.parentElement) btnInv.parentElement.classList.add("d-none");
    else if (btnInv) btnInv.classList.add("d-none");
    if (btnHist) btnHist.classList.add("d-none");
  }

  // Badge de usuario: clicable para abrir gestión de usuarios / perfil
  document.querySelectorAll(".user-badge").forEach((badge) => {
    badge.classList.add("user-badge-clickable");
    badge.setAttribute("title", admin ? "Gestionar usuarios" : "Ver mi perfil");
    badge.addEventListener("click", (e) => {
      if (e.target.closest("#btnLogout")) return; // el botón de salir tiene su acción
      if (typeof window.abrirGestorUsuarios === "function") window.abrirGestorUsuarios();
    });
  });
}

