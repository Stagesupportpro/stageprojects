// =========================================================
// STAGE SUPPORT — agenda.js
// Colección: /agenda/{id} → { titulo, fecha, hora, ubicacion,
//   descripcion, propietarioUid, propietarioNombre,
//   compartidoCon: [uid...], compartidoConNombres: [nombre...], creadoEl }
// Se muestran las propias + las compartidas conmigo (dos listeners
// combinados, porque Firestore no permite un OR entre esos dos campos).
// =========================================================

let usuarioActualAg = null;
let usuariosCacheAg = [];
let propiasAg = [];
let compartidasAg = [];

(async function () {
  usuarioActualAg = await protegerPagina();
  pintarNav(usuarioActualAg.rol, "agenda");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualAg) || usuarioActualAg.email;
  document.getElementById("pass-role").textContent = usuarioActualAg.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualAg.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualAg.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualAg) || usuarioActualAg.email);
  }

  await cargarUsuariosAg();
  escucharAgenda();
})();

async function cargarUsuariosAg() {
  try {
    const snap = await db.collection("usuarios").orderBy("nombre").get();
    usuariosCacheAg = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.id !== usuarioActualAg.uid);
    pintarListaCompartirAg();
  } catch (err) {
    console.error(err);
  }
}

function pintarListaCompartirAg() {
  const cont = document.getElementById("ag-compartir-list");
  if (usuariosCacheAg.length === 0) {
    cont.innerHTML = `<p style="font-size:12.5px; color:var(--color-text-muted);">No hay más empleados todavía.</p>`;
    return;
  }
  cont.innerHTML = usuariosCacheAg
    .map(
      (u) => `
        <label class="permiso-check">
          <input type="checkbox" value="${u.id}" data-nombre="${escaparAttrAg(nombreCompletoDe(u) || u.email)}" />
          ${escaparHtmlAg(nombreCompletoDe(u) || u.email)}
        </label>
      `
    )
    .join("");
}

// ---------- Listado (propias + compartidas) ----------

function escucharAgenda() {
  db.collection("agenda").where("propietarioUid", "==", usuarioActualAg.uid).onSnapshot(
    (snap) => {
      propiasAg = snap.docs.map((d) => ({ id: d.id, ...d.data(), esMia: true }));
      pintarListaAgenda();
    },
    (err) => console.error(err)
  );

  db.collection("agenda").where("compartidoCon", "array-contains", usuarioActualAg.uid).onSnapshot(
    (snap) => {
      compartidasAg = snap.docs.map((d) => ({ id: d.id, ...d.data(), esMia: false }));
      pintarListaAgenda();
    },
    (err) => console.error(err)
  );
}

function pintarListaAgenda() {
  const cont = document.getElementById("lista-agenda");
  const todas = [...propiasAg, ...compartidasAg].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));

  if (todas.length === 0) {
    cont.innerHTML = `<div class="empty-state"><strong>Sin citas todavía</strong>Crea la primera con "+ Nueva cita".</div>`;
    return;
  }

  cont.innerHTML = todas
    .map((a) => {
      const fecha = a.fecha ? new Date(a.fecha + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—";
      const compartidos = Array.isArray(a.compartidoConNombres) ? a.compartidoConNombres : [];
      return `
        <div class="item-card">
          <div class="item-card-top">
            <div class="item-card-title">${escaparHtmlAg(a.titulo)}</div>
            ${a.esMia ? `<div class="row-actions">
              <button class="icon-btn" title="Editar" onclick='abrirModalEdicionAgenda(${JSON.stringify(a).replace(/'/g, "&#39;")})'>✎</button>
              <button class="icon-btn danger" title="Eliminar" onclick="confirmarEliminarAgenda('${a.id}')">🗑</button>
            </div>` : `<span class="permiso-tag">Compartida por ${escaparHtmlAg(a.propietarioNombre || "—")}</span>`}
          </div>
          <div class="item-card-meta">${fecha}${a.hora ? " · " + a.hora : ""}${a.ubicacion ? " · " + escaparHtmlAg(a.ubicacion) : ""}</div>
          ${a.descripcion ? `<div class="item-card-desc">${escaparHtmlAg(a.descripcion)}</div>` : ""}
          ${compartidos.length ? `<div class="item-card-shared">${compartidos.map((n) => `<span class="permiso-tag">${escaparHtmlAg(n)}</span>`).join("")}</div>` : ""}
        </div>
      `;
    })
    .join("");
}

