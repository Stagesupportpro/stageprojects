// =========================================================
// STAGE SUPPORT — booking-detalle.js
// Ficha completa de un Booking: Información general, Cifras y
// Contratos (generación de contrato de booking en PDF/impresión).
// Colección: /bookings/{id} → {
//   idVisible, tipo ('cache'|'promotor'),
//   artistas: [{ rosterId, nombre, cache, comisionPct, ivaPct, fecha }],
//   origenCache, clienteId, clienteNombre, propuestaId, propuestaIdVisible,
//   venueId, espacio, espacioDireccion, modalidadIndice,
//   repartoPromotorPct, repartoVenuePct, costeVenue, costeVenueIvaPct,
//   fecha, ciudad, notas, version, creadoPor, creadoPorUid, creadoEl
// }
// =========================================================

let usuarioActualBk = null;
let docIdBooking = null;
let rosterCacheBk = [];
let clientesCacheBk = [];
let propuestasCacheBk = [];
let venuesCacheBk = [];
let bookingRepartoPromotorPct = null;
let bookingRepartoVenuePct = null;
let artistasBooking = [];
let logoDocumentoEmpresaBk = null;

(async function () {
  const params = new URLSearchParams(window.location.search);
  docIdBooking = params.get("id");
  if (!docIdBooking) {
    window.location.href = "bookings.html";
    return;
  }

  usuarioActualBk = await protegerPagina(["Comercial", "Admin"]);
  pintarNav(usuarioActualBk.rol, "bookings");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualBk) || usuarioActualBk.email;
  document.getElementById("pass-role").textContent = usuarioActualBk.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualBk.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualBk.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualBk) || usuarioActualBk.email);
  }

  await Promise.all([cargarRosterBk(), cargarClientesBk(), cargarPropuestasBk(), cargarVenuesBk()]);
  await cargarBooking();
})();

// ---------- Pestañas ----------

