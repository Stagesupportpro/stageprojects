// =========================================================
// STAGE SUPPORT — notas.js
// Colección: /notas/{id} → { titulo, descripcion, propietarioUid,
//   propietarioNombre, compartidoCon: [uid...],
//   compartidoConNombres: [nombre...], creadoEl }
// =========================================================

let usuarioActualNt = null;
let usuariosCacheNt = [];
let propiasNt = [];
let compartidasNt = [];

(async function () {
  usuarioActualNt = await protegerPagina();
  pintarNav(usuarioActualNt.rol, "notas");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualNt) || usuarioActualNt.email;
  document.getElementById("pass-role").textContent = usuarioActualNt.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualNt.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualNt.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualNt) || usuarioActualNt.email);
  }

  await cargarUsuariosNt();
  escucharNotas();
})();

async function cargarUsuariosNt() {
  try {
    const snap = await db.collection("usuarios").orderBy("nombre").get();
    usuariosCacheNt = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.id !== usuarioActualNt.uid);
    pintarListaCompartirNt();
  } catch (err) {
    console.error(err);
  }
}

function pintarListaCompartirNt() {
  const cont = document.getElementById("nt-compartir-list");
  if (usuariosCacheNt.length === 0) {
    cont.innerHTML = `<p style="font-size:12.5px; color:var(--color-text-muted);">No hay más empleados todavía.</p>`;
    return;
  }
  cont.innerHTML = usuariosCacheNt
    .map(
      (u) => `
        <label class="permiso-check">
          <input type="checkbox" value="${u.id}" data-nombre="${escaparAttrNt(nombreCompletoDe(u) || u.email)}" />
          ${escaparHtmlNt(nombreCompletoDe(u) || u.email)}
        </label>
      `
    )
    .join("");
}

// ---------- Listado (propias + compartidas) ----------

function escucharNotas() {
  db.collection("notas").where("propietarioUid", "==", usuarioActualNt.uid).onSnapshot(
    (snap) => {
      propiasNt = snap.docs.map((d) => ({ id: d.id, ...d.data(), esMia: true }));
      pintarListaNotas();
    },
    (err) => console.error(err)
  );

  db.collection("notas").where("compartidoCon", "array-contains", usuarioActualNt.uid).onSnapshot(
    (snap) => {
      compartidasNt = snap.docs.map((d) => ({ id: d.id, ...d.data(), esMia: false }));
      pintarListaNotas();
    },
    (err) => console.error(err)
  );
}

function pintarListaNotas() {
  const cont = document.getElementById("lista-notas");
  const todas = [...propiasNt, ...compartidasNt].sort((a, b) => {
    const fa = a.creadoEl && a.creadoEl.toMillis ? a.creadoEl.toMillis() : 0;
    const fb = b.creadoEl && b.creadoEl.toMillis ? b.creadoEl.toMillis() : 0;
    return fb - fa;
  });

  if (todas.length === 0) {
    cont.innerHTML = `<div class="empty-state"><strong>Sin notas todavía</strong>Crea la primera con "+ Nueva nota".</div>`;
    return;
  }

  cont.innerHTML = todas
    .map((n) => {
      const fecha = n.creadoEl && n.creadoEl.toDate ? n.creadoEl.toDate().toLocaleDateString("es-ES") : "";
      const compartidos = Array.isArray(n.compartidoConNombres) ? n.compartidoConNombres : [];
      return `
        <div class="item-card">
          <div class="item-card-top">
            <div class="item-card-title">${escaparHtmlNt(n.titulo)}</div>
            ${n.esMia ? `<div class="row-actions">
              <button class="icon-btn" title="Editar" onclick='abrirModalEdicionNota(${JSON.stringify(n).replace(/'/g, "&#39;")})'>✎</button>
              <button class="icon-btn danger" title="Eliminar" onclick="confirmarEliminarNota('${n.id}')">🗑</button>
            </div>` : `<span class="permiso-tag">Compartida por ${escaparHtmlNt(n.propietarioNombre || "—")}</span>`}
          </div>
          <div class="item-card-meta">${fecha}</div>
          ${n.descripcion ? `<div class="item-card-desc">${escaparHtmlNt(n.descripcion)}</div>` : ""}
          ${compartidos.length ? `<div class="item-card-shared">${compartidos.map((x) => `<span class="permiso-tag">${escaparHtmlNt(x)}</span>`).join("")}</div>` : ""}
        </div>
      `;
    })
    .join("");
}

