// =========================================================
// STAGE SUPPORT — propuesta-ver.js
// Vista limpia (sin menú) para mostrar la propuesta desde un
// dispositivo delante del cliente. Requiere sesión iniciada
// (el empleado abre esto ya logueado en su propio dispositivo).
// =========================================================

(async function () {
  await protegerPagina(); // cualquier rol con acceso activo

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) return;

  try {
    const snap = await db.collection("propuestas").doc(id).get();
    if (!snap.exists) {
      document.getElementById("pv-nombre").textContent = "Propuesta no encontrada";
      return;
    }
    const d = snap.data();

    document.getElementById("pv-nombre").textContent = d.nombre || "Propuesta";
    document.getElementById("pv-subtitulo").textContent = d.clienteNombre
      ? `Preparada para ${d.clienteNombre}`
      : "";

    const cont = document.getElementById("pv-items");
    const items = Array.isArray(d.items) ? d.items : [];

    if (items.length === 0) {
      cont.innerHTML = `<div class="empty-state"><strong>Todavía no hay opciones en esta propuesta</strong></div>`;
      return;
    }

    cont.innerHTML = items
      .map(
        (it) => `
          <div class="pv-item">
            ${it.imagen ? `<img src="${it.imagen}" alt="" />` : ""}
            <div class="pv-item-body">
              <h2>${escaparHtmlPV(it.nombre)}</h2>
              ${it.descripcion ? `<p class="pv-desc">${escaparHtmlPV(it.descripcion)}</p>` : ""}
              ${it.precio != null ? `<span class="pv-precio">${Number(it.precio).toLocaleString("es-ES")} €</span>` : ""}
            </div>
          </div>
        `
      )
      .join("");
  } catch (err) {
    console.error(err);
    document.getElementById("pv-nombre").textContent = "No se pudo cargar la propuesta";
  }
})();

function escaparHtmlPV(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}
