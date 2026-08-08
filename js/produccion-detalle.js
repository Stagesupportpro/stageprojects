// =========================================================
// STAGE SUPPORT — produccion-detalle.js
// Colección: /producciones/{id} → { idVisible, nombre, pmTipo, pmId,
//   pmNombre, fecha, notas, bookingId,
//   costes[] ({concepto, importe}),
//   ingresoTipo ('aforo'|'fijo'), aforo, precioEntrada, ingresoFijo,
//   documentos[] ({nombre, tamano, data}),
//   hospitalidad[] ({nombre, precio, comprado}) }
// =========================================================

let usuarioActualPD = null;
let docIdProd = null;
let opcionesPMProd = [];
let bookingsCacheProd = [];
let costesProd = [];
let documentosProd = [];
let hospitalidadProd = [];
let bookingVinculado = null;

const LIMITE_PDF_BYTES_PD = 600 * 1024;

(async function () {
  const params = new URLSearchParams(window.location.search);
  docIdProd = params.get("id");
  if (!docIdProd) {
    window.location.href = "producciones.html";
    return;
  }

  usuarioActualPD = await protegerPagina(["Producción", "Admin"]);
  pintarNav(usuarioActualPD.rol, "producciones");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualPD) || usuarioActualPD.email;
  document.getElementById("pass-role").textContent = usuarioActualPD.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualPD.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualPD.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualPD) || usuarioActualPD.email);
  }

  await Promise.all([cargarOpcionesPMProd(), cargarBookingsProd()]);
  await cargarProduccion();
})();

// ---------- Pestañas ----------