function escaparHtmlNt(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function escaparAttrNt(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// ---------- Modal ----------

const formNota = document.getElementById("form-nota");
const overlayNota = document.getElementById("modal-overlay");

function abrirModalNota() {
  formNota.reset();
  document.getElementById("nt-id-edicion").value = "";
  document.getElementById("modal-titulo").textContent = "Nueva nota";
  document.getElementById("btn-guardar").textContent = "Crear nota";
  document.querySelectorAll("#nt-compartir-list input").forEach((c) => (c.checked = false));
  ocultarMsgNt();
  overlayNota.classList.add("show");
}

function abrirModalEdicionNota(n) {
  formNota.reset();
  document.getElementById("nt-id-edicion").value = n.id;
  document.getElementById("nt-titulo").value = n.titulo || "";
  document.getElementById("nt-descripcion").value = n.descripcion || "";
  const compartidoCon = Array.isArray(n.compartidoCon) ? n.compartidoCon : [];
  document.querySelectorAll("#nt-compartir-list input").forEach((c) => (c.checked = compartidoCon.includes(c.value)));
  document.getElementById("modal-titulo").textContent = "Editar nota";
  document.getElementById("btn-guardar").textContent = "Guardar cambios";
  ocultarMsgNt();
  overlayNota.classList.add("show");
}

function cerrarModal() {
  overlayNota.classList.remove("show");
}

function ocultarMsgNt() {
  const m = document.getElementById("modal-msg");
  m.className = "form-msg";
  m.textContent = "";
}

function fechaISONt(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

formNota.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("nt-id-edicion").value;
  const btn = document.getElementById("btn-guardar");
  btn.disabled = true;

  const seleccionados = Array.from(document.querySelectorAll("#nt-compartir-list input:checked"));
  const compartidoCon = seleccionados.map((c) => c.value);
  const compartidoConNombres = seleccionados.map((c) => c.dataset.nombre);

  const datos = {
    titulo: document.getElementById("nt-titulo").value.trim(),
    descripcion: document.getElementById("nt-descripcion").value.trim(),
    compartidoCon,
    compartidoConNombres,
  };

  try {
    if (id) {
      await db.collection("notas").doc(id).update(datos);
      mostrarToast("Nota actualizada.");
    } else {
      await db.collection("notas").add({
        ...datos,
        propietarioUid: usuarioActualNt.uid,
        propietarioNombre: nombreCompletoDe(usuarioActualNt) || usuarioActualNt.email,
        creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
      });
      mostrarToast("Nota creada.");

      if (document.getElementById("nt-tambien-agenda").checked) {
        await db.collection("agenda").add({
          titulo: datos.titulo,
          fecha: fechaISONt(new Date()),
          hora: "",
          ubicacion: "",
          descripcion: datos.descripcion,
          compartidoCon,
          compartidoConNombres,
          propietarioUid: usuarioActualNt.uid,
          propietarioNombre: nombreCompletoDe(usuarioActualNt) || usuarioActualNt.email,
          creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    if (compartidoCon.length) {
      await notificarAVarios(compartidoCon, "nota", `te ha compartido una nota: "${datos.titulo}"`, "notas.html", usuarioActualNt);
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

function confirmarEliminarNota(id) {
  if (!confirm("¿Eliminar esta nota?")) return;
  db.collection("notas")
    .doc(id)
    .delete()
    .then(() => mostrarToast("Nota eliminada."))
    .catch((err) => {
      console.error(err);
      mostrarToast("No se pudo eliminar.");
    });
}

// ---------- Toast ----------

let toastTimerNt;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerNt);
  toastTimerNt = setTimeout(() => t.classList.remove("show"), 3200);
}
