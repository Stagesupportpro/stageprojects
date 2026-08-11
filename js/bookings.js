// =========================================================
// STAGE SUPPORT — bookings.js
// Colección: /bookings/{id} → {
//   idVisible, tipo ('cache'|'promotor'),
//   artistas: [{ rosterId, nombre, cache, comisionPct, ivaPct }],
//   origenCache ('cliente'|'propuesta'), clienteId, clienteNombre,
//   propuestaId, propuestaIdVisible,
//   venueId, espacio, espacioDireccion, modalidadIndice,
//   repartoPromotorPct, repartoVenuePct,
//   costeVenue, costeVenueIvaPct (solo "como promotora"),
//   fecha, ciudad, notas,
//   creadoPor, creadoPorUid, creadoEl
// }
// Un booking puede tener varios artistas (cada uno con su propio
// caché/comisión/IVA). Al crear un booking, también se marca en el
// Calendario (tipo "Booking").
// =========================================================

let usuarioActualBk = null;
let rosterCacheBk = [];
let clientesCacheBk = [];
let propuestasCacheBk = [];
let venuesCacheBk = [];
let bookingRepartoPromotorPct = null;
let bookingRepartoVenuePct = null;
let artistasBooking = []; // [{ rosterId, nombre, cache, comisionPct, ivaPct }]

(async function () {
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
  escucharBookings();
})();

// ---------- Listas de apoyo (Roster, Clientes, Propuestas, Venues) ----------

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
      propuestasCacheBk
        .map((p) => `<option value="${p.id}">${escaparHtmlBk(p.idVisible)} — ${escaparHtmlBk(p.nombre)}</option>`)
        .join("");
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

// ---------- Artistas (varios por booking) ----------

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
}

function anadirArtistaBooking() {
  artistasBooking.push({ rosterId: null, nombre: "", cache: null, comisionPct: 0, ivaPct: 21 });
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

  // La modalidad (y su coste/reparto) solo aplica cuando actuamos como
  // promotora — en "a caché" no hay coste de venue, solo el caché de
  // los artistas.
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
  if (!esPromotor) return; // Salvaguarda: en "a caché" la modalidad nunca debe tocar ningún coste.

  const venueId = document.getElementById("bk-venue-id").value;
  const venue = venuesCacheBk.find((v) => v.id === venueId);
  const idx = document.getElementById("bk-modalidad").value;
  if (!venue || idx === "") return;
  const tarifa = venue.tarifas[idx];
  if (!tarifa) return;

  document.getElementById("bk-venue-cache").value = tarifa.importe || 0;
  // Si la modalidad del venue ya incluye IVA, no hace falta sumarlo aparte encima.
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

  // Si ya había un venue elegido, reevalúa si la modalidad debe verse.
  if (document.getElementById("bk-venue-select").value) {
    alSeleccionarVenueBooking();
  }

  renderArtistasBooking(); // vuelve a pintar las filas para mostrar/ocultar Comisión
}

function alCambiarOrigenCache() {
  const origen = document.querySelector('input[name="bk-origen"]:checked').value;
  document.getElementById("campo-bk-cliente").style.display = origen === "cliente" ? "block" : "none";
  document.getElementById("campo-bk-propuesta").style.display = origen === "propuesta" ? "block" : "none";
}

function alSeleccionarPropuestaBooking() {
  const id = document.getElementById("bk-propuesta").value;
  const propuesta = propuestasCacheBk.find((p) => p.id === id);
  if (propuesta && propuesta.clienteId) {
    document.getElementById("bk-cliente").value = propuesta.clienteId;
  }
}

// ---------- Cálculo general ----------

