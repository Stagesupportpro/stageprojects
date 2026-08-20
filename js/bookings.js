// =========================================================
// STAGE SUPPORT — bookings.js (listado)
// La creación/edición completa vive en booking-detalle.html.
// Aquí solo se lista, se crea el registro mínimo (redirige a la
// ficha) y se ofrecen las acciones rápidas (versión, eliminar).
// =========================================================

let usuarioActualBk = null;

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

  escucharBookings();
})();

function fechaISOBk(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatoEuroBk(n) {
  return Number(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function totalArtistaBookingLista(a, esPromotor) {
  const cache = a.cache || 0;
  const comisionPct = esPromotor ? 0 : a.comisionPct || 0;
  const ivaPct = a.ivaPct || 0;
  const pvp = cache * (1 + comisionPct / 100);
  return pvp * (1 + ivaPct / 100);
}

function totalGeneralBookingGuardado(b) {
  const esPromotor = b.tipo === "promotor";
  const artistas = Array.isArray(b.artistas) ? b.artistas : [];
  let total = artistas.reduce((sum, a) => sum + totalArtistaBookingLista(a, esPromotor), 0);
  if (esPromotor) {
    const costeVenue = b.costeVenue || 0;
    total += costeVenue * (1 + (b.costeVenueIvaPct || 0) / 100);
  }
  return total;
}

function nombresArtistasBooking(b) {
  const artistas = Array.isArray(b.artistas) ? b.artistas : [];
  return artistas.length ? artistas.map((a) => a.nombre).join(", ") : "—";
}

// ---------- Crear (redirige a la ficha completa) ----------

async function crearBookingRapido() {
  const btn = document.getElementById("btn-nuevo-booking");
  btn.disabled = true;
  btn.textContent = "Creando…";
  try {
    const idVisible = await generarSiguienteId(PREFIJOS_ID.booking);
    const ref = await db.collection("bookings").add({
      idVisible,
      tipo: "cache",
      artistas: [],
      fecha: fechaISOBk(new Date()),
      ciudad: "",
      notas: "",
      creadoPor: nombreCompletoDe(usuarioActualBk) || usuarioActualBk.email,
      creadoPorUid: usuarioActualBk.uid,
      creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
    });
    window.location.href = `booking-detalle.html?id=${ref.id}`;
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo crear el booking.");
    btn.disabled = false;
    btn.textContent = "+ Nuevo booking";
  }
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
              <a class="btn-ghost" style="text-decoration:none; padding:6px 12px; font-size:12px;" href="booking-detalle.html?id=${b.id}">Abrir</a>
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

// ---------- Versiones ----------

async function crearNuevaVersionBooking(b) {
  if (!confirm(`¿Crear la versión V${(b.version || 1) + 1} de este booking? El original (V${b.version || 1}) se conserva como histórico.`)) return;

  try {
    const { id, creadoEl, ...datos } = b;
    const ref = await db.collection("bookings").add({
      ...datos,
      version: (b.version || 1) + 1,
      grupoVersionId: b.grupoVersionId || b.id,
      versionAnteriorId: b.id,
      creadoPor: nombreCompletoDe(usuarioActualBk) || usuarioActualBk.email,
      creadoPorUid: usuarioActualBk.uid,
      creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
    });
    if (!b.grupoVersionId) {
      await db.collection("bookings").doc(b.id).update({ grupoVersionId: b.id });
    }
    mostrarToast(`Versión V${(b.version || 1) + 1} creada.`);
    window.location.href = `booking-detalle.html?id=${ref.id}`;
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo crear la nueva versión.");
  }
}

// ---------- Eliminar ----------

function confirmarEliminarBooking(id, nombre) {
  if (!confirm(`¿Eliminar el booking de "${nombre}"? Esto también quita su marca del Calendario del Roster.`)) return;
  db.collection("bookings")
    .doc(id)
    .delete()
    .then(async () => {
      await eliminarCalendarioArtistasDeOrigen("booking", id);
      mostrarToast("Booking eliminado.");
    })
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
