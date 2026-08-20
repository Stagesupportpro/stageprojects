// =========================================================
// STAGE SUPPORT — registro-servicio-ver.js
// Ficha de solo lectura de un registro (con todas sus líneas de
// servicio y los totales), con exportar a PDF e imprimir (logo de
// documentos + fecha/hora de creación en el pie, igual que en
// Hojas de Ruta y Contratos).
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

function totalLineaRV(l) {
  const importe = l.importe || 0;
  const iva = l.formaPago === "FRA" ? importe * 0.21 : 0;
  return importe + iva;
}

function textoFormaPagoRV(formaPago) {
  return formaPago === "FRA" ? "Factura" : formaPago === "EF" ? "Efectivo" : "Pendiente";
}

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
    document.getElementById("rv-titulo-cabecera").textContent = d.nombre || "Registro de servicio";
    document.getElementById("rv-cliente-cabecera").textContent = d.clienteNombre ? `Cliente: ${d.clienteNombre}` : "";

    const lineas = Array.isArray(d.lineas) ? d.lineas : [];

    document.getElementById("rv-tabla-lineas").innerHTML = lineas.length
      ? lineas
          .map((l) => {
            const fecha = l.fecha ? new Date(l.fecha + "T00:00:00").toLocaleDateString("es-ES") : "—";
            return `
              <tr>
                <td>${escaparHtmlRV(l.servicioNombre || "—")}</td>
                <td>${escaparHtmlRV(l.actuacion || "—")}</td>
                <td>${escaparHtmlRV(l.localizacion || "—")}</td>
                <td>${fecha}</td>
                <td>${formatoEuroRV(l.importe)}</td>
                <td><span class="estado-pago-badge ${l.formaPago === "FRA" ? "FRA" : l.formaPago === "EF" ? "EF" : "pendiente"}">${textoFormaPagoRV(l.formaPago)}${l.formaPago === "FRA" && l.nFactura ? ` (${escaparHtmlRV(l.nFactura)})` : ""}</span></td>
                <td style="font-weight:600;">${formatoEuroRV(totalLineaRV(l))}</td>
              </tr>
            `;
          })
          .join("")
      : `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--color-text-muted);">Este registro todavía no tiene líneas de servicio.</td></tr>`;

    const totalEfectivo = lineas.filter((l) => l.formaPago === "EF").reduce((sum, l) => sum + (l.importe || 0), 0);
    const totalFactura = lineas.filter((l) => l.formaPago === "FRA").reduce((sum, l) => sum + (l.importe || 0), 0);
    const totalPendiente = lineas.filter((l) => !l.formaPago).reduce((sum, l) => sum + (l.importe || 0), 0);
    const iva = totalFactura * 0.21;
    const totalPagar = totalEfectivo + totalFactura + iva + totalPendiente;

    document.getElementById("rv-total-efectivo").textContent = formatoEuroRV(totalEfectivo);
    document.getElementById("rv-total-factura").textContent = formatoEuroRV(totalFactura);
    document.getElementById("rv-total-iva").textContent = formatoEuroRV(iva);
    document.getElementById("rv-total-pendiente").textContent = formatoEuroRV(totalPendiente);
    document.getElementById("rv-total-pagar").textContent = formatoEuroRV(totalPagar);

    document.getElementById("rv-observaciones").textContent = d.notas || d.observaciones || "—";
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
  const lineas = Array.isArray(d.lineas) ? d.lineas : [];
  const ahora = new Date().toLocaleString("es-ES");

  const totalEfectivo = lineas.filter((l) => l.formaPago === "EF").reduce((sum, l) => sum + (l.importe || 0), 0);
  const totalFactura = lineas.filter((l) => l.formaPago === "FRA").reduce((sum, l) => sum + (l.importe || 0), 0);
  const totalPendiente = lineas.filter((l) => !l.formaPago).reduce((sum, l) => sum + (l.importe || 0), 0);
  const iva = totalFactura * 0.21;
  const totalPagar = totalEfectivo + totalFactura + iva + totalPendiente;

  const filasHtml = lineas
    .map((l) => {
      const fecha = l.fecha ? new Date(l.fecha + "T00:00:00").toLocaleDateString("es-ES") : "—";
      return `
        <tr>
          <td>${escaparHtmlRV(l.servicioNombre || "—")}</td>
          <td>${escaparHtmlRV(l.actuacion || "—")}</td>
          <td>${fecha}</td>
          <td>${formatoEuroRV(l.importe)}</td>
          <td>${textoFormaPagoRV(l.formaPago)}</td>
          <td>${formatoEuroRV(totalLineaRV(l))}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="doc-page">
      <div class="doc-header">
        <img class="doc-logo" src="${logoDocumentoEmpresaRV || "assets/logo_stagesupport.png"}" onerror="this.style.display='none'" />
      </div>
      <div class="doc-title-block">
        <h1>${escaparHtmlRV(d.nombre || "Registro de servicio")}</h1>
        <div class="doc-id-text">${escaparHtmlRV(d.idVisible)} · V${d.version || 1}${d.clienteNombre ? ` · Cliente: ${escaparHtmlRV(d.clienteNombre)}` : ""}</div>
      </div>

      <table class="doc-table">
        <tr><th class="doc-section-title" colspan="6">LÍNEAS DE SERVICIO</th></tr>
        <tr><th>Servicio</th><th>Actuación</th><th>Fecha</th><th>Importe</th><th>Forma de pago</th><th>Total</th></tr>
        ${filasHtml}
      </table>

      <table class="doc-table">
        <tr><th class="doc-section-title" colspan="2">TOTALES</th></tr>
        <tr><td class="label">Total Efectivo</td><td>${formatoEuroRV(totalEfectivo)}</td></tr>
        <tr><td class="label">Total Factura (BI)</td><td>${formatoEuroRV(totalFactura)}</td></tr>
        <tr><td class="label">IVA (21%, solo factura)</td><td>${formatoEuroRV(iva)}</td></tr>
        <tr><td class="label">Total Pendiente</td><td>${formatoEuroRV(totalPendiente)}</td></tr>
        <tr><td class="label"><strong>Importe a pagar</strong></td><td><strong>${formatoEuroRV(totalPagar)}</strong></td></tr>
      </table>

      ${(d.notas || d.observaciones) ? `<table class="doc-table"><tr><th class="doc-section-title">OBSERVACIONES</th></tr><tr><td>${escaparHtmlRV(d.notas || d.observaciones)}</td></tr></table>` : ""}

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

  const nombreArchivo = `${registroActualRV.idVisible}_${(registroActualRV.nombre || "registro-servicio").replace(/[^\w\- ]/g, "").trim()}.pdf`;

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
