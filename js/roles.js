// =========================================================
// STAGE SUPPORT — roles.js
// Roles personalizados y sus permisos por sección.
// Colección: /roles/{id} → { nombre, permisos: { dashboard: true, ... } }
// =========================================================

// El árbol de permisos se construye a partir del menú real
// (NAV_ESTRUCTURA, en nav.js) para que Roles nunca se desincronice
// de las secciones que existen de verdad. Además, algunas páginas
// tienen sus propias pestañas internas — se listan aquí para poder
// filtrar el acceso también a ese nivel.
const TABS_POR_PAGINA = {
  roster: [
    { id: "general", label: "Información general" },
    { id: "tarifas", label: "Tarifas" },
    { id: "riders", label: "Riders" },
    { id: "hospitalidad", label: "Hospitalidad" },
    { id: "presskit", label: "PressKit" },
    { id: "juridico", label: "Jurídico" },
  ],
  producciones: [
    { id: "general", label: "Información general" },
    { id: "cifras", label: "Cifras" },
    { id: "personal", label: "Personal" },
    { id: "tecnica", label: "Técnica" },
    { id: "taquilla", label: "Taquilla" },
    { id: "documentos", label: "Documentos" },
    { id: "hospitalidad", label: "Hospitalidad" },
  ],
  bookings: [
    { id: "general", label: "Información general" },
    { id: "cifras", label: "Cifras" },
    { id: "contratos", label: "Contratos" },
  ],
};

// Lista plana de todas las páginas (para sembrar el rol Admin con
// acceso total, y como fallback si NAV_ESTRUCTURA aún no cargó).
function todasLasPaginas() {
  const paginas = [];
  NAV_ESTRUCTURA.forEach((grupo) => grupo.items.forEach((it) => it.listo && paginas.push(it.id)));
  return paginas;
}

// Roles con los que arranca la plataforma si la colección está vacía.
const ROLES_POR_DEFECTO = [
  {
    nombre: "Admin",
    permisos: Object.fromEntries(todasLasPaginas().map((id) => [id, true])),
  },
  {
    nombre: "Comercial",
    permisos: { dashboard: true, calendario: true, agenda: true, notas: true, bookings: true, catalogo: true, propuestas: true, "ver-propuestas": true, clientes: true },
  },
  {
    nombre: "Producción",
    permisos: { dashboard: true, calendario: true, agenda: true, notas: true, producciones: true, hojasderuta: true },
  },
];

