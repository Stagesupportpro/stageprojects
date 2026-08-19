// =========================================================
// STAGE SUPPORT — registro-servicio-detalle.js
// Ficha completa de un registro: información general + líneas de
// servicio (editables) + totales calculados a partir de ellas.
// =========================================================

let usuarioActualRSD = null;
let docIdRSD = null;
let clientesCacheRSD = [];
let serviciosCacheRSD = [];
let lineasRSD = []; // [{ clienteId, clienteNombre, servicioId, servicioNombre, actuacion, localizacion, fecha, importe, formaPago, nFactura }]

(async function () {
  const params = new URLSearchParams(window.location.search);
  docIdRSD = params.get("id");
  if (!docIdRSD) {
    window.location.href = "registro-servicios.html";
    return;
  }

  usuarioActualRSD = await protegerPagina();
  pintarNav(usuarioActualRSD.rol, "registro-servicios");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualRSD) || usuarioActualRSD.email;
  document.getElementById("pass-role").textContent = usuarioActualRSD.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualRSD.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualRSD.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualRSD) || usuarioActualRSD.email);
  }

  document.getElementById("rsd-link-ver").href = `registro-servicio-ver.html?id=${docIdRSD}`;

  await Promise.all([cargarClientesRSD(), cargarServiciosRSD()]);
  await cargarRegistroRSD();
})();

// ---------- Listas de apoyo ----------

async function cargarClientesRSD() {
  try {
    const snap = await db.collection("clientes").orderBy("nombre").get();
    clientesCacheRSD = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error(err);
  }
}

async function cargarServiciosRSD() {
  try {
    const snap = await db.collection("tiposServicio").orderBy("nombre").get();
    serviciosCacheRSD = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error(err);
  }
}

// ---------- Carga del registro ----------

async function cargarRegistroRSD() {
  try {
    const snap = await db.collection("registroServicios").doc(docIdRSD).get();
    if (!snap.exists) {
      mostrarToast("Este registro no existe.");
      setTimeout(() => (window.location.href = "registro-servicios.html"), 1500);
      return;
    }
    const d = snap.data();

    document.getElementById("rsd-id-badge").textContent = `${d.idVisible || "—"} · V${d.version || 1}`;
    document.getElementById("rsd-titulo-cabecera").textContent = d.nombre || "Registro";
    document.getElementById("rsd-nombre").value = d.nombre || "";
    document.getElementById("rsd-notas").value = d.notas || "";

    lineasRSD = Array.isArray(d.lineas) ? d.lineas : [];
    renderLineasRSD();
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo cargar el registro.");
  }
}

// ---------- Líneas de servicio ----------

function totalLineaRSD(l) {
  const importe = l.importe || 0;
  const iva = l.formaPago === "FRA" ? importe * 0.21 : 0;
  return importe + iva;
}

function opcionesClienteHtml(seleccionado) {
  return (
    `<option value="">— Selecciona un cliente —</option>` +
    clientesCacheRSD.map((c) => `<option value="${c.id}" ${seleccionado === c.id ? "selected" : ""}>${escaparHtmlRSD(c.nombre)}</option>`).join("")
  );
}

function opcionesServicioHtml(seleccionado) {
  return (
    `<option value="">— Selecciona un tipo de servicio —</option>` +
    serviciosCacheRSD.map((s) => `<option value="${s.id}" ${seleccionado === s.id ? "selected" : ""}>${escaparHtmlRSD(s.nombre)}</option>`).join("")
  );
}