function cambiarTabBk(tab) {
  document.querySelectorAll("#bk-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".rst-tab-panel").forEach((p) => p.classList.remove("active"));
  document.getElementById(`bk-panel-${tab}`).classList.add("active");
}

// ---------- Listas de apoyo ----------

async function cargarRosterBk() {
  try {
    const snap = await db.collection("roster").orderBy("nombre").get();
    rosterCacheBk = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error(err);
  }
}

async function cargarClientesBk() {
  const sel = document.getElementById("bk-cliente");
  try {
    const snap = await db.collection("clientes").orderBy("nombre").get();
    clientesCacheBk = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    sel.innerHTML =
      `<option value="">— Selecciona un cliente —</option>` +
      clientesCacheBk.map((c) => `<option value="${c.id}">${escaparHtmlBk(c.nombre)}</option>`).join("");
  } catch (err) {
    console.error(err);
  }
}

async function cargarPropuestasBk() {
  const sel = document.getElementById("bk-propuesta");
  try {
    const snap = await db.collection("propuestas").orderBy("creadoEl", "desc").get();
    propuestasCacheBk = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    sel.innerHTML =
      `<option value="">— Selecciona una propuesta —</option>` +
      propuestasCacheBk.map((p) => `<option value="${p.id}">${escaparHtmlBk(p.idVisible)} — ${escaparHtmlBk(p.nombre)}</option>`).join("");
  } catch (err) {
    console.error(err);
  }
}

async function cargarVenuesBk() {
  try {
    const snap = await db.collection("venues").orderBy("nombre").get();
    venuesCacheBk = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const sel = document.getElementById("bk-venue-select");
    sel.innerHTML =
      `<option value="">— Selecciona un venue —</option>` +
      venuesCacheBk.map((v) => `<option value="${v.id}">${escaparHtmlBk(v.nombre)}${v.tipoVenue ? ` (${escaparHtmlBk(v.tipoVenue)})` : ""}</option>`).join("");
  } catch (err) {
    console.error(err);
  }
}

// ---------- Artistas ----------

function renderArtistasBooking() {
  const cont = document.getElementById("lista-artistas-bk");
  const esPromotor = document.querySelector('input[name="bk-tipo"]:checked').value === "promotor";

  if (artistasBooking.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay artistas añadidos.</p>`;
  } else {
    const opcionesHtml = (seleccionado) =>
      `<option value="">— Selecciona del Roster —</option>` +
      rosterCacheBk.map((r) => `<option value="${r.id}" ${seleccionado === r.id ? "selected" : ""}>${escaparHtmlBk(r.nombre)}</option>`).join("");

    cont.innerHTML = artistasBooking
      .map(
        (a, i) => `
          <div class="modalidad-card">
            <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
              <select style="flex:1;" onchange="alSeleccionarArtistaBookingRow(${i}, this.value)">${opcionesHtml(a.rosterId)}</select>
              <button type="button" class="remove-row-btn" onclick="eliminarArtistaBooking(${i})">✕</button>
            </div>
            <div class="form-grid">
              <div class="field"><label style="font-size:11px;">Caché (BI) €</label><input type="number" min="0" step="0.01" value="${a.cache != null ? a.cache : ""}" oninput="artistasBooking[${i}].cache=this.value===''?null:parseFloat(this.value); actualizarTotalArtistaBooking(${i})" /></div>
              <div class="field" style="display:${esPromotor ? "none" : "block"};"><label style="font-size:11px;">Comisión %</label><input type="number" min="0" max="100" step="0.1" value="${a.comisionPct != null ? a.comisionPct : ""}" oninput="artistasBooking[${i}].comisionPct=this.value===''?0:parseFloat(this.value); actualizarTotalArtistaBooking(${i})" /></div>
              <div class="field"><label style="font-size:11px;">IVA %</label><input type="number" min="0" max="100" step="0.1" value="${a.ivaPct != null ? a.ivaPct : ""}" oninput="artistasBooking[${i}].ivaPct=this.value===''?0:parseFloat(this.value); actualizarTotalArtistaBooking(${i})" /></div>
            </div>
            <div class="field" style="margin-top:8px;">
              <label style="font-size:11px;">Fecha de este artista (opcional — si se deja vacío, usa la fecha general del booking)</label>
              <input type="date" value="${a.fecha || ""}" oninput="artistasBooking[${i}].fecha=this.value" />
            </div>
            <div class="calc-box" style="margin-top:8px;">
              <div class="calc-item calc-total"><div class="calc-label">Total</div><div class="calc-value" id="artista-total-${i}">${formatoEuroBk(totalArtistaBooking(a, esPromotor))}</div></div>
            </div>
          </div>
        `
      )
      .join("");
  }
  recalcularBooking();
}

function totalArtistaBooking(a, esPromotor) {
  const cache = a.cache || 0;
  const comisionPct = esPromotor ? 0 : a.comisionPct || 0;
  const ivaPct = a.ivaPct || 0;
  const pvp = cache * (1 + comisionPct / 100);
  return pvp * (1 + ivaPct / 100);
}

function actualizarTotalArtistaBooking(i) {
  const esPromotor = document.querySelector('input[name="bk-tipo"]:checked').value === "promotor";
  const el = document.getElementById(`artista-total-${i}`);
  if (el) el.textContent = formatoEuroBk(totalArtistaBooking(artistasBooking[i], esPromotor));
  recalcularBooking();
}

function alSeleccionarArtistaBookingRow(i, rosterId) {
  const artista = rosterCacheBk.find((r) => r.id === rosterId);
  artistasBooking[i].rosterId = rosterId || null;
  artistasBooking[i].nombre = artista ? artista.nombre : "";
  if (artista) {
    if (artista.cache != null) artistasBooking[i].cache = artista.cache;
    if (artista.comisionPorcentaje != null) artistasBooking[i].comisionPct = artista.comisionPorcentaje;
    if (artista.ivaPorcentaje != null) artistasBooking[i].ivaPct = artista.ivaPorcentaje;
  }
  renderArtistasBooking();
  comprobarDisponibilidadBk();
}

// Se llama al cambiar fecha o estado del booking, y al elegir un
// artista — avisa (sin bloquear) si alguien ya está pendiente o
// aceptado ese mismo día en otro booking/producción.
async function comprobarDisponibilidadBk() {
  const fecha = document.getElementById("bk-fecha").value;
  const estado = document.getElementById("bk-estado").value;
  if (!fecha || estado === "rechazado") return;
  const artistasValidos = artistasBooking.filter((a) => a.rosterId);
  if (artistasValidos.length === 0) return;
  await comprobarYAvisarConflictos(artistasValidos, fecha, `booking_${docIdBooking}`);
}

function alCambiarFechaOEstadoBk() {
  comprobarDisponibilidadBk();
}

function anadirArtistaBooking() {
  artistasBooking.push({ rosterId: null, nombre: "", cache: null, comisionPct: 0, ivaPct: 21, fecha: null });
  renderArtistasBooking();
}

function eliminarArtistaBooking(i) {
  artistasBooking.splice(i, 1);
  renderArtistasBooking();
}

// ---------- Venue y modalidad ----------

function alSeleccionarVenueBooking() {
  const venueId = document.getElementById("bk-venue-select").value;
  const venue = venuesCacheBk.find((v) => v.id === venueId);
  const campoModalidad = document.getElementById("campo-bk-modalidad");
  const esPromotor = document.querySelector('input[name="bk-tipo"]:checked').value === "promotor";

  if (!venue) {
    document.getElementById("bk-venue-id").value = "";
    campoModalidad.style.display = "none";
    return;
  }

  document.getElementById("bk-venue-id").value = venue.id;
  document.getElementById("bk-espacio-direccion").value = venue.direccion || "";

  if (!esPromotor) {
    campoModalidad.style.display = "none";
    return;
  }

  const tarifas = Array.isArray(venue.tarifas) ? venue.tarifas.filter((t) => t.concepto) : [];
  const sel = document.getElementById("bk-modalidad");
  if (tarifas.length === 0) {
    sel.innerHTML = `<option value="">Este venue no tiene tarifas guardadas — introduce el coste a mano</option>`;
    campoModalidad.style.display = "block";
    return;
  }
  sel.innerHTML =
    `<option value="">— Elige una modalidad —</option>` +
    tarifas
      .map(
        (t, i) =>
          `<option value="${i}">${escaparHtmlBk(t.concepto)} — ${formatoEuroBk(t.importe)} (${t.impuestos === "con" ? "con" : "sin"} IVA)${t.taquillaCompartida ? ` · taquilla ${t.pctPromotor != null ? t.pctPromotor : "?"}% / ${t.pctVenue != null ? t.pctVenue : "?"}%` : ""}</option>`
      )
      .join("");
  campoModalidad.style.display = "block";
}

function alSeleccionarModalidadBooking() {
  const esPromotor = document.querySelector('input[name="bk-tipo"]:checked').value === "promotor";
  if (!esPromotor) return;

  const venueId = document.getElementById("bk-venue-id").value;
  const venue = venuesCacheBk.find((v) => v.id === venueId);
  const idx = document.getElementById("bk-modalidad").value;
  if (!venue || idx === "") return;
  const tarifa = venue.tarifas[idx];
  if (!tarifa) return;

  document.getElementById("bk-venue-cache").value = tarifa.importe || 0;
  document.getElementById("bk-venue-iva-pct").value = tarifa.impuestos === "con" ? 0 : document.getElementById("bk-venue-iva-pct").value || 21;
  bookingRepartoPromotorPct = tarifa.taquillaCompartida && tarifa.pctPromotor != null ? tarifa.pctPromotor : null;
  bookingRepartoVenuePct = tarifa.taquillaCompartida && tarifa.pctVenue != null ? tarifa.pctVenue : null;
  recalcularBooking();
}

// ---------- Tipo / origen ----------

function alCambiarTipoBooking() {
  const tipo = document.querySelector('input[name="bk-tipo"]:checked').value;
  const esPromotor = tipo === "promotor";
  document.getElementById("bloque-cache").style.display = esPromotor ? "none" : "block";
  document.getElementById("bloque-coste-venue").style.display = esPromotor ? "block" : "none";
  document.getElementById("bk-cifras-venue").style.display = esPromotor ? "block" : "none";

  if (document.getElementById("bk-venue-select").value) {
    alSeleccionarVenueBooking();
  }

  renderArtistasBooking();
}

function alCambiarOrigenCache() {
  const origen = document.querySelector('input[name="bk-origen"]:checked').value;
  document.getElementById("campo-bk-cliente").style.display = origen === "cliente" ? "block" : "none";
  document.getElementById("campo-bk-propuesta").style.display = origen === "propuesta" ? "block" : "none";
}

function alSeleccionarPropuestaBooking() {
  const id = document.getElementById("bk-propuesta").value;
  const propuesta = propuestasCacheBk.find((p) => p.id === id);
  if (!propuesta) return;

  if (propuesta.clienteId) {
    document.getElementById("bk-cliente").value = propuesta.clienteId;
  }

  const items = Array.isArray(propuesta.items) ? propuesta.items.filter((it) => it.rosterId) : [];
  if (items.length > 0) {
    artistasBooking = items.map((it) => ({
      rosterId: it.rosterId,
      nombre: it.nombre || "",
      cache: it.bi != null ? it.bi : null,
      comisionPct: it.comisionPct != null ? it.comisionPct : 0,
      ivaPct: it.ivaPct != null ? it.ivaPct : 21,
      fecha: it.fecha || null,
    }));
    renderArtistasBooking();
  }

  const itemConFecha = items.find((it) => it.fecha);
  if (itemConFecha) {
    document.getElementById("bk-fecha").value = itemConFecha.fecha;
  }

  mostrarToast(items.length > 0 ? `${items.length} artista(s) importado(s) desde la propuesta.` : "Cliente importado.");
}

// ---------- Cálculo general ----------

function formatoEuroBk(n) {
  return Number(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function recalcularBooking() {
  const esPromotor = document.querySelector('input[name="bk-tipo"]:checked').value === "promotor";

  const totalArtistas = artistasBooking.reduce((sum, a) => sum + totalArtistaBooking(a, esPromotor), 0);
  const labelArtistas = esPromotor ? "Total artistas (coste)" : "Total artistas (a facturar)";
  document.getElementById("bk-calc-label-artistas").textContent = labelArtistas;
  document.getElementById("bk-calc-artistas-total").textContent = formatoEuroBk(totalArtistas);

  let totalGeneral = totalArtistas;

  if (esPromotor) {
    const costeVenue = parseFloat(document.getElementById("bk-venue-cache").value) || 0;
    const ivaVenue = parseFloat(document.getElementById("bk-venue-iva-pct").value) || 0;
    const ivaVenueImporte = costeVenue * (ivaVenue / 100);
    const totalVenue = costeVenue + ivaVenueImporte;
    document.getElementById("bk-calc-venue-cache").textContent = formatoEuroBk(costeVenue);
    document.getElementById("bk-calc-venue-iva").textContent = formatoEuroBk(ivaVenueImporte);
    document.getElementById("bk-calc-venue-total").textContent = formatoEuroBk(totalVenue);
    totalGeneral += totalVenue;
    document.getElementById("bk-resumen-label").textContent = "Coste total del booking (artistas + venue)";
  } else {
    document.getElementById("bk-resumen-label").textContent = "Total a facturar al cliente";
  }

  document.getElementById("bk-resumen-valor").textContent = formatoEuroBk(totalGeneral);
  return totalGeneral;
}

// ---------- Cargar / guardar ----------

async function cargarBooking() {
  try {
    const snap = await db.collection("bookings").doc(docIdBooking).get();
    if (!snap.exists) {
      mostrarToast("Este booking no existe.");
      setTimeout(() => (window.location.href = "bookings.html"), 1500);
      return;
    }
    const b = snap.data();

    document.getElementById("bk-id-badge").textContent = `${b.idVisible || "—"} · V${b.version || 1}`;
    document.getElementById("bk-titulo-cabecera").textContent = (Array.isArray(b.artistas) && b.artistas.length ? b.artistas.map((a) => a.nombre).join(", ") : b.idVisible) || "Booking";

    document.querySelector(`input[name="bk-tipo"][value="${b.tipo || "cache"}"]`).checked = true;

    bookingRepartoPromotorPct = b.repartoPromotorPct != null ? b.repartoPromotorPct : null;
    bookingRepartoVenuePct = b.repartoVenuePct != null ? b.repartoVenuePct : null;
    artistasBooking = Array.isArray(b.artistas) && b.artistas.length ? JSON.parse(JSON.stringify(b.artistas)) : [];

    document.getElementById("bk-venue-select").value = b.venueId || "";
    document.getElementById("bk-venue-id").value = b.venueId || "";
    document.getElementById("bk-espacio-direccion").value = b.espacioDireccion || "";
    document.getElementById("bk-venue-cache").value = b.costeVenue != null ? b.costeVenue : "";
    document.getElementById("bk-venue-iva-pct").value = b.costeVenueIvaPct != null ? b.costeVenueIvaPct : 21;
    if (b.venueId) {
      alSeleccionarVenueBooking();
      if (b.modalidadIndice != null) {
        setTimeout(() => {
          document.getElementById("bk-modalidad").value = b.modalidadIndice;
        }, 0);
      }
    }

    if (b.tipo !== "promotor") {
      const origen = b.origenCache || "cliente";
      document.querySelector(`input[name="bk-origen"][value="${origen}"]`).checked = true;
      document.getElementById("bk-cliente").value = b.clienteId || "";
      document.getElementById("bk-propuesta").value = b.propuestaId || "";
    }

    document.getElementById("bk-fecha").value = b.fecha || "";
    document.getElementById("bk-ciudad").value = b.ciudad || "";
    document.getElementById("bk-estado").value = b.estado || "pendiente";
    document.getElementById("bk-notas").value = b.notas || "";

    alCambiarTipoBooking();
    alCambiarOrigenCache();
    renderArtistasBooking();
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo cargar el booking.");
  }
}

async function guardarBooking() {
  const btn = document.getElementById("btn-guardar-bk");
  btn.disabled = true;

  const tipo = document.querySelector('input[name="bk-tipo"]:checked').value;
  const artistasValidos = artistasBooking.filter((a) => a.rosterId);

  const datosBase = {
    tipo,
    artistas: artistasValidos,
    fecha: document.getElementById("bk-fecha").value,
    ciudad: document.getElementById("bk-ciudad").value.trim(),
    estado: document.getElementById("bk-estado").value,
    notas: document.getElementById("bk-notas").value.trim(),
    espacio: (() => {
      const venueId = document.getElementById("bk-venue-id").value;
      const venue = venuesCacheBk.find((v) => v.id === venueId);
      return venue ? venue.nombre : "";
    })(),
    venueId: document.getElementById("bk-venue-id").value || null,
    modalidadIndice: document.getElementById("bk-modalidad").value !== "" ? document.getElementById("bk-modalidad").value : null,
    repartoPromotorPct: bookingRepartoPromotorPct,
    repartoVenuePct: bookingRepartoVenuePct,
    espacioDireccion: document.getElementById("bk-espacio-direccion").value.trim(),
    costeVenue: tipo === "promotor" ? parseFloat(document.getElementById("bk-venue-cache").value) || 0 : null,
    costeVenueIvaPct: tipo === "promotor" ? parseFloat(document.getElementById("bk-venue-iva-pct").value) || 0 : null,
  };

  if (tipo === "promotor") {
    datosBase.origenCache = null;
    datosBase.clienteId = null;
    datosBase.clienteNombre = null;
    datosBase.propuestaId = null;
    datosBase.propuestaIdVisible = null;
  } else {
    const origen = document.querySelector('input[name="bk-origen"]:checked').value;
    datosBase.origenCache = origen;

    if (origen === "propuesta") {
      const propuestaId = document.getElementById("bk-propuesta").value;
      const propuestaEncontrada = propuestasCacheBk.find((p) => p.id === propuestaId);
      datosBase.propuestaId = propuestaId || null;
      datosBase.propuestaIdVisible = propuestaEncontrada ? propuestaEncontrada.idVisible : null;
      datosBase.clienteId = propuestaEncontrada ? propuestaEncontrada.clienteId : document.getElementById("bk-cliente").value || null;
      datosBase.clienteNombre = propuestaEncontrada ? propuestaEncontrada.clienteNombre : "";
    } else {
      const clienteId = document.getElementById("bk-cliente").value;
      const clienteEncontrado = clientesCacheBk.find((c) => c.id === clienteId);
      datosBase.clienteId = clienteId || null;
      datosBase.clienteNombre = clienteEncontrado ? clienteEncontrado.nombre : "";
      datosBase.propuestaId = null;
      datosBase.propuestaIdVisible = null;
    }
  }

  try {
    await db.collection("bookings").doc(docIdBooking).update(datosBase);

    // Sincroniza el calendario de disponibilidad del Roster con este booking.
    await sincronizarCalendarioArtistas({
      origen: "booking",
      refId: docIdBooking,
      refIdVisible: document.getElementById("bk-id-badge").textContent.split(" · ")[0],
      artistas: artistasValidos,
      fecha: datosBase.fecha,
      ciudad: datosBase.ciudad,
      estado: datosBase.estado,
    });

    // Se marca en el Calendario la primera vez que el booking tiene ya
    // al menos un artista (evita marcar bookings vacíos recién creados).
    if (artistasValidos.length > 0) {
      const snapDoc = await db.collection("bookings").doc(docIdBooking).get();
      if (!snapDoc.data().marcadoEnCalendario) {
        const contraparte = tipo === "promotor" ? datosBase.espacio : datosBase.clienteNombre;
        const nombresArtistas = artistasValidos.map((a) => a.nombre).join(", ");
        await db.collection("documentos").add({
          tipo: "Booking",
          titulo: `${nombresArtistas} — ${contraparte || "—"} (${snapDoc.data().idVisible || ""})`,
          fecha: fechaISOBk(new Date()),
          enlace: "",
          notas: `Booking ${snapDoc.data().idVisible || ""}`,
          creadoPor: nombreCompletoDe(usuarioActualBk) || usuarioActualBk.email,
          creadoPorUid: usuarioActualBk.uid,
          creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
        });
        await db.collection("bookings").doc(docIdBooking).update({ marcadoEnCalendario: true });
      }
    }

    document.getElementById("bk-titulo-cabecera").textContent = artistasValidos.length ? artistasValidos.map((a) => a.nombre).join(", ") : "Booking";
    mostrarToast("Booking guardado.");
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo guardar. Inténtalo de nuevo.");
  } finally {
    btn.disabled = false;
  }
}

function fechaISOBk(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function escaparHtmlBk(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// ---------- Toast ----------

let toastTimerBk;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerBk);
  toastTimerBk = setTimeout(() => t.classList.remove("show"), 3200);
}

// =========================================================
// Generación de contrato (pestaña Contratos)
// =========================================================

async function generarContratoBooking() {
  const btn = document.getElementById("btn-generar-contrato");
  btn.disabled = true;
  btn.textContent = "Generando…";

  try {
    const tipo = document.querySelector('input[name="bk-tipo"]:checked').value;

    const snapEmpresa = await db.collection("configuracion").doc("empresa").get();
    const empresa = snapEmpresa.exists ? snapEmpresa.data() : {};
    logoDocumentoEmpresaBk = empresa.logoDocumentos || null;

    const clienteId = document.getElementById("bk-cliente").value;
    const cliente = clientesCacheBk.find((c) => c.id === clienteId) || null;

    const venueId = document.getElementById("bk-venue-id").value;
    const venue = venuesCacheBk.find((v) => v.id === venueId) || null;

    const snapClausulas = await db.collection("contratosConfig").doc("booking").get();
    const clausulasBooking = snapClausulas.exists && Array.isArray(snapClausulas.data().clausulas) ? snapClausulas.data().clausulas : [];

    const artistasValidos = artistasBooking.filter((a) => a.rosterId);
    const artistasConDetalle = await Promise.all(
      artistasValidos.map(async (a) => {
        const rosterDoc = rosterCacheBk.find((r) => r.id === a.rosterId);
        let clausulasEspeciales = [];
        let fiscal = null;
        try {
          const snapJur = await db.collection("rosterJuridico").doc(a.rosterId).get();
          if (snapJur.exists) {
            const datosJur = snapJur.data();
            clausulasEspeciales = Array.isArray(datosJur.clausulasEspeciales) ? datosJur.clausulasEspeciales : [];
            fiscal = datosJur.fiscal || null;
          }
        } catch (errJur) {
          // Sin permiso (no-Admin) — esa parte se omite con normalidad, el
          // resto del contrato se genera igual.
        }
        return {
          ...a,
          total: totalArtistaBooking(a, tipo === "promotor"),
          ridersPdf: rosterDoc && Array.isArray(rosterDoc.ridersPdf) ? rosterDoc.ridersPdf : [],
          clausulasEspeciales,
          fiscal,
        };
      })
    );

    const html = construirHtmlContratoBooking({
      tipo,
      idVisible: document.getElementById("bk-id-badge").textContent,
      fecha: document.getElementById("bk-fecha").value,
      ciudad: document.getElementById("bk-ciudad").value,
      empresa,
      cliente,
      venue,
      clausulasBooking,
      artistas: artistasConDetalle,
      totalGeneral: recalcularBooking(),
    });

    document.getElementById("bk-contrato-preview").innerHTML = html;
    document.getElementById("bk-contrato-acciones").style.display = "flex";
    mostrarToast("Contrato generado. Revísalo antes de imprimir o exportar.");
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo generar el contrato.");
  } finally {
    btn.disabled = false;
    btn.textContent = "📄 Generar contrato";
  }
}

function construirHtmlContratoBooking(d) {
  const fechaLarga = d.fecha ? new Date(d.fecha + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) : "—";
  const ahora = new Date().toLocaleString("es-ES");
  const esPromotor = d.tipo === "promotor";

  // La contraparte del contrato: el cliente (a caché) o el venue (como
  // promotora, a falta de un cliente externo al que facturar).
  const contraparteNombre = esPromotor ? (d.venue ? d.venue.nombre : "—") : (d.cliente ? d.cliente.nombre : "—");
  const contraparteCif = esPromotor ? "" : d.cliente ? d.cliente.cif || "" : "";
  const contraparteDireccion = esPromotor ? (d.venue ? d.venue.direccion || "" : "") : d.cliente ? d.cliente.direccion || "" : "";

  const nombresArtistasTexto = d.artistas.map((a) => a.nombre).join(", ") || "—";

  const reconocimientos = `
    <p>REUNIDOS: de una parte, <strong>${escaparHtmlBk(d.empresa.nombre || "STAGE SUPPORT")}</strong>${d.empresa.cif ? `, con CIF ${escaparHtmlBk(d.empresa.cif)}` : ""}${d.empresa.direccion ? `, con domicilio en ${escaparHtmlBk(d.empresa.direccion)}` : ""} (en adelante, "STAGE SUPPORT"); y de otra parte, <strong>${escaparHtmlBk(contraparteNombre)}</strong>${contraparteCif ? `, con CIF ${escaparHtmlBk(contraparteCif)}` : ""}${contraparteDireccion ? `, con domicilio en ${escaparHtmlBk(contraparteDireccion)}` : ""} (en adelante, "${esPromotor ? "EL VENUE" : "EL CLIENTE"}").</p>
    <p>Ambas partes se reconocen mutuamente capacidad legal suficiente para la firma del presente contrato de booking (referencia ${escaparHtmlBk(d.idVisible)}), relativo a la actuación de ${escaparHtmlBk(nombresArtistasTexto)} el día ${fechaLarga}${d.ciudad ? ` en ${escaparHtmlBk(d.ciudad)}` : ""}, y a tal efecto ACUERDAN lo siguiente:</p>
  `;

  const clausulasBookingHtml = d.clausulasBooking.length
    ? `
      <table class="doc-table">
        <tr><th class="doc-section-title">CONDICIONES BÁSICAS DE BOOKING</th></tr>
        ${d.clausulasBooking
          .map((c, i) => `<tr><td><strong>${i + 1}. ${escaparHtmlBk(c.titulo)}</strong><br/>${escaparHtmlBk(c.texto)}</td></tr>`)
          .join("")}
      </table>
    `
    : "";

  const condicionesArtistasHtml = d.artistas
    .map((a) => {
      const f = a.fiscal;
      const filaFiscal = f && (f.razonSocial || f.nif)
        ? `<tr><td class="label">Datos fiscales</td><td>${escaparHtmlBk(f.razonSocial || a.nombre)}${f.nif ? ` — NIF/CIF ${escaparHtmlBk(f.nif)}` : ""}${f.direccion ? `<br/>${escaparHtmlBk(f.direccion)}` : ""}${f.representante ? `<br/>Representado por: ${escaparHtmlBk(f.representante)}` : ""}</td></tr>`
        : "";
      const filaImporte = `<tr><td class="label">Caché acordado</td><td>${formatoEuroBk(a.total)} (IVA incluido)</td></tr>`;
      const clausulasHtml = a.clausulasEspeciales.length
        ? a.clausulasEspeciales.map((c, i) => `<tr><td><strong>${i + 1}. ${escaparHtmlBk(c.titulo)}</strong><br/>${escaparHtmlBk(c.texto)}</td></tr>`).join("")
        : `<tr><td style="color:#666;">Sin cláusulas especiales adicionales.</td></tr>`;
      return `
        <table class="doc-table">
          <tr><th class="doc-section-title">CONDICIONES ESPECIALES — ${escaparHtmlBk(a.nombre).toUpperCase()}</th></tr>
          ${filaFiscal}
          ${filaImporte}
          ${clausulasHtml}
        </table>
      `;
    })
    .join("");

  const anexosHtml = `
    <table class="doc-table">
      <tr><th class="doc-section-title">ANEXOS</th></tr>
      ${
        d.artistas.every((a) => a.ridersPdf.length === 0)
          ? `<tr><td style="color:#666;">Sin riders técnicos adjuntos en el Roster.</td></tr>`
          : d.artistas
              .map((a) =>
                a.ridersPdf.length
                  ? `<tr><td><strong>${escaparHtmlBk(a.nombre)}</strong> — ${a.ridersPdf.map((r) => escaparHtmlBk(r.etiqueta || r.nombre)).join(", ")} <em>(adjuntar por separado en papel o PDF)</em></td></tr>`
                  : ""
              )
              .join("")
      }
    </table>
  `;

  return `
    <div class="doc-page">
      <div class="doc-header">
        <img class="doc-logo" src="${logoDocumentoEmpresaBk || "assets/logo_stagesupport.png"}" onerror="this.style.display='none'" />
      </div>
      <div class="doc-title-block">
        <h1>CONTRATO DE BOOKING</h1>
        <div class="doc-id-text">${escaparHtmlBk(d.idVisible)} — ${fechaLarga}</div>
      </div>

      <table class="doc-table">
        <tr><th class="doc-section-title">RECONOCIMIENTOS</th></tr>
        <tr><td>${reconocimientos}</td></tr>
      </table>

      <table class="doc-table">
        <tr><th class="doc-section-title" colspan="2">OBJETO DEL CONTRATO</th></tr>
        <tr><td class="label">Artista(s)</td><td>${escaparHtmlBk(nombresArtistasTexto)}</td></tr>
        <tr><td class="label">Fecha</td><td>${fechaLarga}</td></tr>
        <tr><td class="label">Ciudad</td><td>${escaparHtmlBk(d.ciudad || "—")}</td></tr>
        <tr><td class="label">Venue</td><td>${d.venue ? escaparHtmlBk(d.venue.nombre) : "—"}</td></tr>
        <tr><td class="label">Importe total</td><td><strong>${formatoEuroBk(d.totalGeneral)}</strong> (IVA incluido)</td></tr>
      </table>

      ${clausulasBookingHtml}
      ${condicionesArtistasHtml}
      ${anexosHtml}

      <div class="doc-contrato-firmas">
        <div class="firma-box">STAGE SUPPORT<br/>Firma y sello</div>
        <div class="firma-box">${esPromotor ? "EL VENUE" : "EL CLIENTE"}<br/>Firma y sello</div>
      </div>

      <div class="doc-provisional">DOCUMENTO GENERADO PARA FIRMA — REVISAR ANTES DE ENVIAR</div>
      <div class="doc-footer-note">Generado por Stage Support - ${ahora}</div>
    </div>
  `;
}

function imprimirContratoBooking() {
  const contenido = document.getElementById("bk-contrato-preview").innerHTML;
  if (!contenido) {
    mostrarToast("Genera el contrato primero.");
    return;
  }
  document.getElementById("print-area").innerHTML = contenido;
  setTimeout(() => window.print(), 50);
}

function descargarPdfContratoBooking() {
  const contenido = document.getElementById("bk-contrato-preview").innerHTML;
  if (!contenido) {
    mostrarToast("Genera el contrato primero.");
    return;
  }
  const printArea = document.getElementById("print-area");
  printArea.innerHTML = contenido;
  printArea.style.display = "block";

  const idVisible = document.getElementById("bk-id-badge").textContent.replace(/[^\w-]/g, "_");

  html2pdf()
    .from(printArea)
    .set({
      margin: 10,
      filename: `Contrato_${idVisible}.pdf`,
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    })
    .save()
    .then(() => {
      printArea.style.display = "none";
    });
}