(async function () {
  const perfil = await protegerPagina(["Admin"]);
  pintarNav(perfil.rol, "roles");
  document.getElementById("pass-name").textContent = nombreCompletoDe(perfil) || perfil.email;
  document.getElementById("pass-role").textContent = perfil.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (perfil.foto) {
    avatarEl.innerHTML = `<img src="${perfil.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(perfil) || perfil.email);
  }

  pintarChecksPermisos();
  await asegurarRolesPorDefecto();
  escucharRoles();
})();

// Si la colección "roles" está vacía (primera vez), sembramos los 3 roles
// que ya se usan en el login: Admin, Comercial y Producción.
async function asegurarRolesPorDefecto() {
  try {
    const snap = await db.collection("roles").limit(1).get();
    if (!snap.empty) return;

    const batch = db.batch();
    ROLES_POR_DEFECTO.forEach((r) => {
      const ref = db.collection("roles").doc();
      batch.set(ref, { ...r, protegido: true, creadoEl: firebase.firestore.FieldValue.serverTimestamp() });
    });
    await batch.commit();
  } catch (err) {
    console.error("No se pudieron sembrar los roles por defecto:", err);
  }
}

function escucharRoles() {
  db.collection("roles").orderBy("nombre").onSnapshot(
    (snap) => {
      const filas = [];
      snap.forEach((doc) => filas.push({ id: doc.id, ...doc.data() }));
      pintarTablaRoles(filas);
    },
    (err) => {
      console.error(err);
      mostrarToast("No se pudo cargar el listado de roles.");
    }
  );
}

function pintarTablaRoles(roles) {
  const tbody = document.getElementById("tabla-roles");
  document.getElementById("contador-roles").textContent = roles.length + (roles.length === 1 ? " rol" : " roles");

  if (roles.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:36px; color:var(--color-text-muted);">
      Todavía no hay roles creados.
    </td></tr>`;
    return;
  }

  const paginas = todasLasPaginas();

  tbody.innerHTML = roles
    .map((r) => {
      // Solo se cuentan las páginas (no sus pestañas internas) para el resumen.
      const activas = paginas.filter((id) => r.permisos && r.permisos[id]);
      const todoActivo = activas.length === paginas.length && paginas.length > 0;
      const tagsHtml = todoActivo
        ? `<span class="permiso-tag todo">Acceso total</span>`
        : activas.length === 0
        ? `<span class="permiso-tag">Sin permisos</span>`
        : activas.map((id) => `<span class="permiso-tag">${escaparHtmlRoles(etiquetaDePagina(id))}</span>`).join("");

      return `
        <tr>
          <td style="font-weight:600;">${escaparHtmlRoles(r.nombre)}</td>
          <td><div class="permiso-tags">${tagsHtml}</div></td>
          <td>
            <div class="row-actions" style="justify-content:flex-end;">
              <button class="icon-btn" title="Editar" onclick='abrirModalEdicionRol(${JSON.stringify(r).replace(/'/g, "&#39;")})'>✎</button>
              <button class="icon-btn danger" title="Eliminar" onclick="confirmarEliminarRol('${r.id}', '${escaparHtmlRoles(r.nombre).replace(/'/g, "\\'")}')">🗑</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function etiquetaDePagina(id) {
  for (const grupo of NAV_ESTRUCTURA) {
    const item = grupo.items.find((it) => it.id === id);
    if (item) return item.label;
  }
  return id;
}

function escaparHtmlRoles(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// ---------- Modal ----------

const formRol = document.getElementById("form-rol");
const overlayRol = document.getElementById("modal-overlay");

// Árbol: Sección > Página > (Pestañas, si esa página las tiene).
function pintarChecksPermisos(permisosActivos) {
  const cont = document.getElementById("permisos-grid");
  const p = permisosActivos || {};

  cont.innerHTML = NAV_ESTRUCTURA.map((grupo) => {
    const itemsListos = grupo.items.filter((it) => it.listo);
    if (itemsListos.length === 0) return "";

    const itemsHtml = itemsListos
      .map((it) => {
        const tabs = TABS_POR_PAGINA[it.id];
        const tabsHtml = tabs
          ? `<div style="margin-left:26px; margin-bottom:4px;">${tabs
              .map(
                (t) => `
                  <label class="permiso-check" style="padding:6px 4px; font-size:12.5px;">
                    <input type="checkbox" data-permiso="${it.id}.${t.id}" ${p[`${it.id}.${t.id}`] ? "checked" : ""} />
                    ${escaparHtmlRoles(t.label)}
                  </label>
                `
              )
              .join("")}</div>`
          : "";

        return `
          <label class="permiso-check">
            <input type="checkbox" data-permiso="${it.id}" ${p[it.id] ? "checked" : ""} onchange="alTogglePaginaRol(this)" />
            ${escaparHtmlRoles(it.label)}
          </label>
          ${tabsHtml}
        `;
      })
      .join("");

    return `
      <div style="grid-column: 1 / -1; margin-top:10px;">
        <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--color-text-muted); margin-bottom:4px;">${escaparHtmlRoles(grupo.grupo)}</div>
        ${itemsHtml}
      </div>
    `;
  }).join("");
}

// Si se desmarca una página, sus pestañas dejan de tener sentido —
// las desmarcamos también para que el permiso quede consistente.
function alTogglePaginaRol(checkbox) {
  if (checkbox.checked) return;
  const paginaId = checkbox.dataset.permiso;
  document.querySelectorAll(`#permisos-grid input[data-permiso^="${paginaId}."]`).forEach((c) => (c.checked = false));
}

function marcarTodosLosPermisos(valor) {
  document.querySelectorAll("#permisos-grid input[type=checkbox]").forEach((c) => (c.checked = valor));
}

function abrirModalRol() {
  formRol.reset();
  document.getElementById("rol-id-edicion").value = "";
  document.getElementById("modal-titulo").textContent = "Nuevo rol";
  document.getElementById("modal-sub").textContent = "Define el nombre del rol y a qué secciones puede acceder.";
  document.getElementById("btn-guardar").textContent = "Crear rol";
  pintarChecksPermisos();
  ocultarMsgModalRol();
  overlayRol.classList.add("show");
}

function abrirModalEdicionRol(r) {
  formRol.reset();
  document.getElementById("rol-id-edicion").value = r.id;
  document.getElementById("rol-nombre").value = r.nombre || "";
  document.getElementById("modal-titulo").textContent = "Editar rol";
  document.getElementById("modal-sub").textContent = "Actualiza el nombre o los permisos de este rol.";
  document.getElementById("btn-guardar").textContent = "Guardar cambios";
  pintarChecksPermisos(r.permisos || {});
  ocultarMsgModalRol();
  overlayRol.classList.add("show");
}

function cerrarModal() {
  overlayRol.classList.remove("show");
}

function ocultarMsgModalRol() {
  const m = document.getElementById("modal-msg");
  m.className = "form-msg";
  m.textContent = "";
}

function mostrarMsgModalRol(texto) {
  const m = document.getElementById("modal-msg");
  m.textContent = texto;
  m.className = "form-msg show error";
}

formRol.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("rol-id-edicion").value;
  const btn = document.getElementById("btn-guardar");
  btn.disabled = true;

  const nombre = document.getElementById("rol-nombre").value.trim();
  const permisos = {};
  document.querySelectorAll("#permisos-grid input[type=checkbox]").forEach((chk) => {
    permisos[chk.dataset.permiso] = chk.checked;
  });

  try {
    if (id) {
      await db.collection("roles").doc(id).update({ nombre, permisos });
      mostrarToast("Rol actualizado.");
    } else {
      await db.collection("roles").add({
        nombre,
        permisos,
        protegido: false,
        creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
      });
      mostrarToast("Rol creado.");
    }
    cerrarModal();
  } catch (err) {
    console.error(err);
    mostrarMsgModalRol("No se pudo guardar. Inténtalo de nuevo.");
  } finally {
    btn.disabled = false;
  }
});

