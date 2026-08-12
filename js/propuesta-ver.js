// =========================================================
// STAGE SUPPORT — propuesta-ver.js
// Vista de la propuesta en "modo cliente", con una barra de staff
// arriba (visible solo estando logueado) para exportar a PDF o
// mandarla a evaluar. Requiere sesión iniciada.
// =========================================================

let usuarioActualPV = null;
let propuestaActualPV = null;
let docIdPV = null;

(async function () {
  usuarioActualPV = await protegerPagina(); // cualquier rol con acceso activo

  const params = new URLSearchParams(window.location.search);
  docIdPV = params.get("id");
  if (!docIdPV) return;

  try {
    const snap = await db.collection("propuestas").doc(docIdPV).get();
    if (!snap.exists) {
      document.getElementById("pv-nombre").textContent = "Propuesta no encontrada";
      return;
    }
    const d = snap.data();
    propuestaActualPV = { id: docIdPV, ...d };

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

// ---------- Exportar a PDF ----------

function exportarPdfPropuesta() {
  if (!propuestaActualPV) return;
  const btn = document.getElementById("btn-pdf-propuesta");
  btn.disabled = true;
  btn.textContent = "Generando…";

  const nombreArchivo = `${propuestaActualPV.idVisible || "propuesta"}_${(propuestaActualPV.nombre || "").replace(/[^\w\- ]/g, "").trim()}.pdf`;

  html2pdf()
    .from(document.getElementById("pv-content"))
    .set({
      margin: 10,
      filename: nombreArchivo,
      html2canvas: { scale: 2, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    })
    .save()
    .then(() => {
      btn.disabled = false;
      btn.textContent = "📄 Exportar PDF";
    })
    .catch((err) => {
      console.error(err);
      mostrarToast("No se pudo generar el PDF.");
      btn.disabled = false;
      btn.textContent = "📄 Exportar PDF";
    });
}

// ---------- Enviar a evaluar ----------

async function enviarAEvaluarPropuesta() {
  if (!propuestaActualPV) return;
  const btn = document.getElementById("btn-evaluar-propuesta");
  btn.disabled = true;

  const enlace = `${window.location.origin}${window.location.pathname}?id=${docIdPV}`;

  try {
    await db.collection("evaluaciones").add({
      propuestaId: docIdPV,
      propuestaIdVisible: propuestaActualPV.idVisible || "",
      propuestaNombre: propuestaActualPV.nombre || "",
      clienteNombre: propuestaActualPV.clienteNombre || "",
      enlace,
      estado: "Pendiente",
      comentario: "",
      solicitadoPor: nombreCompletoDe(usuarioActualPV) || usuarioActualPV.email,
      solicitadoPorUid: usuarioActualPV.uid,
      solicitadoEl: firebase.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("propuestas").doc(docIdPV).update({ estado: "Enviada" });

    try {
      await navigator.clipboard.writeText(enlace);
      mostrarToast("Marcada como enviada. Enlace de evaluación copiado al portapapeles.");
    } catch (errClip) {
      mostrarToast(`Marcada como enviada. Enlace: ${enlace}`);
    }
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo registrar el envío a evaluar.");
  } finally {
    btn.disabled = false;
  }
}

// ---------- Toast ----------

let toastTimerPV;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerPV);
  toastTimerPV = setTimeout(() => t.classList.remove("show"), 3200);
}