function escaparHtmlAg(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function escaparAttrAg(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// ---------- Modal ----------

const formAgenda = document.getElementById("form-agenda");
const overlayAgenda = document.getElementById("modal-overlay");

function abrirModalAgenda() {
  formAgenda.reset();
  document.getElementById("ag-id-edicion").value = "";
  document.getElementById("modal-titulo").textContent = "Nueva cita";
  document.getElementById("btn-guardar").textContent = "Crear cita";
  document.querySelectorAll("#ag-compartir-list input").forEach((c) => (c.checked = false));
  ocultarMsgAg();
  overlayAgenda.classList.add("show");
}

function abrirModalEdicionAgenda(a) {
  formAgenda.reset();
  document.getElementById("ag-id-edicion").value = a.id;
  document.getElementById("ag-titulo").value = a.titulo || "";
  document.getElementById("ag-fecha").value = a.fecha || "";
  document.getElementById("ag-hora").value = a.hora || "";
  document.getElementById("ag-ubicacion").value = a.ubicacion || "";
  document.getElementById("ag-descripcion").value = a.descripcion || "";
  const compartidoCon = Array.isArray(a.compartidoCon) ? a.compartidoCon : [];
  document.querySelectorAll("#ag-compartir-list input").forEach((c) => (c.checked = compartidoCon.includes(c.value)));
  document.getElementById("modal-titulo").textContent = "Editar cita";
  document.getElementById("btn-guardar").textContent = "Guardar cambios";
  ocultarMsgAg();
  overlayAgenda.classList.add("show");
}

function cerrarModal() {
  overlayAgenda.classList.remove("show");
}

function ocultarMsgAg() {
  const m = document.getElementById("modal-msg");
  m.className = "form-msg";
  m.textContent = "";
}

formAgenda.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("ag-id-edicion").value;
  const btn = document.getElementById("btn-guardar");
  btn.disabled = true;

  const seleccionados = Array.from(document.querySelectorAll("#ag-compartir-list input:checked"));
  const compartidoCon = seleccionados.map((c) => c.value);
  const compartidoConNombres = seleccionados.map((c) => c.dataset.nombre);

  const datos = {
    titulo: document.getElementById("ag-titulo").value.trim(),
    fecha: document.getElementById("ag-fecha").value,
    hora: document.getElementById("ag-hora").value,
    ubicacion: document.getElementById("ag-ubicacion").value.trim(),
    descripcion: document.getElementById("ag-descripcion").value.trim(),
    compartidoCon,
    compartidoConNombres,
  };

  try {
    if (id) {
      await db.collection("agenda").doc(id).update(datos);
      mostrarToast("Cita actualizada.");
    } else {
      await db.collection("agenda").add({
        ...datos,
        propietarioUid: usuarioActualAg.uid,
        propietarioNombre: nombreCompletoDe(usuarioActualAg) || usuarioActualAg.email,
        creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
      });
      mostrarToast("Cita creada.");
    }

    if (compartidoCon.length) {
      await notificarAVarios(compartidoCon, "agenda", `te ha compartido una cita: "${datos.titulo}"`, "agenda.html", usuarioActualAg);
    }

    cerrarModal();
  } catch (err) {
    console.error(err);
    document.getElementById("modal-msg").textContent = "No se pudo guardar. Inténtalo de nuevo.";
    document.getElementById("modal-msg").className = "form-msg show error";
  } finally {
    btn.disabled = false;
  }
});

function confirmarEliminarAgenda(id) {
  if (!confirm("¿Eliminar esta cita?")) return;
  db.collection("agenda")
    .doc(id)
    .delete()
    .then(() => mostrarToast("Cita eliminada."))
    .catch((err) => {
      console.error(err);
      mostrarToast("No se pudo eliminar.");
    });
}

// ---------- Toast ----------

let toastTimerAg;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerAg);
  toastTimerAg = setTimeout(() => t.classList.remove("show"), 3200);
}
