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
    const mostrarPrecios = d.mostrarPrecios !== false;

    if (items.length === 0) {
      cont.innerHTML = `<div class="empty-state"><strong>Todavía no hay opciones en esta propuesta</strong></div>`;
      return;
    }

    cont.innerHTML = items
      .map((it) => {
        const metaPartes = [];
        if (it.fecha) metaPartes.push(new Date(it.fecha + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }));
        if (it.ciclo) metaPartes.push(escaparHtmlPV(it.ciclo));
        const metaHtml = metaPartes.length ? `<p class="pv-meta">${metaPartes.join(" · ")}</p>` : "";

        let precioHtml = "";
        if (mostrarPrecios) {
          const pvp = (it.bi || 0) * (1 + (it.comisionPct || 0) / 100);
          const total = pvp * (1 + (it.ivaPct || 0) / 100);
          if (pvp > 0) {
            precioHtml = `
              <div class="pv-precio-box">
                <span>PVP: <strong>${pvp.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</strong></span>
                <span>IVA (${it.ivaPct || 0}%): <strong>${(total - pvp).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</strong></span>
                <span class="pv-precio">Total: ${total.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
              </div>
            `;
          }
        }

        return `
          <div class="pv-item">
            ${it.imagen ? `<img src="${it.imagen}" alt="" />` : ""}
            <div class="pv-item-body">
              <h2>${escaparHtmlPV(it.nombre)}</h2>
              ${metaHtml}
              ${it.descripcion ? `<p class="pv-desc">${escaparHtmlPV(it.descripcion)}</p>` : ""}
              ${precioHtml}
            </div>
          </div>
        `;
      })
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