function cambiarTabProd(tab) {
  document.querySelectorAll("#pd-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".rst-tab-panel").forEach((p) => p.classList.remove("active"));
  document.getElementById(`pd-panel-${tab}`).classList.add("active");
}

// ---------- Opciones de apoyo ----------

async function cargarOpcionesPMProd() {
  opcionesPMProd = [];
  const sel = document.getElementById("pd-pm");
  try {
    const [snapUsuarios, snapPersonal] = await Promise.all([
      db.collection("usuarios").orderBy("nombre").get(),
      db.collection("personal").orderBy("nombre").get(),
    ]);
    const grupos = [];
    if (!snapUsuarios.empty) {
      const opts = snapUsuarios.docs.map((d) => {
        const u = d.data();
        const nombre = nombreCompletoDe(u) || u.email;
        opcionesPMProd.push({ tipo: "usuario", id: d.id, nombre });
        return `<option value="usuario:${d.id}">${nombre}</option>`;
      });
      grupos.push(`<optgroup label="Empleados">${opts.join("")}</optgroup>`);
    }
    if (!snapPersonal.empty) {
      const opts = snapPersonal.docs.map((d) => {
        const p = d.data();
        const nombre = [p.nombre, p.apellidos].filter(Boolean).join(" ");
        opcionesPMProd.push({ tipo: "personal", id: d.id, nombre });
        return `<option value="personal:${d.id}">${nombre}</option>`;
      });
      grupos.push(`<optgroup label="Bolsa de personal">${opts.join("")}</optgroup>`);
    }
    sel.innerHTML = grupos.join("") || `<option value="">No hay opciones</option>`;
  } catch (err) {
    console.error(err);
  }
}

async function cargarBookingsProd() {
  const sel = document.getElementById("pd-booking");
  try {
    const snap = await db.collection("bookings").where("tipo", "==", "promotor").orderBy("creadoEl", "desc").get();
    bookingsCacheProd = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const opciones = bookingsCacheProd
      .map((b) => `<option value="${b.id}">${escaparHtmlPD(b.idVisible)} — ${escaparHtmlPD(b.artistaNombre)} @ ${escaparHtmlPD(b.espacio || "")}</option>`)
      .join("");
    sel.innerHTML = `<option value="">— Sin vincular —</option>${opciones}`;
  } catch (err) {
    console.error(err);
  }
}

function alVincularBookingProd() {
  const id = document.getElementById("pd-booking").value;
  bookingVinculado = bookingsCacheProd.find((b) => b.id === id) || null;
  document.getElementById("btn-importar-venue").style.display = bookingVinculado ? "inline-flex" : "none";
  document.getElementById("pd-btn-tab-taquilla").style.display = bookingVinculado ? "block" : "none";
  if (!bookingVinculado && document.getElementById("pd-panel-taquilla").classList.contains("active")) {
    cambiarTabProd("general");
  }
}

function importarCosteVenueProd() {
  if (!bookingVinculado) return;
  const cache = bookingVinculado.cache || 0;
  const ivaPct = bookingVinculado.ivaPct || 0;
  const total = cache * (1 + ivaPct / 100);
  costesProd.push({ concepto: `Alquiler venue — ${bookingVinculado.espacio || ""}`, importe: total });
  renderCostesProd();

  document.getElementById("pd-sala-nombre").value = bookingVinculado.espacio || "";
  if (bookingVinculado.repartoPromotorPct != null) {
    document.getElementById("pd-reparto-promotor").value = bookingVinculado.repartoPromotorPct;
  }
  if (bookingVinculado.repartoVenuePct != null) {
    document.getElementById("pd-reparto-venue").value = bookingVinculado.repartoVenuePct;
  }

  cambiarTabProd("cifras");
  recalcularCifrasProd();
  mostrarToast("Coste de alquiler y datos de la sala importados.");
}

// ---------- Cargar ----------

async function cargarProduccion() {
  try {
    const snap = await db.collection("producciones").doc(docIdProd).get();
    if (!snap.exists) {
      mostrarToast("Esta producción no existe.");
      setTimeout(() => (window.location.href = "producciones.html"), 1500);
      return;
    }
    const d = snap.data();

    document.getElementById("pd-id-badge").textContent = `${d.idVisible || "—"} · V${d.version || 1}`;
    document.getElementById("pd-titulo-cabecera").textContent = d.nombre || "Producción";
    document.getElementById("pd-nombre").value = d.nombre || "";
    document.getElementById("pd-fecha").value = d.fecha || "";
    document.getElementById("pd-notas").value = d.notas || "";
    if (d.pmTipo && d.pmId) document.getElementById("pd-pm").value = `${d.pmTipo}:${d.pmId}`;
    if (d.bookingId) {
      document.getElementById("pd-booking").value = d.bookingId;
      alVincularBookingProd();
    }

    costesProd = Array.isArray(d.costes) ? d.costes : [];
    if (costesProd.length === 0) {
      // Se siembran las categorías típicas la primera vez, todas editables/eliminables.
      costesProd = ["Caché", "Comisión / Agente", "Técnica", "Alojamiento", "Logística", "Dietas", "Promoción", "Otros"].map((concepto) => ({
        concepto,
        importe: null,
        nota: "",
      }));
    }
    renderCostesProd();

    document.getElementById("pd-sala-nombre").value = d.salaNombre || "";
    document.getElementById("pd-sala-provincia").value = d.salaProvincia || "";
    document.getElementById("pd-aforo").value = d.aforo != null ? d.aforo : "";
    document.getElementById("pd-venta-prevista").value = d.ventaPrevista != null ? d.ventaPrevista : "";
    document.getElementById("pd-venta-nota").value = d.ventaNota || "";
    document.getElementById("pd-precio-entrada").value = d.precioEntrada != null ? d.precioEntrada : "";
    document.getElementById("pd-reparto-promotor").value = d.repartoPromotorPct != null ? d.repartoPromotorPct : "";
    document.getElementById("pd-reparto-venue").value = d.repartoVenuePct != null ? d.repartoVenuePct : "";

    documentosProd = Array.isArray(d.documentos) ? d.documentos : [];
    renderDocumentosProd();

    hospitalidadProd = Array.isArray(d.hospitalidad) ? d.hospitalidad : [];
    renderHospProd();

    document.getElementById("pd-tq-vendidas").value = d.taquillaEntradasVendidas != null ? d.taquillaEntradasVendidas : "";
    document.getElementById("pd-tq-comision").value = d.taquillaComisionTiqueteraPct != null ? d.taquillaComisionTiqueteraPct : "";
    document.getElementById("pd-tq-notas").value = d.taquillaNotas || "";

    recalcularCifrasProd();
    recalcularTaquillaProd();
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo cargar la producción.");
  }
}

function escaparHtmlPD(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function escaparAttrPD(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// ---------- Costes ----------

function renderCostesProd() {
  const cont = document.getElementById("pd-lista-costes");
  if (costesProd.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay costes añadidos.</p>`;
  } else {
    cont.innerHTML = costesProd
      .map(
        (c, i) => `
          <div class="repeat-row" style="grid-template-columns: 1.2fr 1fr 1.6fr auto;">
            <input placeholder="Concepto" value="${escaparAttrPD(c.concepto)}" oninput="costesProd[${i}].concepto=this.value" />
            <input type="number" min="0" step="0.01" placeholder="Importe €" value="${c.importe != null ? c.importe : ""}" oninput="costesProd[${i}].importe=this.value===''?null:parseFloat(this.value); recalcularCifrasProd()" />
            <input placeholder="Nota (opcional, ej. 2 habitaciones dobles…)" value="${escaparAttrPD(c.nota)}" oninput="costesProd[${i}].nota=this.value" />
            <button type="button" class="remove-row-btn" onclick="eliminarCosteProd(${i})">✕</button>
          </div>
        `
      )
      .join("");
  }
  recalcularCifrasProd();
}

function anadirCosteProd() {
  costesProd.push({ concepto: "", importe: null, nota: "" });
  renderCostesProd();
}

function eliminarCosteProd(i) {
  costesProd.splice(i, 1);
  renderCostesProd();
}

// ---------- Simulación, reparto y break even ----------
// Verificado contra el modelo real: la Sala cobra su % sobre la
// VENTA BRUTA de cada tramo; el Artista/Promotor se queda su % sobre
// el BENEFICIO NETO de ese tramo (venta − gastos totales).

const TRAMOS_AFORO = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function formatoEuroPD(n) {
  return Number(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function recalcularCifrasProd() {
  const totalHosp = hospitalidadProd.reduce((sum, h) => sum + (h.precio || 0), 0);
  const totalCostesManual = costesProd.reduce((sum, c) => sum + (c.importe || 0), 0);
  const gastos = totalCostesManual + totalHosp;

  const aforoTotal = parseFloat(document.getElementById("pd-venta-prevista").value) || parseFloat(document.getElementById("pd-aforo").value) || 0;
  const precio = parseFloat(document.getElementById("pd-precio-entrada").value) || 0;
  const repartoPromotorInput = document.getElementById("pd-reparto-promotor").value;
  const repartoVenueInput = document.getElementById("pd-reparto-venue").value;
  const repartoPromotorPct = repartoPromotorInput !== "" ? parseFloat(repartoPromotorInput) : null;
  const repartoVenuePct = repartoVenueInput !== "" ? parseFloat(repartoVenueInput) : null;
  const hayReparto = (repartoPromotorPct != null && !isNaN(repartoPromotorPct)) || (repartoVenuePct != null && !isNaN(repartoVenuePct));

  document.getElementById("pd-th-sala").style.display = hayReparto ? "table-cell" : "none";
  document.getElementById("pd-th-artista").style.display = hayReparto ? "table-cell" : "none";

  const cuerpo = document.getElementById("pd-cuerpo-simulacion");
  cuerpo.innerHTML = TRAMOS_AFORO.map((pct) => {
    const entradas = Math.round((aforoTotal * pct) / 100);
    const venta = entradas * precio;
    const beneficio = venta - gastos;

    let colsReparto = "";
    if (hayReparto) {
      const venueCut = venta * ((repartoVenuePct || 0) / 100);
      const promotorCut = beneficio * ((repartoPromotorPct || 0) / 100);
      colsReparto = `<td>${formatoEuroPD(venueCut)}</td><td>${formatoEuroPD(promotorCut)}</td>`;
    }

    return `
      <tr>
        <td>${pct}%</td>
        <td>${entradas}</td>
        <td>${formatoEuroPD(venta)}</td>
        <td style="font-weight:600; color:${beneficio < 0 ? "#B3221F" : "#2FA84F"};">${formatoEuroPD(beneficio)}</td>
        ${colsReparto}
      </tr>
    `;
  }).join("");

  document.getElementById("pd-calc-costes").textContent = formatoEuroPD(gastos);
  document.getElementById("pd-calc-precio").textContent = formatoEuroPD(precio);

  const breakEvenEl = document.getElementById("pd-calc-breakeven");
  if (precio > 0) {
    const breakEven = Math.round(gastos / precio);
    const pctAforo = aforoTotal > 0 ? Math.round((breakEven / aforoTotal) * 100) : null;
    breakEvenEl.textContent = `${breakEven} entradas${pctAforo != null ? ` (${pctAforo}% del aforo)` : ""}`;
  } else {
    breakEvenEl.textContent = "—";
  }

  recalcularTaquillaProd();
}

// ---------- Documentos ----------

function procesarDocumentoProd(event) {
  const archivo = event.target.files[0];
  if (!archivo) return;
  if (archivo.type !== "application/pdf") {
    mostrarToast("Solo se admiten archivos PDF.");
    return;
  }
  if (archivo.size > LIMITE_PDF_BYTES_PD) {
    mostrarToast(`El PDF pesa ${(archivo.size / 1024).toFixed(0)} KB — intenta comprimirlo por debajo de 600 KB.`);
    return;
  }
  const lector = new FileReader();
  lector.onload = (e) => {
    documentosProd.push({ etiqueta: archivo.name.replace(/\.pdf$/i, ""), nombre: archivo.name, tamano: archivo.size, data: e.target.result });
    renderDocumentosProd();
    event.target.value = "";
  };
  lector.readAsDataURL(archivo);
}

function renderDocumentosProd() {
  const cont = document.getElementById("pd-lista-documentos");
  if (documentosProd.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay documentos subidos.</p>`;
    return;
  }
  cont.innerHTML = documentosProd
    .map(
      (doc, i) => `
        <div class="repeat-row rider-row">
          <input placeholder="Etiqueta (Ej. Contrato, Contrarrider…)" value="${escaparAttrPD(doc.etiqueta)}" oninput="documentosProd[${i}].etiqueta=this.value" />
          <div class="pdf-chip">📄 ${escaparHtmlPD(doc.nombre)} (${(doc.tamano / 1024).toFixed(0)} KB) — <a href="${doc.data}" download="${escaparAttrPD(doc.nombre)}" style="color:var(--color-text);">Descargar</a></div>
          <button type="button" class="remove-row-btn" onclick="eliminarDocumentoProd(${i})">✕</button>
        </div>
      `
    )
    .join("");
}

function eliminarDocumentoProd(i) {
  documentosProd.splice(i, 1);
  renderDocumentosProd();
}

// ---------- Hospitalidad (checklist) ----------

function renderHospProd() {
  const cont = document.getElementById("pd-lista-hosp");
  if (hospitalidadProd.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay ítems en el checklist.</p>`;
  } else {
    cont.innerHTML = hospitalidadProd
      .map(
        (h, i) => `
          <div class="repeat-row" style="grid-template-columns: auto 2fr 1fr auto;">
            <input type="checkbox" ${h.comprado ? "checked" : ""} style="width:18px; height:18px;" onchange="hospitalidadProd[${i}].comprado=this.checked" title="Comprado" />
            <input placeholder="Ítem (Ej. Agua, catering, toallas…)" value="${escaparAttrPD(h.nombre)}" oninput="hospitalidadProd[${i}].nombre=this.value" />
            <input type="number" min="0" step="0.01" placeholder="Precio €" value="${h.precio != null ? h.precio : ""}" oninput="hospitalidadProd[${i}].precio=this.value===''?0:parseFloat(this.value); actualizarTotalHospProd()" />
            <button type="button" class="remove-row-btn" onclick="eliminarItemHospProd(${i})">✕</button>
          </div>
        `
      )
      .join("");
  }
  actualizarTotalHospProd();
}

function actualizarTotalHospProd() {
  const total = hospitalidadProd.reduce((sum, h) => sum + (h.precio || 0), 0);
  document.getElementById("pd-calc-hosp-total").textContent = formatoEuroPD(total);
  recalcularCifrasProd();
}

function anadirItemHospProd() {
  hospitalidadProd.push({ nombre: "", precio: 0, comprado: false });
  renderHospProd();
}

function eliminarItemHospProd(i) {
  hospitalidadProd.splice(i, 1);
  renderHospProd();
}

// ---------- Taquilla ----------

function recalcularTaquillaProd() {
  const precio = parseFloat(document.getElementById("pd-precio-entrada").value) || 0;
  const vendidas = parseFloat(document.getElementById("pd-tq-vendidas").value) || 0;
  const comisionPct = parseFloat(document.getElementById("pd-tq-comision").value) || 0;

  const bruto = vendidas * precio;
  const comisionImporte = bruto * (comisionPct / 100);
  const neto = bruto - comisionImporte;

  document.getElementById("pd-tq-precio").textContent = formatoEuroPD(precio);
  document.getElementById("pd-tq-bruto").textContent = formatoEuroPD(bruto);
  document.getElementById("pd-tq-comision-importe").textContent = formatoEuroPD(comisionImporte);
  document.getElementById("pd-tq-neto").textContent = formatoEuroPD(neto);

  const totalHosp = hospitalidadProd.reduce((sum, h) => sum + (h.precio || 0), 0);
  const totalCostesManual = costesProd.reduce((sum, c) => sum + (c.importe || 0), 0);
  const gastos = totalCostesManual + totalHosp;

  const vsBreakEven = document.getElementById("pd-tq-vs-breakeven");
  if (precio > 0) {
    const breakEven = Math.round(gastos / precio);
    const restantes = breakEven - vendidas;
    vsBreakEven.textContent =
      restantes > 0 ? `Faltan ${restantes} entradas para cubrir costes` : `✅ Break even superado (+${Math.abs(restantes)} entradas de margen)`;
    vsBreakEven.style.color = restantes > 0 ? "#B3221F" : "#2FA84F";
  } else {
    vsBreakEven.textContent = "Define el precio de entrada en Cifras primero.";
    vsBreakEven.style.color = "";
  }
}

// ---------- Guardar ----------

async function guardarProduccion() {
  const btn = document.getElementById("btn-guardar-pd");
  btn.disabled = true;

  const [pmTipo, pmId] = (document.getElementById("pd-pm").value || "").split(":");
  const pmEncontrado = opcionesPMProd.find((o) => o.tipo === pmTipo && o.id === pmId);

  const datos = {
    nombre: document.getElementById("pd-nombre").value.trim(),
    fecha: document.getElementById("pd-fecha").value,
    notas: document.getElementById("pd-notas").value.trim(),
    pmTipo: pmTipo || null,
    pmId: pmId || null,
    pmNombre: pmEncontrado ? pmEncontrado.nombre : "",
    bookingId: document.getElementById("pd-booking").value || null,
    costes: costesProd,
    salaNombre: document.getElementById("pd-sala-nombre").value.trim(),
    salaProvincia: document.getElementById("pd-sala-provincia").value.trim(),
    aforo: parseFloat(document.getElementById("pd-aforo").value) || null,
    ventaPrevista: parseFloat(document.getElementById("pd-venta-prevista").value) || null,
    ventaNota: document.getElementById("pd-venta-nota").value.trim(),
    precioEntrada: parseFloat(document.getElementById("pd-precio-entrada").value) || null,
    repartoPromotorPct: document.getElementById("pd-reparto-promotor").value !== "" ? parseFloat(document.getElementById("pd-reparto-promotor").value) : null,
    repartoVenuePct: document.getElementById("pd-reparto-venue").value !== "" ? parseFloat(document.getElementById("pd-reparto-venue").value) : null,
    documentos: documentosProd,
    hospitalidad: hospitalidadProd,
    taquillaEntradasVendidas: parseFloat(document.getElementById("pd-tq-vendidas").value) || null,
    taquillaComisionTiqueteraPct: document.getElementById("pd-tq-comision").value !== "" ? parseFloat(document.getElementById("pd-tq-comision").value) : null,
    taquillaNotas: document.getElementById("pd-tq-notas").value.trim(),
  };

  try {
    await db.collection("producciones").doc(docIdProd).update(datos);
    document.getElementById("pd-titulo-cabecera").textContent = datos.nombre || "Producción";
    mostrarToast("Producción guardada.");
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo guardar. Puede que algún archivo sea demasiado grande.");
  } finally {
    btn.disabled = false;
  }
}

// ---------- Toast ----------

let toastTimerPD;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerPD);
  toastTimerPD = setTimeout(() => t.classList.remove("show"), 3200);
}
