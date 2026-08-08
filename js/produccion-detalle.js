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
}

function importarCosteVenueProd() {
  if (!bookingVinculado) return;
  const cache = bookingVinculado.cache || 0;
  const ivaPct = bookingVinculado.ivaPct || 0;
  const total = cache * (1 + ivaPct / 100);
  costesProd.push({ concepto: `Alquiler venue — ${bookingVinculado.espacio || ""}`, importe: total });
  renderCostesProd();
  cambiarTabProd("cifras");
  mostrarToast("Coste del venue importado.");
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

    document.getElementById("pd-id-badge").textContent = d.idVisible || "—";
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
    renderCostesProd();

    const tipoIngreso = d.ingresoTipo || "aforo";
    document.querySelector(`input[name="pd-ingreso-tipo"][value="${tipoIngreso}"]`).checked = true;
    document.getElementById("pd-aforo").value = d.aforo != null ? d.aforo : "";
    document.getElementById("pd-precio-entrada").value = d.precioEntrada != null ? d.precioEntrada : "";
    document.getElementById("pd-ingreso-fijo").value = d.ingresoFijo != null ? d.ingresoFijo : "";
    alCambiarTipoIngresoProd();

    documentosProd = Array.isArray(d.documentos) ? d.documentos : [];
    renderDocumentosProd();

    hospitalidadProd = Array.isArray(d.hospitalidad) ? d.hospitalidad : [];
    renderHospProd();

    recalcularCifrasProd();
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

function formatoEuroPD(n) {
  return Number(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
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
          <div class="repeat-row tramo-row" style="grid-template-columns: 2fr 1fr auto;">
            <input placeholder="Concepto (Ej. Equipos, Desplazamiento…)" value="${escaparAttrPD(c.concepto)}" oninput="costesProd[${i}].concepto=this.value" />
            <input type="number" min="0" step="0.01" placeholder="Importe €" value="${c.importe != null ? c.importe : ""}" oninput="costesProd[${i}].importe=this.value===''?0:parseFloat(this.value); recalcularCifrasProd()" />
            <button type="button" class="remove-row-btn" onclick="eliminarCosteProd(${i})">✕</button>
          </div>
        `
      )
      .join("");
  }
  recalcularCifrasProd();
}

function anadirCosteProd() {
  costesProd.push({ concepto: "", importe: 0 });
  renderCostesProd();
}

function eliminarCosteProd(i) {
  costesProd.splice(i, 1);
  renderCostesProd();
}

// ---------- Ingresos y break even ----------

function alCambiarTipoIngresoProd() {
  const tipo = document.querySelector('input[name="pd-ingreso-tipo"]:checked').value;
  document.getElementById("pd-ingreso-aforo-campos").style.display = tipo === "aforo" ? "grid" : "none";
  document.getElementById("pd-ingreso-fijo-campo").style.display = tipo === "fijo" ? "block" : "none";
  recalcularCifrasProd();
}

function recalcularCifrasProd() {
  const totalHosp = hospitalidadProd.reduce((sum, h) => sum + (h.precio || 0), 0);
  const totalCostesManual = costesProd.reduce((sum, c) => sum + (c.importe || 0), 0);
  const totalCostes = totalCostesManual + totalHosp;

  const tipoIngreso = document.querySelector('input[name="pd-ingreso-tipo"]:checked')?.value || "aforo";
  let ingresos = 0;
  if (tipoIngreso === "aforo") {
    const aforo = parseFloat(document.getElementById("pd-aforo").value) || 0;
    const precio = parseFloat(document.getElementById("pd-precio-entrada").value) || 0;
    ingresos = aforo * precio;
  } else {
    ingresos = parseFloat(document.getElementById("pd-ingreso-fijo").value) || 0;
  }

  const resultado = ingresos - totalCostes;

  document.getElementById("pd-calc-costes").textContent = formatoEuroPD(totalCostes);
  document.getElementById("pd-calc-ingresos").textContent = formatoEuroPD(ingresos);
  document.getElementById("pd-calc-resultado").textContent = formatoEuroPD(resultado);

  const itemBreakeven = document.getElementById("pd-calc-item-breakeven");
  if (tipoIngreso === "aforo") {
    const precio = parseFloat(document.getElementById("pd-precio-entrada").value) || 0;
    itemBreakeven.style.display = "flex";
    document.getElementById("pd-calc-breakeven").textContent = precio > 0 ? Math.ceil(totalCostes / precio) + " entradas" : "—";
  } else {
    itemBreakeven.style.display = "none";
  }
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

// ---------- Guardar ----------

async function guardarProduccion() {
  const btn = document.getElementById("btn-guardar-pd");
  btn.disabled = true;

  const [pmTipo, pmId] = (document.getElementById("pd-pm").value || "").split(":");
  const pmEncontrado = opcionesPMProd.find((o) => o.tipo === pmTipo && o.id === pmId);
  const tipoIngreso = document.querySelector('input[name="pd-ingreso-tipo"]:checked').value;

  const datos = {
    nombre: document.getElementById("pd-nombre").value.trim(),
    fecha: document.getElementById("pd-fecha").value,
    notas: document.getElementById("pd-notas").value.trim(),
    pmTipo: pmTipo || null,
    pmId: pmId || null,
    pmNombre: pmEncontrado ? pmEncontrado.nombre : "",
    bookingId: document.getElementById("pd-booking").value || null,
    costes: costesProd,
    ingresoTipo: tipoIngreso,
    aforo: parseFloat(document.getElementById("pd-aforo").value) || null,
    precioEntrada: parseFloat(document.getElementById("pd-precio-entrada").value) || null,
    ingresoFijo: parseFloat(document.getElementById("pd-ingreso-fijo").value) || null,
    documentos: documentosProd,
    hospitalidad: hospitalidadProd,
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
