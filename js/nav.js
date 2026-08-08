// =========================================================
// STAGE SUPPORT — nav.js
// Define el menú lateral según el rol y pinta el estado activo.
// Añade aquí nuevas secciones a medida que crees más páginas.
// =========================================================

const NAV_ESTRUCTURA = [
  {
    grupo: "General",
    items: [
      { id: "dashboard", label: "Dashboard", href: "dashboard.html", roles: ["Comercial", "Producción", "Admin"], listo: true },
      { id: "calendario", label: "Calendario", href: "calendario.html", roles: ["Comercial", "Producción", "Admin"], listo: true },
    ],
  },
  {
    grupo: "Booking & Comercial",
    items: [
      { id: "bookings", label: "Bookings", href: "bookings.html", roles: ["Comercial", "Admin"], listo: false },
      { id: "clientes", label: "Clientes", href: "clientes.html", roles: ["Comercial", "Admin"], listo: false },
    ],
  },
  {
    grupo: "Producción",
    items: [
      { id: "producciones", label: "Producciones", href: "producciones.html", roles: ["Producción", "Admin"], listo: false },
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
    ],
  },
];

/**
 * Pinta el menú lateral filtrando por rol y marca la página activa.
 * @param {string} rol - rol del usuario ("Comercial" | "Producción" | "Admin")
 * @param {string} paginaActiva - id de la página actual (ej. "dashboard")
 */
function pintarNav(rol, paginaActiva) {
  const cont = document.getElementById("nav-container");
  if (!cont) return;
  cont.innerHTML = "";

  NAV_ESTRUCTURA.forEach((grupo) => {
    const itemsVisibles = grupo.items.filter((it) => it.roles.includes(rol));
    if (itemsVisibles.length === 0) return;

    const wrap = document.createElement("div");
    wrap.className = "nav-group";

    const label = document.createElement("div");
    label.className = "nav-label";
    label.textContent = grupo.grupo;
    wrap.appendChild(label);

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

      wrap.appendChild(el);
    });

    cont.appendChild(wrap);
  });
}
