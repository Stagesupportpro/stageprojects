// =========================================================
// STAGE SUPPORT — venues.js (listado)
// =========================================================

let usuarioActualVen = null;

(async function () {
  usuarioActualVen = await protegerPagina(["Comercial", "Admin"]);
  pintarNav(usuarioActualVen.rol, "venues");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualVen) || usuarioActualVen.email;
  document.getElementById("pass-role").textContent = usuarioActualVen.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualVen.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualVen.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualVen) || usuarioActualVen.email);
  }

  escucharVenues();
})();

function escucharVenues() {
  db.collection("venues").orderBy("nombre").onSnapshot(
    (snap) => {
      const filas = [];
      snap.forEach((doc) => filas.push({ id: doc.id, ...doc.data() }));
      pintarTablaVenues(filas);
    },
    (err) => {
      console.error(err);
      mostrarToast("No se pudo cargar el listado de venues.");
    }
  );
}

function pintarTablaVenues(venues) {
  const tbody = document.getElementById("tabla-venues");
  document.getElementById("contador-venues").textContent =
    venues.length + (venues.length === 1 ? " venue" : " venues");

  if (venues.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:36px; color:var(--color-text-muted);">
      Todavía no hay venues creados.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = venues
    .map((v) => {
      const contactoPrincipal = Array.isArray(v.contactos) && v.contactos.length ? v.contactos[0].nombre : "—";
      const taquilla = Array.isArray(v.tarifas) && v.tarifas.some((t) => t.taquillaCompartida) ? "Sí" : "No";
      return `
        <tr>
          <td style="font-weight:600;">${escaparHtmlVen(v.nombre)}</td>
          <td>${escaparHtmlVen(v.direccion || "—")}</td>
          <td>${escaparHtmlVen(contactoPrincipal)}</td>
          <td>${taquilla}</td>
          <td>
            <div class="row-actions" style="justify-content:flex-end;">
              <a class="btn-ghost" style="text-decoration:none; padding:6px 12px; font-size:12px;" href="venue-detalle.html?id=${v.id}">Abrir</a>
              <button class="icon-btn danger" title="Eliminar" onclick="confirmarEliminarVenue('${v.id}', '${escaparHtmlVen(v.nombre).replace(/'/g, "\\'")}')">🗑</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function escaparHtmlVen(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// ---------- Modal alta rápida ----------

const formVenue = document.getElementById("form-venue");
const overlayVenue = document.getElementById("modal-overlay");

function abrirModalVenue() {
  formVenue.reset();
  overlayVenue.classList.add("show");
}

function cerrarModal() {
  overlayVenue.classList.remove("show");
}

formVenue.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btn-guardar");
  btn.disabled = true;

  try {
    const ref = await db.collection("venues").add({
      nombre: document.getElementById("v-nombre").value.trim(),
      direccion: document.getElementById("v-direccion").value.trim(),
      mapsUrl: "",
      contactos: [],
      condiciones: "",
      tarifas: [],
      ridersPdf: [],
      notas: "",
      creadoPor: nombreCompletoDe(usuarioActualVen) || usuarioActualVen.email,
      creadoPorUid: usuarioActualVen.uid,
      creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
    });

    window.location.href = `venue-detalle.html?id=${ref.id}`;
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo crear. Inténtalo de nuevo.");
    btn.disabled = false;
  }
});

function confirmarEliminarVenue(id, nombre) {
  if (!confirm(`¿Eliminar el venue "${nombre}"?`)) return;
  db.collection("venues")
    .doc(id)
    .delete()
    .then(() => mostrarToast("Venue eliminado."))
    .catch((err) => {
      console.error(err);
      mostrarToast("No se pudo eliminar.");
    });
}

// ---------- Toast ----------

let toastTimerVen;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerVen);
  toastTimerVen = setTimeout(() => t.classList.remove("show"), 3200);
}
