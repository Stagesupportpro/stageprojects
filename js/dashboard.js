// =========================================================
// STAGE SUPPORT — dashboard.js
// =========================================================

(async function () {
  const perfil = await protegerPagina(); // cualquier rol con acceso activo

  pintarNav(perfil.rol, "dashboard");

  document.getElementById("pass-name").textContent = perfil.nombre || perfil.email;
  document.getElementById("pass-role").textContent = perfil.rol;
  document.getElementById("saludo").textContent = "Hola, " + (perfil.nombre ? perfil.nombre.split(" ")[0] : perfil.email);
  document.getElementById("fecha-hoy").textContent = new Date().toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long",
  });

  pintarStats(perfil.rol);
  pintarPanelesPorRol(perfil.rol);
})();

function pintarStats(rol) {
  const cont = document.getElementById("stat-grid");

  const statsPorRol = {
    Comercial: [
      { label: "Bookings activos", valor: "—" },
      { label: "Clientes en cartera", valor: "—" },
      { label: "Propuestas pendientes", valor: "—" },
    ],
    "Producción": [
      { label: "Producciones en curso", valor: "—" },
      { label: "Próximo evento", valor: "—" },
      { label: "Riders por cerrar", valor: "—" },
    ],
    Admin: [
      { label: "Usuarios activos", valor: "—" },
      { label: "Bookings activos", valor: "—" },
      { label: "Producciones en curso", valor: "—" },
    ],
  };

  (statsPorRol[rol] || []).forEach((s) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `
      <div class="stat-accent"></div>
      <div class="stat-label">${s.label}</div>
      <div class="stat-value">${s.valor}</div>
    `;
    cont.appendChild(card);
  });
}

function pintarPanelesPorRol(rol) {
  const cont = document.getElementById("role-panels");

  const mensajes = {
    Comercial: "Aquí verás tus bookings, clientes y propuestas en curso en cuanto conectemos esa sección.",
    "Producción": "Aquí verás las producciones activas, el calendario técnico y los riders en cuanto conectemos esa sección.",
    Admin: "Gestiona el equipo desde \"Usuarios\" en el menú. El resto de módulos se irán activando aquí.",
  };

  cont.innerHTML = `
    <div class="empty-state">
      <strong>Todavía no hay datos que mostrar</strong>
      ${mensajes[rol] || "Esta sección se irá completando a medida que avancemos con la plataforma."}
    </div>
  `;
}