function formatoEuroBk(n) {
  return Number(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function recalcularBooking() {
  const esPromotor = document.querySelector('input[name="bk-tipo"]:checked').value === "promotor";

  const totalArtistas = artistasBooking.reduce((sum, a) => sum + totalArtistaBooking(a, esPromotor), 0);
  document.getElementById("bk-calc-label-artistas").textContent = esPromotor ? "Total artistas (coste)" : "Total artistas (a facturar)";
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

// ---------- Listado ----------

function escucharBookings() {
  db.collection("bookings").orderBy("creadoEl", "desc").onSnapshot(
    (snap) => {
      const filas = [];
      snap.forEach((doc) => filas.push({ id: doc.id, ...doc.data() }));
      pintarTablaBookings(filas);
    },
    (err) => {
      console.error(err);
      mostrarToast("No se pudo cargar el listado de bookings.");
    }
  );
}

function nombresArtistasBooking(b) {
  const artistas = Array.isArray(b.artistas) ? b.artistas : [];
  if (artistas.length === 0) return "—";
  return artistas.map((a) => a.nombre).join(", ");
}

function totalGeneralBookingGuardado(b) {
  const esPromotor = b.tipo === "promotor";
  const artistas = Array.isArray(b.artistas) ? b.artistas : [];
  let total = artistas.reduce((sum, a) => sum + totalArtistaBooking(a, esPromotor), 0);
  if (esPromotor) {
    const costeVenue = b.costeVenue || 0;
    total += costeVenue * (1 + (b.costeVenueIvaPct || 0) / 100);
  }
  return total;
}

function pintarTablaBookings(bookings) {
  const tbody = document.getElementById("tabla-bookings");
  document.getElementById("contador-bookings").textContent =
    bookings.length + (bookings.length === 1 ? " booking" : " bookings");

  if (bookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:36px; color:var(--color-text-muted);">
      Todavía no hay bookings creados.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = bookings
    .map((b) => {
      const fecha = b.fecha ? new Date(b.fecha + "T00:00:00").toLocaleDateString("es-ES") : "—";
      const contraparte = b.tipo === "promotor" ? b.espacio : b.clienteNombre;

      return `
        <tr>
          <td><span class="id-badge">${escaparHtmlBk(b.idVisible || "—")}</span> <span class="permiso-tag">V${b.version || 1}</span></td>
          <td style="font-weight:600;">${escaparHtmlBk(nombresArtistasBooking(b))}</td>
          <td><span class="booking-tipo-badge ${b.tipo}">${b.tipo === "promotor" ? "Promotor" : "A caché"}</span></td>
          <td>${escaparHtmlBk(contraparte || "—")}</td>
          <td>${fecha}</td>
          <td style="font-weight:600;">${formatoEuroBk(totalGeneralBookingGuardado(b))}</td>
          <td>
            <div class="row-actions" style="justify-content:flex-end;">
              <button class="icon-btn" title="Editar" onclick='abrirModalEdicionBooking(${JSON.stringify(b).replace(/'/g, "&#39;")})'>✎</button>
              <button class="icon-btn" title="Crear nueva versión" onclick='crearNuevaVersionBooking(${JSON.stringify(b).replace(/'/g, "&#39;")})'>⎘</button>
              <button class="icon-btn danger" title="Eliminar" onclick="confirmarEliminarBooking('${b.id}', '${escaparHtmlBk(nombresArtistasBooking(b)).replace(/'/g, "\\'")}')">🗑</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function escaparHtmlBk(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function fechaISOBk(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------- Modal ----------

const formBooking = document.getElementById("form-booking");
const overlayBooking = document.getElementById("modal-overlay");

function abrirModalBooking() {
  formBooking.reset();
  bookingRepartoPromotorPct = null;
  bookingRepartoVenuePct = null;
  artistasBooking = [];
  document.getElementById("bk-id-edicion").value = "";
  document.getElementById("campo-id-existente").style.display = "none";
  document.getElementById("bk-fecha").value = fechaISOBk(new Date());
  document.getElementById("bk-venue-iva-pct").value = 21;
  document.getElementById("modal-titulo").textContent = "Nuevo booking";
  document.getElementById("modal-sub").textContent = "Se le asignará automáticamente un ID correlativo (BO<año>-0001).";
  document.getElementById("btn-guardar").textContent = "Crear booking";
  alCambiarTipoBooking();
  alCambiarOrigenCache();
  anadirArtistaBooking(); // arranca con una fila lista para rellenar
  ocultarMsgModalBk();
  overlayBooking.classList.add("show");
}

function abrirModalEdicionBooking(b) {
  formBooking.reset();
  bookingRepartoPromotorPct = b.repartoPromotorPct != null ? b.repartoPromotorPct : null;
  bookingRepartoVenuePct = b.repartoVenuePct != null ? b.repartoVenuePct : null;
  document.getElementById("bk-id-edicion").value = b.id;
  document.getElementById("campo-id-existente").style.display = "block";
  document.getElementById("bk-id-badge").textContent = b.idVisible || "—";

  document.querySelector(`input[name="bk-tipo"][value="${b.tipo || "cache"}"]`).checked = true;

  artistasBooking = Array.isArray(b.artistas) && b.artistas.length ? JSON.parse(JSON.stringify(b.artistas)) : [{ rosterId: null, nombre: "", cache: null, comisionPct: 0, ivaPct: 21 }];

  // El venue es común a los dos tipos de booking.
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

  document.getElementById("bk-fecha").value = b.fecha || fechaISOBk(new Date());
  document.getElementById("bk-ciudad").value = b.ciudad || "";
  document.getElementById("bk-notas").value = b.notas || "";

  document.getElementById("modal-titulo").textContent = "Editar booking";
  document.getElementById("modal-sub").textContent = "El ID de un booking no cambia una vez creado.";
  document.getElementById("btn-guardar").textContent = "Guardar cambios";

  alCambiarTipoBooking();
  alCambiarOrigenCache();
  renderArtistasBooking();
  ocultarMsgModalBk();
  overlayBooking.classList.add("show");
}

function cerrarModal() {
  overlayBooking.classList.remove("show");
}

function ocultarMsgModalBk() {
  const m = document.getElementById("modal-msg");
  m.className = "form-msg";
  m.textContent = "";
}

function mostrarMsgModalBk(texto) {
  const m = document.getElementById("modal-msg");
  m.textContent = texto;
  m.className = "form-msg show error";
}

formBooking.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("bk-id-edicion").value;
  const btn = document.getElementById("btn-guardar");
  btn.disabled = true;

  const tipo = document.querySelector('input[name="bk-tipo"]:checked').value;
  const artistasValidos = artistasBooking.filter((a) => a.rosterId);

  if (artistasValidos.length === 0) {
    mostrarMsgModalBk("Añade al menos un artista del Roster.");
    btn.disabled = false;
    return;
  }

  const datosBase = {
    tipo,
    artistas: artistasValidos,
    fecha: document.getElementById("bk-fecha").value,
    ciudad: document.getElementById("bk-ciudad").value.trim(),
    notas: document.getElementById("bk-notas").value.trim(),
    // El venue es común a los dos tipos de booking, y se elige de la lista.
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
    if (id) {
      await db.collection("bookings").doc(id).update(datosBase);
      mostrarToast("Booking actualizado.");
      cerrarModal();
    } else {
      const idVisible = await generarSiguienteId(PREFIJOS_ID.booking);

      await db.collection("bookings").add({
        ...datosBase,
        idVisible,
        creadoPor: nombreCompletoDe(usuarioActualBk) || usuarioActualBk.email,
        creadoPorUid: usuarioActualBk.uid,
        creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // También queda marcada en el Calendario, el día de creación.
      const contraparte = tipo === "promotor" ? datosBase.espacio : datosBase.clienteNombre;
      const nombresArtistas = artistasValidos.map((a) => a.nombre).join(", ");
      await db.collection("documentos").add({
        tipo: "Booking",
        titulo: `${nombresArtistas} — ${contraparte || "—"} (${idVisible})`,
        fecha: fechaISOBk(new Date()),
        enlace: "",
        notas: `Booking ${idVisible}`,
        creadoPor: nombreCompletoDe(usuarioActualBk) || usuarioActualBk.email,
        creadoPorUid: usuarioActualBk.uid,
        creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
      });

      mostrarToast(`Booking ${idVisible} creado y marcado en el calendario.`);
      cerrarModal();
    }
  } catch (err) {
    console.error(err);
    mostrarMsgModalBk("No se pudo guardar. Inténtalo de nuevo.");
  } finally {
    btn.disabled = false;
  }
});

// ---------- Versiones ----------

async function crearNuevaVersionBooking(b) {
  if (!confirm(`¿Crear la versión V${(b.version || 1) + 1} de este booking? El original (V${b.version || 1}) se conserva como histórico.`)) return;

  try {
    const { id, creadoEl, ...datos } = b;
    await db.collection("bookings").add({
      ...datos,
      version: (b.version || 1) + 1,
      grupoVersionId: b.grupoVersionId || b.id,
      versionAnteriorId: b.id,
      creadoPor: nombreCompletoDe(usuarioActualBk) || usuarioActualBk.email,
      creadoPorUid: usuarioActualBk.uid,
      creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
    });
    // Si el original todavía no tenía grupoVersionId (era la V1), se lo asignamos ahora.
    if (!b.grupoVersionId) {
      await db.collection("bookings").doc(b.id).update({ grupoVersionId: b.id });
    }
    mostrarToast(`Versión V${(b.version || 1) + 1} creada.`);
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo crear la nueva versión.");
  }
}

// ---------- Eliminar ----------

function confirmarEliminarBooking(id, nombre) {
  if (!confirm(`¿Eliminar el booking de "${nombre}"? Esto no borra su marca en el calendario.`)) return;
  db.collection("bookings")
    .doc(id)
    .delete()
    .then(() => mostrarToast("Booking eliminado."))
    .catch((err) => {
      console.error(err);
      mostrarToast("No se pudo eliminar.");
    });
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
