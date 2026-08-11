// =========================================================
// STAGE SUPPORT — nav.js
// Define el menú lateral según el rol y pinta el estado activo.
// El menú es tipo acordeón: al hacer clic en una sección se abre y
// se cierran las demás. La sección que contiene la página activa
// empieza abierta.
// Añade aquí nuevas secciones a medida que crees más páginas.
// =========================================================

const NAV_ESTRUCTURA = [
  {
    grupo: "General",
    items: [
      { id: "dashboard", label: "Dashboard", href: "dashboard.html", roles: ["Comercial", "Producción", "Admin"], listo: true },
      { id: "calendario", label: "Calendario", href: "calendario.html", roles: ["Comercial", "Producción", "Admin"], listo: true },
      { id: "agenda", label: "Agenda", href: "agenda.html", roles: ["Comercial", "Producción", "Admin"], listo: true },
      { id: "notas", label: "Notas", href: "notas.html", roles: ["Comercial", "Producción", "Admin"], listo: true },
    ],
  },
  {
    grupo: "Comercial",
    items: [
      { id: "catalogo", label: "Catálogo", href: "catalogo.html", roles: ["Comercial", "Admin"], listo: true },
      { id: "propuestas", label: "Preparar Propuesta", href: "propuestas.html", roles: ["Comercial", "Admin"], listo: true },
    ],
  },
  {
    grupo: "Booking & Management",
    items: [
      { id: "bookings", label: "Bookings", href: "bookings.html", roles: ["Comercial", "Admin"], listo: true },
      { id: "roster", label: "Roster", href: "roster.html", roles: ["Comercial", "Admin"], listo: true },
      { id: "venues", label: "Venues", href: "venues.html", roles: ["Comercial", "Admin"], listo: true },
      { id: "clientes", label: "Clientes", href: "clientes.html", roles: ["Comercial", "Admin"], listo: true },
    ],
  },
  {
    grupo: "Producción",
    items: [
      { id: "producciones", label: "Producciones", href: "producciones.html", roles: ["Producción", "Admin"], listo: true },
      { id: "hojasderuta", label: "Hojas de Ruta", href: "hojasderuta.html", roles: ["Producción", "Admin"], listo: true },
      { id: "personal", label: "Personal", href: "personal.html", roles: ["Comercial", "Producción", "Admin"], listo: true },
      { id: "riders", label: "Riders técnicos", href: "riders.html", roles: ["Producción", "Admin"], listo: false },
    ],
  },
  {
    grupo: "Administración",
    items: [
      { id: "usuarios", label: "Usuarios", href: "usuarios.html", roles: ["Admin"], listo: true },
      { id: "roles", label: "Roles", href: "roles.html", roles: ["Admin"], listo: true },
      { id: "comisiones", label: "Comisiones", href: "comisiones.html", roles: ["Admin"], listo: true },
      { id: "configuracion", label: "Datos de la empresa", href: "configuracion.html", roles: ["Admin"], listo: true },
      { id: "backup", label: "Información y Backup", href: "backup.html", roles: ["Admin"], listo: true },
    ],
  },
];

// Versión de la plataforma — sube el número de parche cada vez que se
// publique una ronda de cambios importante. Se pinta bajo el usuario
// logueado en el menú lateral (ver pintarNav / mostrarVersionPlataforma).
const VERSION_PLATAFORMA = "1.0.14";

/**
 * Pinta el menú lateral filtrando por rol y marca la página activa.
 * Tipo acordeón: solo una sección abierta a la vez, empezando por la
 * que contiene la página activa.
 * @param {string} rol - rol del usuario ("Comercial" | "Producción" | "Admin")
 * @param {string} paginaActiva - id de la página actual (ej. "dashboard")
 */
function pintarNav(rol, paginaActiva) {
  const cont = document.getElementById("nav-container");
  if (!cont) return;
  cont.innerHTML = "";

  NAV_ESTRUCTURA.forEach((grupo, indiceGrupo) => {
    const itemsVisibles = grupo.items.filter((it) => it.roles.includes(rol));
    if (itemsVisibles.length === 0) return;

    const contieneActiva = itemsVisibles.some((it) => it.id === paginaActiva);

    const wrap = document.createElement("div");
    wrap.className = "nav-group" + (contieneActiva ? " open" : "");
    wrap.dataset.grupoIndex = indiceGrupo;

    const header = document.createElement("button");
    header.type = "button";
    header.className = "nav-group-header";
    header.innerHTML = `<span>${grupo.grupo}</span><span class="nav-chevron">›</span>`;
    header.addEventListener("click", () => toggleNavGroup(wrap));
    wrap.appendChild(header);

    const itemsCont = document.createElement("div");
    itemsCont.className = "nav-group-items";

    itemsVisibles.forEach((it) => {
      const el = document.createElement(it.listo ? "a" : "div");
      el.className = "nav-item" + (it.id === paginaActiva ? " active" : "") + (!it.listo ? " disabled" : "");
      if (it.listo) el.href = it.href;

      const dot = document.createElement("span");
      dot.className = "dot";
      el.appendChild(dot);

      const span = document.createElement("span");
      span.textContent = it.label;
      el.appendChild(span);

      if (!it.listo) {
        const soon = document.createElement("span");
        soon.className = "soon";
        soon.textContent = "pronto";
        el.appendChild(soon);
      }

      itemsCont.appendChild(el);
    });

    wrap.appendChild(itemsCont);
    cont.appendChild(wrap);
  });

  mostrarVersionPlataforma();
}

/**
 * Pinta el número de versión de la plataforma bajo el usuario logueado,
 * si la página actual tiene el elemento #pass-version en el sidebar.
 */
function mostrarVersionPlataforma() {
  const el = document.getElementById("pass-version");
  if (el) el.textContent = "V" + VERSION_PLATAFORMA;
}

// En móvil, el menú lateral flota sobre el contenido — se cierra solo
// al tocar fuera de él (o al elegir una sección), para que no haga
// falta ir a buscar el botón ☰ otra vez.
document.addEventListener("click", (e) => {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar || !sidebar.classList.contains("open")) return;
  if (sidebar.contains(e.target) || e.target.closest(".mobile-menu-btn")) return;
  sidebar.classList.remove("open");
});

/**
 * Abre la sección pulsada y cierra el resto (acordeón: una sola
 * sección abierta a la vez). Si ya estaba abierta, la cierra.
 */
function toggleNavGroup(wrapPulsado) {
  const yaAbierto = wrapPulsado.classList.contains("open");
  document.querySelectorAll("#nav-container .nav-group").forEach((g) => g.classList.remove("open"));
  if (!yaAbierto) wrapPulsado.classList.add("open");
}
