// =========================================================
// STAGE SUPPORT — catalogo.js
// Lee la misma colección "roster" que Booking & Management, pero
// solo pinta los campos de venta (nombre, cartel, descripción,
// redes). Nunca toca ni muestra cache/comisionPorcentaje/ivaPorcentaje.
// =========================================================

let usuarioActualCat = null;
let catalogoCache = [];

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
        // Deliberadamente NO se incluyen cache / comisionPorcentaje / ivaPorcentaje / tarifas.
      }));
      pintarCatalogo();
    },
    (err) => {
      console.error(err);
      mostrarToast("No se pudo cargar el catálogo.");
    }
  );
}

function pintarCatalogo() {
  const grid = document.getElementById("catalogo-grid");
  if (catalogoCache.length === 0) {
    grid.innerHTML = `<div class="empty-state"><strong>Todavía no hay nada en el Roster</strong>Añade espectáculos desde Booking &amp; Management → Roster.</div>`;
    return;
  }

  grid.innerHTML = catalogoCache
    .map(
      (r) => `
        <div class="catalogo-card" onclick="abrirModalCatalogo('${r.id}')">
          ${r.imagenCartel ? `<img class="cat-imagen" src="${r.imagenCartel}" alt="" />` : `<div class="cat-imagen-placeholder">${escaparHtmlCat(inicialesDe(r.nombre))}</div>`}
          <div class="cat-info">
            <div class="cat-nombre">${escaparHtmlCat(r.nombre)}</div>
            <div class="cat-oficina">${escaparHtmlCat(r.oficinaRepresentacion || "")}</div>
          </div>
        </div>
      `
    )
    .join("");
}

function abrirModalCatalogo(id) {
  const r = catalogoCache.find((x) => x.id === id);
  if (!r) return;

  document.getElementById("cat-modal-nombre").textContent = r.nombre || "";
  document.getElementById("cat-modal-oficina").textContent = r.oficinaRepresentacion || "";
  document.getElementById("cat-modal-descripcion").textContent = r.descripcionComercial || "Sin descripción todavía.";

  const img = document.getElementById("cat-modal-imagen");
  if (r.imagenCartel) {
    img.src = r.imagenCartel;
    img.style.display = "block";
  } else {
    img.style.display = "none";
  }

  const redes = Array.isArray(r.redesSociales) ? r.redesSociales : [];
  document.getElementById("cat-modal-redes").innerHTML = redes
    .filter((x) => x.url)
    .map((x) => `<a href="${x.url}" target="_blank" rel="noopener">${escaparHtmlCat(x.plataforma || "Enlace")}</a>`)
    .join("");

  document.getElementById("cat-modal-overlay").classList.add("show");
}

function cerrarModalCatalogo() {
  document.getElementById("cat-modal-overlay").classList.remove("show");
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
