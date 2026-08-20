// =========================================================
// STAGE SUPPORT — catalogo.js
// Lee la misma colección "roster" que Booking & Management, pero
// solo pinta los campos de venta (nombre, cartel, descripción,
// redes). Nunca toca ni muestra cache/comisionPorcentaje/ivaPorcentaje.
// =========================================================

let usuarioActualCat = null;
let catalogoCache = [];
let filtrosActivosCat = new Set(); // valores tipo "cat:Artistas" o "tag:Rock"

(async function () {
  usuarioActualCat = await protegerPagina(["Comercial", "Admin"]);
  pintarNav(usuarioActualCat.rol, "catalogo");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualCat) || usuarioActualCat.email;
  document.getElementById("pass-role").textContent = usuarioActualCat.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualCat.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualCat.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualCat) || usuarioActualCat.email);
  }

  cargarCatalogo();
})();

function cargarCatalogo() {
  db.collection("roster").orderBy("nombre").onSnapshot(
    (snap) => {
      catalogoCache = snap.docs.map((d) => ({
        id: d.id,
        nombre: d.data().nombre,
        oficinaRepresentacion: d.data().oficinaRepresentacion,
        imagenCartel: d.data().imagenCartel,
        descripcionComercial: d.data().descripcionComercial,
        redesSociales: d.data().redesSociales,
        categoria: d.data().categoria,
        camposExtra: d.data().camposExtra,
        etiquetas: d.data().etiquetas,
        galeria: d.data().galeria,
        videosYoutube: d.data().videosYoutube,
        // Deliberadamente NO se incluyen cache / comisionPorcentaje / ivaPorcentaje / tarifas.
      }));
      pintarFiltrosCatalogo();
      pintarCatalogo();
    },
    (err) => {
      console.error(err);
      mostrarToast("No se pudo cargar el catálogo.");
    }
  );
}

function pintarFiltrosCatalogo() {
  const cont = document.getElementById("catalogo-filtros");
  const categorias = new Set();
  const etiquetas = new Set();
  catalogoCache.forEach((r) => {
    if (r.categoria) categorias.add(r.categoria);
    (r.etiquetas || []).forEach((e) => etiquetas.add(e));
  });

  if (categorias.size === 0 && etiquetas.size === 0) {
    cont.innerHTML = "";
    return;
  }

  const chip = (valor, label) => `
    <button type="button" class="filter-chip ${filtrosActivosCat.has(valor) ? "active" : ""}" onclick="toggleFiltroCatalogo('${valor}')">${escaparHtmlCat(label)}</button>
  `;

  cont.innerHTML =
    [...categorias].map((c) => chip(`cat:${c}`, c)).join("") + [...etiquetas].map((e) => chip(`tag:${e}`, e)).join("");
}

function toggleFiltroCatalogo(valor) {
  if (filtrosActivosCat.has(valor)) {
    filtrosActivosCat.delete(valor);
  } else {
    filtrosActivosCat.add(valor);
  }
  pintarFiltrosCatalogo();
  pintarCatalogo();
}

function pasaFiltrosCatalogo(r) {
  const texto = (document.getElementById("cat-busqueda").value || "").trim().toLowerCase();
  if (texto) {
    const enTexto = `${r.nombre || ""} ${r.oficinaRepresentacion || ""}`.toLowerCase();
    if (!enTexto.includes(texto)) return false;
  }
  if (filtrosActivosCat.size === 0) return true;
  for (const valor of filtrosActivosCat) {
    if (valor.startsWith("cat:") && r.categoria === valor.slice(4)) return true;
    if (valor.startsWith("tag:") && (r.etiquetas || []).includes(valor.slice(4))) return true;
  }
  return false;
}

function pintarCatalogo() {
  const grid = document.getElementById("catalogo-grid");
  const items = catalogoCache.filter(pasaFiltrosCatalogo);

  if (catalogoCache.length === 0) {
    grid.innerHTML = `<div class="empty-state"><strong>Todavía no hay nada en el Roster</strong>Añade espectáculos desde Booking &amp; Management → Roster.</div>`;
    return;
  }
  if (items.length === 0) {
    grid.innerHTML = `<div class="empty-state"><strong>Nada con estos filtros</strong>Prueba a quitar alguno.</div>`;
    return;
  }

  grid.innerHTML = items
    .map(
      (r) => `
        <div class="catalogo-card" onclick="window.location.href='catalogo-producto.html?id=${r.id}'">
          ${r.imagenCartel ? `<img class="cat-imagen" src="${r.imagenCartel}" alt="" />` : `<div class="cat-imagen-placeholder">${escaparHtmlCat(inicialesDe(r.nombre))}</div>`}
          <div class="cat-info">
            <div class="cat-nombre">${escaparHtmlCat(r.nombre)}</div>
            ${r.categoria ? `<span class="categoria-badge">${escaparHtmlCat(r.categoria)}</span>` : ""}
            <div class="cat-oficina">${escaparHtmlCat(r.oficinaRepresentacion || "")}</div>
          </div>
        </div>
      `
    )
    .join("");
}

function escaparHtmlCat(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// ---------- Toast ----------

let toastTimerCat;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerCat);
  toastTimerCat = setTimeout(() => t.classList.remove("show"), 3200);
}
