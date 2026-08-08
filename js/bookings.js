// =========================================================
// STAGE SUPPORT — bookings.js
// Colección: /bookings/{id} → {
//   idVisible, tipo ('cache'|'promotor'),
//   artistaRosterId, artistaNombre,
//   origenCache ('cliente'|'propuesta'), clienteId, clienteNombre,
//   propuestaId, propuestaIdVisible,
//   espacio, espacioDireccion,
//   fecha, ciudad, cache, comisionPct, ivaPct,
//   creadoPor, creadoPorUid, creadoEl
// }
// Al crear un booking, también se marca en el Calendario (tipo "Booking").
// =========================================================

let usuarioActualBk = null;
let rosterCacheBk = [];
let clientesCacheBk = [];
let propuestasCacheBk = [];
let comisionesCacheBk = [];
let venuesCacheBk = [];
let bookingRepartoSalaPct = null;

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

  await Promise.all([cargarRosterBk(), cargarClientesBk(), cargarPropuestasBk(), cargarComisionesBk(), cargarVenuesBk()]);
  escucharBookings();
})();

// ---------- Listas de apoyo (Roster, Clientes, Propuestas, Comisiones) ----------

async function cargarRosterBk() {
  const sel = document.getElementById("bk-artista");
  try {
    const snap = await db.collection("roster").orderBy("nombre").get();
    rosterCacheBk = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    sel.innerHTML =
      `<option value="">— Selecciona del Roster —</option>` +
      rosterCacheBk.map((r) => `<option value="${r.id}">${escaparHtmlBk(r.nombre)}</option>`).join("");
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

async function cargarComisionesBk() {
  const sel = document.getElementById("bk-comision-preset");
  try {
    const snap = await db.collection("comisiones").orderBy("nombre").get();
    comisionesCacheBk = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    sel.innerHTML =
      `<option value="">— Manual —</option>` +
      comisionesCacheBk.map((c) => `<option value="${c.id}">${escaparHtmlBk(c.nombre)} (${c.porcentaje}%)</option>`).join("");
  } catch (err) {
    console.error(err);
  }
}

async function cargarVenuesBk() {
  try {
    const snap = await db.collection("venues").orderBy("nombre").get();
    venuesCacheBk = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const datalist = document.getElementById("lista-venues-datalist");
    datalist.innerHTML = venuesCacheBk.map((v) => `<option value="${escaparHtmlBk(v.nombre)}"></option>`).join("");
  } catch (err) {
    console.error(err);
  }
}

function alEscribirVenueBooking() {
  const texto = document.getElementById("bk-espacio-buscar").value.trim();
  const venue = venuesCacheBk.find((v) => v.nombre === texto);
  const campoModalidad = document.getElementById("campo-bk-modalidad");

  if (!venue) {
    document.getElementById("bk-venue-id").value = "";
    campoModalidad.style.display = "none";
    return;
  }

  document.getElementById("bk-venue-id").value = venue.id;
  document.getElementById("bk-espacio-direccion").value = venue.direccion || "";

  const tarifas = Array.isArray(venue.tarifas) ? venue.tarifas.filter((t) => t.concepto) : [];
  const sel = document.getElementById("bk-modalidad");
  if (tarifas.length === 0) {
    sel.innerHTML = `<option value="">Este venue no tiene tarifas guardadas — introduce el coste a mano</option>`;
    campoModalidad.style.display = "block";
    return;
  }
  sel.innerHTML =
    `<option value="">— Elige una modalidad/tarifa —</option>` +
    tarifas.map((t, i) => `<option value="${i}">${escaparHtmlBk(t.concepto)} — ${formatoEuroBk(t.importe)} (${t.impuestos === "con" ? "con" : "sin"} impuestos)</option>`).join("");
  campoModalidad.style.display = "block";
}

function alSeleccionarModalidadBooking() {
  const venueId = document.getElementById("bk-venue-id").value;
  const venue = venuesCacheBk.find((v) => v.id === venueId);
  const idx = document.getElementById("bk-modalidad").value;
  if (!venue || idx === "") return;
  const tarifa = venue.tarifas[idx];
  if (!tarifa) return;

  document.getElementById("bk-cache").value = tarifa.importe || 0;
  // Si la tarifa del venue ya incluye impuestos, no hace falta sumar IVA aparte encima.
  document.getElementById("bk-iva-pct").value = tarifa.impuestos === "con" ? 0 : document.getElementById("bk-iva-pct").value || 21;
  bookingRepartoSalaPct = tarifa.repartoSalaPct != null ? tarifa.repartoSalaPct : null;
  recalcularBooking();
}



function alCambiarTipoBooking() {
  const tipo = document.querySelector('input[name="bk-tipo"]:checked').value;
  document.getElementById("bloque-cache").style.display = tipo === "cache" ? "block" : "none";
  document.getElementById("bloque-promotor").style.display = tipo === "promotor" ? "block" : "none";

  const esPromotor = tipo === "promotor";
  document.getElementById("grupo-bk-comision").style.display = esPromotor ? "none" : "contents";
  document.getElementById("bk-calc-item-comision").style.display = esPromotor ? "none" : "flex";
  document.getElementById("bk-titulo-cifras").textContent = esPromotor ? "Coste e IVA" : "Caché, comisión e IVA";
  document.getElementById("bk-label-cache").textContent = esPromotor ? "Coste (alquiler del venue) €" : "Caché (BI) €";
  document.getElementById("bk-calc-label-cache").textContent = esPromotor ? "Coste" : "Caché (BI)";

  if (esPromotor) {
    // Sin comisión: la agencia no se cobra a sí misma.
    document.getElementById("bk-comision-pct").value = 0;
  }
  recalcularBooking();
}

function alCambiarOrigenCache() {
  const origen = document.querySelector('input[name="bk-origen"]:checked').value;
  document.getElementById("campo-bk-cliente").style.display = origen === "cliente" ? "block" : "none";
  document.getElementById("campo-bk-propuesta").style.display = origen === "propuesta" ? "block" : "none";
}

function alSeleccionarArtistaBooking() {
  const id = document.getElementById("bk-artista").value;
  const artista = rosterCacheBk.find((r) => r.id === id);
  if (!artista) return;
  // Autocompleta caché / comisión / IVA con los valores guardados en la ficha del Roster.
  if (artista.cache != null) document.getElementById("bk-cache").value = artista.cache;
  if (artista.comisionPorcentaje != null) document.getElementById("bk-comision-pct").value = artista.comisionPorcentaje;
  if (artista.ivaPorcentaje != null) document.getElementById("bk-iva-pct").value = artista.ivaPorcentaje;
  recalcularBooking();
}

function alSeleccionarPropuestaBooking() {
  const id = document.getElementById("bk-propuesta").value;
  const propuesta = propuestasCacheBk.find((p) => p.id === id);
  if (propuesta && propuesta.clienteId) {
    document.getElementById("bk-cliente").value = propuesta.clienteId;
  }
}

function aplicarComisionPresetBooking() {
  const id = document.getElementById("bk-comision-preset").value;
  const preset = comisionesCacheBk.find((c) => c.id === id);
  if (preset) {
    document.getElementById("bk-comision-pct").value = preset.porcentaje;
    recalcularBooking();
  }
}

function formatoEuroBk(n) {
  return Number(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function recalcularBooking() {
  const cache = parseFloat(document.getElementById("bk-cache").value) || 0;
  const comisionPct = parseFloat(document.getElementById("bk-comision-pct").value) || 0;
  const ivaPct = parseFloat(document.getElementById("bk-iva-pct").value) || 0;

  const comisionImporte = cache * (comisionPct / 100);
  const total = cache + comisionImporte;
  const ivaImporte = total * (ivaPct / 100);
  const totalConIva = total + ivaImporte;

  document.getElementById("bk-calc-cache").textContent = formatoEuroBk(cache);
  document.getElementById("bk-calc-comision").textContent = formatoEuroBk(comisionImporte);
  document.getElementById("bk-calc-total").textContent = formatoEuroBk(total);
  document.getElementById("bk-calc-total-iva").textContent = formatoEuroBk(totalConIva);

  return totalConIva;
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
      const cache = b.cache || 0;
      const comision = cache * ((b.comisionPct || 0) / 100);
      const total = cache + comision;
      const totalIva = total * (1 + (b.ivaPct || 0) / 100);
      const contraparte = b.tipo === "promotor" ? b.espacio : b.clienteNombre;

      return `
        <tr>
          <td><span class="id-badge">${escaparHtmlBk(b.idVisible || "—")}</span></td>
          <td style="font-weight:600;">${escaparHtmlBk(b.artistaNombre)}</td>
          <td><span class="booking-tipo-badge ${b.tipo}">${b.tipo === "promotor" ? "Promotor" : "A caché"}</span></td>
          <td>${escaparHtmlBk(contraparte || "—")}</td>
          <td>${fecha}</td>
          <td style="font-weight:600;">${formatoEuroBk(totalIva)}</td>
          <td>
            <div class="row-actions" style="justify-content:flex-end;">
              <button class="icon-btn" title="Editar" onclick='abrirModalEdicionBooking(${JSON.stringify(b).replace(/'/g, "&#39;")})'>✎</button>
              <button class="icon-btn danger" title="Eliminar" onclick="confirmarEliminarBooking('${b.id}', '${escaparHtmlBk(b.artistaNombre).replace(/'/g, "\\'")}')">🗑</button>
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
  bookingRepartoSalaPct = null;
  document.getElementById("bk-id-edicion").value = "";
  document.getElementById("campo-id-existente").style.display = "none";
  document.getElementById("bk-fecha").value = fechaISOBk(new Date());
  document.getElementById("bk-iva-pct").value = 21;
  document.getElementById("modal-titulo").textContent = "Nuevo booking";
  document.getElementById("modal-sub").textContent = "Se le asignará automáticamente un ID correlativo (BO<año>-0001).";
  document.getElementById("btn-guardar").textContent = "Crear booking";
  alCambiarTipoBooking();
  alCambiarOrigenCache();
  recalcularBooking();
  ocultarMsgModalBk();
  overlayBooking.classList.add("show");
}

function abrirModalEdicionBooking(b) {
  formBooking.reset();
  bookingRepartoSalaPct = b.repartoSalaPct != null ? b.repartoSalaPct : null;
  document.getElementById("bk-id-edicion").value = b.id;
  document.getElementById("campo-id-existente").style.display = "block";
  document.getElementById("bk-id-badge").textContent = b.idVisible || "—";

  document.querySelector(`input[name="bk-tipo"][value="${b.tipo || "cache"}"]`).checked = true;
  document.getElementById("bk-artista").value = b.artistaRosterId || "";

  if (b.tipo === "promotor") {
    document.getElementById("bk-espacio-buscar").value = b.espacio || "";
    document.getElementById("bk-venue-id").value = b.venueId || "";
    document.getElementById("bk-espacio-direccion").value = b.espacioDireccion || "";
    if (b.venueId) {
      alEscribirVenueBooking();
      if (b.modalidadIndice != null) {
        setTimeout(() => {
          document.getElementById("bk-modalidad").value = b.modalidadIndice;
        }, 0);
      }
    }
  } else {
    const origen = b.origenCache || "cliente";
    document.querySelector(`input[name="bk-origen"][value="${origen}"]`).checked = true;
    document.getElementById("bk-cliente").value = b.clienteId || "";
    document.getElementById("bk-propuesta").value = b.propuestaId || "";
  }

  document.getElementById("bk-fecha").value = b.fecha || fechaISOBk(new Date());
  document.getElementById("bk-ciudad").value = b.ciudad || "";
  document.getElementById("bk-cache").value = b.cache != null ? b.cache : "";
  document.getElementById("bk-comision-pct").value = b.comisionPct != null ? b.comisionPct : "";
  document.getElementById("bk-iva-pct").value = b.ivaPct != null ? b.ivaPct : 21;
  document.getElementById("bk-notas").value = b.notas || "";

  document.getElementById("modal-titulo").textContent = "Editar booking";
  document.getElementById("modal-sub").textContent = "El ID de un booking no cambia una vez creado.";
  document.getElementById("btn-guardar").textContent = "Guardar cambios";

  alCambiarTipoBooking();
  alCambiarOrigenCache();
  recalcularBooking();
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
  const artistaId = document.getElementById("bk-artista").value;
  const artistaEncontrado = rosterCacheBk.find((r) => r.id === artistaId);

  if (!artistaId) {
    mostrarMsgModalBk("Selecciona un artista del Roster.");
    btn.disabled = false;
    return;
  }

  const datosBase = {
    tipo,
    artistaRosterId: artistaId,
    artistaNombre: artistaEncontrado ? artistaEncontrado.nombre : "",
    fecha: document.getElementById("bk-fecha").value,
    ciudad: document.getElementById("bk-ciudad").value.trim(),
    cache: parseFloat(document.getElementById("bk-cache").value) || 0,
    comisionPct: parseFloat(document.getElementById("bk-comision-pct").value) || 0,
    ivaPct: parseFloat(document.getElementById("bk-iva-pct").value) || 0,
    notas: document.getElementById("bk-notas").value.trim(),
  };

  if (tipo === "promotor") {
    datosBase.espacio = document.getElementById("bk-espacio-buscar").value.trim();
    datosBase.venueId = document.getElementById("bk-venue-id").value || null;
    datosBase.modalidadIndice = document.getElementById("bk-modalidad").value !== "" ? document.getElementById("bk-modalidad").value : null;
    datosBase.repartoSalaPct = bookingRepartoSalaPct;
    datosBase.espacioDireccion = document.getElementById("bk-espacio-direccion").value.trim();
    datosBase.origenCache = null;
    datosBase.clienteId = null;
    datosBase.clienteNombre = null;
    datosBase.propuestaId = null;
    datosBase.propuestaIdVisible = null;
  } else {
    datosBase.venueId = null;
    datosBase.modalidadIndice = null;
    const origen = document.querySelector('input[name="bk-origen"]:checked').value;
    datosBase.origenCache = origen;
    datosBase.espacio = null;
    datosBase.espacioDireccion = null;

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
      await db.collection("documentos").add({
        tipo: "Booking",
        titulo: `${datosBase.artistaNombre} — ${contraparte || "—"} (${idVisible})`,
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