// ---------- Eliminar ----------

// ---------- Sincronizar páginas nuevas ----------
// Cada vez que se añade una página nueva a la plataforma (un nuevo id
// en NAV_ESTRUCTURA), los roles que ya existían en Firestore de antes
// NO la reciben solos — su documento de permisos se queda tal cual
// estaba. El rol Admin ya se autosincroniza solo en cada login (ver
// auth.js), así que este botón ahora sirve sobre todo para el resto
// de roles: revisa todos y añade las páginas que falten (a Admin con
// acceso concedido por si acaso, al resto sin marcar, para decidir a
// mano cada caso).
async function sincronizarPaginasNuevas() {
  const btn = document.getElementById("btn-sincronizar-roles");
  btn.disabled = true;
  btn.textContent = "Sincronizando…";

  try {
    const paginas = todasLasPaginas();
    const snap = await db.collection("roles").get();
    let rolesActualizados = 0;

    for (const doc of snap.docs) {
      const rol = doc.data();
      const permisosActuales = rol.permisos || {};
      const faltantes = paginas.filter((id) => !(id in permisosActuales));
      if (faltantes.length === 0) continue;

      const esRolAdmin = rol.nombre === "Admin";
      const permisosNuevos = { ...permisosActuales };
      faltantes.forEach((id) => {
        permisosNuevos[id] = esRolAdmin; // Admin: acceso directo. Otros: sin marcar, a decidir.
      });

      await db.collection("roles").doc(doc.id).update({ permisos: permisosNuevos });
      rolesActualizados++;
    }

    mostrarToast(
      rolesActualizados > 0
        ? `${rolesActualizados} rol(es) actualizados con las páginas nuevas. Revisa los permisos de cada uno si hace falta.`
        : "Todos los roles ya estaban al día — nada que sincronizar."
    );
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo sincronizar.");
  } finally {
    btn.disabled = false;
    btn.textContent = "🔄 Sincronizar páginas nuevas";
  }
}

async function confirmarEliminarRol(id, nombre) {
  try {
    const enUso = await db.collection("usuarios").where("rol", "==", nombre).limit(1).get();
    if (!enUso.empty) {
      mostrarToast(`No se puede eliminar: hay usuarios con el rol "${nombre}". Reasígnalos primero.`);
      return;
    }
  } catch (err) {
    console.error(err);
  }

  if (!confirm(`¿Eliminar el rol "${nombre}"?`)) return;

  db.collection("roles")
    .doc(id)
    .delete()
    .then(() => mostrarToast("Rol eliminado."))
    .catch((err) => {
      console.error(err);
      mostrarToast("No se pudo eliminar el rol.");
    });
}

// ---------- Toast ----------

let toastTimerRoles;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerRoles);
  toastTimerRoles = setTimeout(() => t.classList.remove("show"), 3200);
}