function renderLineasRSD() {
  const cont = document.getElementById("lista-lineas-rsd");
  if (lineasRSD.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay líneas de servicio en este registro.</p>`;
  } else {
    cont.innerHTML = lineasRSD
      .map((l, i) => {
        const formaPago = l.formaPago || "";
        return `
          <div class="modalidad-card">
            <div style="display:flex; gap:10px; align-items:flex-start; margin-bottom:10px;">
              <div class="form-grid" style="flex:1;">
                <div class="field">
                  <label style="font-size:11px;">Cliente</label>
                  <select onchange="alCambiarClienteLineaRSD(${i}, this.value)">${opcionesClienteHtml(l.clienteId)}</select>
                </div>
                <div class="field">
                  <label style="font-size:11px;">Servicio</label>
                  <select onchange="alCambiarServicioLineaRSD(${i}, this.value)">${opcionesServicioHtml(l.servicioId)}</select>
                </div>
              </div>
              <button type="button" class="remove-row-btn" onclick="eliminarLineaRSD(${i})" style="margin-top:22px;">✕</button>
            </div>

            <div class="form-grid">
              <div class="field"><label style="font-size:11px;">Actuación</label><input type="text" placeholder="Ej. Concierto Sala Apolo" value="${escaparAttrRSD(l.actuacion)}" oninput="lineasRSD[${i}].actuacion=this.value" /></div>
              <div class="field"><label style="font-size:11px;">Localización</label><input type="text" placeholder="Ej. Valencia" value="${escaparAttrRSD(l.localizacion)}" oninput="lineasRSD[${i}].localizacion=this.value" /></div>
            </div>

            <div class="form-grid">
              <div class="field"><label style="font-size:11px;">Fecha</label><input type="date" value="${l.fecha || ""}" oninput="lineasRSD[${i}].fecha=this.value" /></div>
              <div class="field"><label style="font-size:11px;">Importe (BI) €</label><input type="number" min="0" step="0.01" value="${l.importe != null ? l.importe : ""}" oninput="lineasRSD[${i}].importe=this.value===''?0:parseFloat(this.value); actualizarTotalLineaRSD(${i})" /></div>
            </div>

            <label style="font-size:11px; font-weight:600; display:block; margin:10px 0 6px;">Forma de pago</label>
            <div class="origen-toggle" style="margin-bottom:0;">
              <label><input type="radio" name="rsd-forma-pago-${i}" value="" ${formaPago === "" ? "checked" : ""} onchange="alCambiarFormaPagoLineaRSD(${i}, '')" />Pendiente</label>
              <label><input type="radio" name="rsd-forma-pago-${i}" value="FRA" ${formaPago === "FRA" ? "checked" : ""} onchange="alCambiarFormaPagoLineaRSD(${i}, 'FRA')" />Factura</label>
              <label><input type="radio" name="rsd-forma-pago-${i}" value="EF" ${formaPago === "EF" ? "checked" : ""} onchange="alCambiarFormaPagoLineaRSD(${i}, 'EF')" />Efectivo</label>
            </div>

            ${
              formaPago === "FRA"
                ? `<div class="field" style="margin-top:10px;"><label style="font-size:11px;">Número de factura</label><input type="text" placeholder="Ej. F2026-014" value="${escaparAttrRSD(l.nFactura)}" oninput="lineasRSD[${i}].nFactura=this.value" /></div>`
                : ""
            }

            <div class="calc-box" style="margin-top:12px;">
              <div class="calc-item calc-total"><div class="calc-label">Total línea</div><div class="calc-value" id="linea-total-${i}">${formatoEuroRSD(totalLineaRSD(l))}</div></div>
            </div>
          </div>
        `;
      })
      .join("");
  }
  recalcularTotalesRSD();
}

function alCambiarClienteLineaRSD(i, clienteId) {
  const c = clientesCacheRSD.find((x) => x.id === clienteId);
  lineasRSD[i].clienteId = clienteId || null;
  lineasRSD[i].clienteNombre = c ? c.nombre : "";
}

function alCambiarServicioLineaRSD(i, servicioId) {
  const s = serviciosCacheRSD.find((x) => x.id === servicioId);
  lineasRSD[i].servicioId = servicioId || null;
  lineasRSD[i].servicioNombre = s ? s.nombre : "";
  if (s && s.tarifa != null && !lineasRSD[i].importe) {
    lineasRSD[i].importe = s.tarifa;
  }
  renderLineasRSD();
}

function alCambiarFormaPagoLineaRSD(i, valor) {
  lineasRSD[i].formaPago = valor || null;
  renderLineasRSD();
}

function actualizarTotalLineaRSD(i) {
  const el = document.getElementById(`linea-total-${i}`);
  if (el) el.textContent = formatoEuroRSD(totalLineaRSD(lineasRSD[i]));
  recalcularTotalesRSD();
}

function anadirLineaRSD() {
  lineasRSD.push({
    clienteId: null,
    clienteNombre: "",
    servicioId: null,
    servicioNombre: "",
    actuacion: "",
    localizacion: "",
    fecha: "",
    importe: 0,
    formaPago: null,
    nFactura: "",
  });
  renderLineasRSD();
}

function eliminarLineaRSD(i) {
  lineasRSD.splice(i, 1);
  renderLineasRSD();
}

// ---------- Totales del registro ----------

function recalcularTotalesRSD() {
  const totalEfectivo = lineasRSD.filter((l) => l.formaPago === "EF").reduce((sum, l) => sum + (l.importe || 0), 0);
  const totalFactura = lineasRSD.filter((l) => l.formaPago === "FRA").reduce((sum, l) => sum + (l.importe || 0), 0);
  const totalPendiente = lineasRSD.filter((l) => !l.formaPago).reduce((sum, l) => sum + (l.importe || 0), 0);
  const iva = totalFactura * 0.21;
  const totalPagar = totalEfectivo + totalFactura + iva + totalPendiente;

  document.getElementById("rsd-total-efectivo").textContent = formatoEuroRSD(totalEfectivo);
  document.getElementById("rsd-total-factura").textContent = formatoEuroRSD(totalFactura);
  document.getElementById("rsd-total-iva").textContent = formatoEuroRSD(iva);
  document.getElementById("rsd-total-pendiente").textContent = formatoEuroRSD(totalPendiente);
  document.getElementById("rsd-total-pagar").textContent = formatoEuroRSD(totalPagar);
}

// ---------- Guardar ----------

async function guardarRS() {
  const nombre = document.getElementById("rsd-nombre").value.trim();
  if (!nombre) {
    mostrarToast("Ponle un nombre al registro antes de guardar.");
    return;
  }

  const datos = {
    nombre,
    notas: document.getElementById("rsd-notas").value.trim(),
    lineas: lineasRSD,
  };

  try {
    await db.collection("registroServicios").doc(docIdRSD).update(datos);
    document.getElementById("rsd-titulo-cabecera").textContent = nombre;
    mostrarToast("Registro guardado.");
  } catch (err) {
    console.error(err);
    mostrarToast(`No se pudo guardar: ${err.code || ""} ${err.message || err}`.trim());
  }
}

// ---------- Utilidades ----------

function formatoEuroRSD(n) {
  return Number(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function escaparHtmlRSD(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function escaparAttrRSD(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// ---------- Toast ----------

let toastTimerRSD;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerRSD);
  toastTimerRSD = setTimeout(() => t.classList.remove("show"), 3200);
}
