// =========================================================
// STAGE SUPPORT — registro-servicio-ver.js
// Ficha de solo lectura de un registro de servicio, con
// exportar a PDF e imprimir (logo de documentos + fecha/hora de
// creación en el pie, igual que en Hojas de Ruta y Contratos).
// =========================================================

let usuarioActualRV = null;
let docIdRV = null;
let registroActualRV = null;
let logoDocumentoEmpresaRV = null;

(async function () {
  usuarioActualRV = await protegerPagina();
  pintarNav(usuarioActualRV.rol, "registro-servicios");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualRV) || usuarioActualRV.email;
  document.getElementById("pass-role").textContent = usuarioActualRV.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualRV.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualRV.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualRV) || usuarioActualRV.email);
  }

  const params = new URLSearchParams(window.location.search);
  docIdRV = params.get("id");
  if (!docIdRV) {
    window.location.href = "registro-servicios.html";
    return;
  }

  try {
    const snapEmpresa = await db.collection("configuracion").doc("empresa").get();
    if (snapEmpresa.exists) logoDocumentoEmpresaRV = snapEmpresa.data().logoDocumentos || null;
  } catch (errLogo) {
    console.error(errLogo);
  }

  await cargarRegistroRV();
})();

async function cargarRegistroRV() {
  try {
    const snap = await db.collection("registroServicios").doc(docIdRV).get();
    if (!snap.exists) {
      mostrarToast("Este registro no existe.");
      setTimeout(() => (window.location.href = "registro-servicios.html"), 1500);
      return;
    }
    const d = snap.data();
    registroActualRV = d;

    document.getElementById("rv-id-badge").textContent = `${d.idVisible || "—"} · V${d.version || 1}`;
    document.getElementById("rv-titulo-cabecera").textContent = d.clienteNombre || "Registro de servicio";

    const fecha = d.fecha ? new Date(d.fecha + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) : "—";
    const importe = d.importe || 0;
    const iva = d.formaPago === "FRA" ? importe * 0.21 : 0;
    const total = importe + iva;

    document.getElementById("rv-cliente").textContent = d.clienteNombre || "—";
    document.getElementById("rv-servicio").textContent = d.servicioNombre || "—";
    document.getElementById("rv-actuacion").textContent = d.actuacion || "—";
    document.getElementById("rv-localizacion").textContent = d.localizacion || "—";
    document.getElementById("rv-fecha").textContent = fecha;
    document.getElementById("rv-importe").textContent = formatoEuroRV(importe);
    document.getElementById("rv-iva").textContent = d.formaPago === "FRA" ? formatoEuroRV(iva) : "No aplica";
    document.getElementById("rv-total").textContent = formatoEuroRV(total);

    const formaPagoTexto = d.formaPago === "FRA" ? "Factura" : d.formaPago === "EF" ? "Efectivo" : "Pendiente de confirmar";
    document.getElementById("rv-forma-pago").textContent = formaPagoTexto;

    if (d.formaPago === "FRA" && d.nFactura) {
      document.getElementById("fila-rv-nfactura").style.display = "grid";
      document.getElementById("rv-nfactura").textContent = d.nFactura;
    }

    document.getElementById("rv-observaciones").textContent = d.observaciones || "—";
    document.getElementById("rv-creado").textContent = d.creadoEl && d.creadoEl.toDate ? d.creadoEl.toDate().toLocaleString("es-ES") : "—";
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo cargar el registro.");
  }
}

function formatoEuroRV(n) {
  return Number(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function escaparHtmlRV(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// ---------- Documento imprimible / PDF ----------

function construirHtmlImprimibleRS() {
  const d = registroActualRV;
  const fecha = d.fecha ? new Date(d.fecha + "T00:00:00").toLocaleDateString("es-ES") : "—";
  const importe = d.importe || 0;
  const iva = d.formaPago === "FRA" ? importe * 0.21 : 0;
  const total = importe + iva;
  const formaPagoTexto = d.formaPago === "FRA" ? "Factura" : d.formaPago === "EF" ? "Efectivo" : "Pendiente de confirmar";
  const ahora = new Date().toLocaleString("es-ES");

  return `
    <div class="doc-page">
      <div class="doc-header">
        <img class="doc-logo" src="${logoDocumentoEmpresaRV || "assets/logo_stagesupport.png"}" onerror="this.style.display='none'" />
      </div>
      <div class="doc-title-block">
        <h1>Registro de servicio</h1>
        <div class="doc-id-text">${escaparHtmlRV(d.idVisible)} · V${d.version || 1}</div>
      </div>

      <table class="doc-table">
        <tr><th class="doc-section-title" colspan="4">DATOS DEL SERVICIO</th></tr>
        <tr>
          <td class="label">Cliente</td><td>${escaparHtmlRV(d.clienteNombre)}</td>
          <td class="label">Servicio</td><td>${escaparHtmlRV(d.servicioNombre)}</td>
        </tr>
        <tr>
          <td class="label">Actuación</td><td>${escaparHtmlRV(d.actuacion || "—")}</td>
          <td class="label">Localización</td><td>${escaparHtmlRV(d.localizacion || "—")}</td>
        </tr>
        <tr>
          <td class="label">Fecha</td><td>${fecha}</td>
          <td class="label">Forma de pago</td><td>${formaPagoTexto}${d.formaPago === "FRA" && d.nFactura ? ` (${escaparHtmlRV(d.nFactura)})` : ""}</td>
        </tr>
      </table>

      <table class="doc-table">
        <tr><th class="doc-section-title" colspan="2">IMPORTE</th></tr>
        <tr><td class="label">Importe (BI)</td><td>${formatoEuroRV(importe)}</td></tr>
        <tr><td class="label">IVA (21%)</td><td>${d.formaPago === "FRA" ? formatoEuroRV(iva) : "No aplica"}</td></tr>
        <tr><td class="label"><strong>Total</strong></td><td><strong>${formatoEuroRV(total)}</strong></td></tr>
      </table>

      ${d.observaciones ? `<table class="doc-table"><tr><th class="doc-section-title">OBSERVACIONES</th></tr><tr><td>${escaparHtmlRV(d.observaciones)}</td></tr></table>` : ""}

      <div class="doc-footer-note">Generado por Stage Support - ${ahora}</div>
    </div>
  `;
}

function imprimirRS() {
  if (!registroActualRV) return;
  document.getElementById("print-area").innerHTML = construirHtmlImprimibleRS();
  setTimeout(() => window.print(), 50);
}

function descargarPdfRS() {
  if (!registroActualRV) return;
  const printArea = document.getElementById("print-area");
  printArea.innerHTML = construirHtmlImprimibleRS();
  printArea.style.display = "block";

  const nombreArchivo = `${registroActualRV.idVisible}_${(registroActualRV.clienteNombre || "registro-servicio").replace(/[^\w\- ]/g, "").trim()}.pdf`;

  html2pdf()
    .from(printArea)
    .set({
      margin: 10,
      filename: nombreArchivo,
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    })
    .save()
    .then(() => {
      printArea.style.display = "none";
    });
}

// ---------- Toast ----------

let toastTimerRV;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerRV);
  toastTimerRV = setTimeout(() => t.classList.remove("show"), 3200);
}
