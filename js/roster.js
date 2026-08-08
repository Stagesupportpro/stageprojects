// =========================================================
// STAGE SUPPORT — roster.js (listado)
// El alta rápida solo pide el nombre; el resto se rellena en el
// editor completo (roster-detalle.html).
// =========================================================

let usuarioActualRoster = null;

(async function () {
  usuarioActualRoster = await protegerPagina(["Comercial", "Admin"]);
  pintarNav(usuarioActualRoster.rol, "roster");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualRoster) || usuarioActualRoster.email;
  document.getElementById("pass-role").textContent = usuarioActualRoster.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualRoster.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualRoster.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualRoster) || usuarioActualRoster.email);
  }

  escucharRoster();
})();

function escucharRoster() {
  db.collection("roster").orderBy("nombre").onSnapshot(
    (snap) => {
      const filas = [];
      snap.forEach((doc) => filas.push({ id: doc.id, ...doc.data() }));
      pintarTablaRoster(filas);
    },
    (err) => {
      console.error(err);
      mostrarToast("No se pudo cargar el roster.");
    }
  );
}

function pintarTablaRoster(items) {
  const tbody = document.getElementById("tabla-roster");
  document.getElementById("contador-roster").textContent =
    items.length + (items.length === 1 ? " espectáculo" : " espectáculos");

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:36px; color:var(--color-text-muted);">
      Todavía no hay espectáculos en el roster.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = items
    .map((r) => {
      const cacheTexto = r.cache != null ? `${Number(r.cache).toLocaleString("es-ES")} €` : "—";
      return `
        <tr>
          <td>
            <div class="avatar-chip">
              ${r.imagenCartel ? `<img class="avatar-photo" src="${r.imagenCartel}" alt="" />` : `<span class="initials">${inicialesDe(r.nombre)}</span>`}
              <div style="font-weight:600;">${escaparHtmlRoster(r.nombre)}</div>
            </div>
          </td>
          <td>${escaparHtmlRoster(r.oficinaRepresentacion || "—")}</td>
          <td>${cacheTexto}</td>
          <td>
            <div class="row-actions" style="justify-content:flex-end;">
              <a class="btn-ghost" style="text-decoration:none; padding:6px 12px; font-size:12px;" href="roster-detalle.html?id=${r.id}">Abrir</a>
              <button class="icon-btn danger" title="Eliminar" onclick="confirmarEliminarRoster('${r.id}', '${escaparHtmlRoster(r.nombre).replace(/'/g, "\\'")}')">🗑</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function escaparHtmlRoster(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

async function crearRoster() {
  const nombre = prompt("Nombre del espectáculo / artista:");
  if (!nombre || !nombre.trim()) return;

  try {
    const ref = await db.collection("roster").add({
      nombre: nombre.trim(),
      creadoPor: nombreCompletoDe(usuarioActualRoster) || usuarioActualRoster.email,
      creadoPorUid: usuarioActualRoster.uid,
      creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
    });
    window.location.href = `roster-detalle.html?id=${ref.id}`;
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo crear. Inténtalo de nuevo.");
  }
}

function confirmarEliminarRoster(id, nombre) {
  if (!confirm(`¿Eliminar "${nombre}" del roster?`)) return;
  db.collection("roster")
    .doc(id)
    .delete()
    .then(() => mostrarToast("Eliminado del roster."))
    .catch((err) => {
      console.error(err);
      mostrarToast("No se pudo eliminar.");
    });
}

// ---------- Toast ----------

let toastTimerRoster;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerRoster);
  toastTimerRoster = setTimeout(() => t.classList.remove("show"), 3200);
}
