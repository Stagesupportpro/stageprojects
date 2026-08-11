// =========================================================
// STAGE SUPPORT — propuestas.js (listado)
// =========================================================

const ETIQUETAS_ESTADO_PROPUESTA = {
  Borrador: "Borrador",
  Enviada: "Enviada",
  Aceptada: "Aceptada",
  Rechazada: "Rechazada",
};

let usuarioActualProp = null;
let clientesCacheProp = [];

(async function () {
  usuarioActualProp = await protegerPagina(["Comercial", "Admin"]);
  pintarNav(usuarioActualProp.rol, "propuestas");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualProp) || usuarioActualProp.email;
  document.getElementById("pass-role").textContent = usuarioActualProp.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualProp.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualProp.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualProp) || usuarioActualProp.email);
  }

  await cargarClientesProp();
  escucharPropuestas();
})();

async function cargarClientesProp() {
  const sel = document.getElementById("prop-cliente");
  try {
    const snap = await db.collection("clientes").orderBy("nombre").get();
    clientesCacheProp = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const opciones = clientesCacheProp.map((c) => `<option value="${c.id}">${escaparHtmlProp(c.nombre)}</option>`).join("");
    sel.innerHTML = `<option value="">— Sin vincular —</option>${opciones}`;
  } catch (err) {
    console.error(err);
  }
}

function escucharPropuestas() {
  db.collection("propuestas").orderBy("creadoEl", "desc").onSnapshot(
    (snap) => {
      const filas = [];
      snap.forEach((doc) => filas.push({ id: doc.id, ...doc.data() }));
      pintarTablaPropuestas(filas);
    },
    (err) => {
      console.error(err);
      mostrarToast("No se pudo cargar el listado de propuestas.");
    }
  );
}

function pintarTablaPropuestas(propuestas) {
  const tbody = document.getElementById("tabla-propuestas");
  document.getElementById("contador-propuestas").textContent =
    propuestas.length + (propuestas.length === 1 ? " propuesta" : " propuestas");

  if (propuestas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:36px; color:var(--color-text-muted);">
      Todavía no hay propuestas creadas.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = propuestas
    .map(
      (p) => `
        <tr>
          <td><span class="id-badge">${escaparHtmlProp(p.idVisible || "—")}</span> <span class="permiso-tag">V${p.version || 1}</span></td>
          <td style="font-weight:600;">${escaparHtmlProp(p.nombre)}</td>
          <td>${escaparHtmlProp(p.clienteNombre || "—")}</td>
          <td><span class="role-badge">${ETIQUETAS_ESTADO_PROPUESTA[p.estado] || "Borrador"}</span></td>
          <td>
            <div class="row-actions" style="justify-content:flex-end;">
              <a class="btn-ghost" style="text-decoration:none; padding:6px 12px; font-size:12px;" href="propuesta-ver.html?id=${p.id}" target="_blank">Ver</a>
              <a class="btn-ghost" style="text-decoration:none; padding:6px 12px; font-size:12px;" href="propuesta-detalle.html?id=${p.id}">Abrir</a>
              <button class="icon-btn" title="Crear nueva versión" onclick='crearNuevaVersionPropuesta(${JSON.stringify(p).replace(/'/g, "&#39;")})'>⎘</button>
              <button class="icon-btn danger" title="Eliminar" onclick="confirmarEliminarPropuesta('${p.id}', '${escaparHtmlProp(p.nombre).replace(/'/g, "\\'")}')">🗑</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

function escaparHtmlProp(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// ---------- Modal alta rápida ----------

const formPropuesta = document.getElementById("form-propuesta");
const overlayPropuesta = document.getElementById("modal-overlay");

function abrirModalPropuesta() {
  formPropuesta.reset();
  overlayPropuesta.classList.add("show");
}

function cerrarModal() {
  overlayPropuesta.classList.remove("show");
}

formPropuesta.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btn-guardar");
  btn.disabled = true;

  const clienteId = document.getElementById("prop-cliente").value;
  const clienteEncontrado = clientesCacheProp.find((c) => c.id === clienteId);

  try {
    const idVisible = await generarSiguienteId(PREFIJOS_ID.propuestaCliente);

    const ref = await db.collection("propuestas").add({
      idVisible,
      nombre: document.getElementById("prop-nombre").value.trim(),
      clienteId: clienteId || null,
      clienteNombre: clienteEncontrado ? clienteEncontrado.nombre : "",
      estado: "Borrador",
      items: [],
      notas: "",
      creadoPor: nombreCompletoDe(usuarioActualProp) || usuarioActualProp.email,
      creadoPorUid: usuarioActualProp.uid,
      creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
    });

    window.location.href = `propuesta-detalle.html?id=${ref.id}`;
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo crear. Inténtalo de nuevo.");
    btn.disabled = false;
  }
});

// ---------- Versiones ----------

async function crearNuevaVersionPropuesta(p) {
  if (!confirm(`¿Crear la versión V${(p.version || 1) + 1} de esta propuesta? La original (V${p.version || 1}) se conserva como histórico.`)) return;

  try {
    const { id, creadoEl, ...datos } = p;
    await db.collection("propuestas").add({
      ...datos,
      estado: "Borrador",
      version: (p.version || 1) + 1,
      grupoVersionId: p.grupoVersionId || p.id,
      versionAnteriorId: p.id,
      creadoPor: nombreCompletoDe(usuarioActualProp) || usuarioActualProp.email,
      creadoPorUid: usuarioActualProp.uid,
      creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
    });
    if (!p.grupoVersionId) {
      await db.collection("propuestas").doc(p.id).update({ grupoVersionId: p.id });
    }
    mostrarToast(`Versión V${(p.version || 1) + 1} creada.`);
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo crear la nueva versión.");
  }
}

function confirmarEliminarPropuesta(id, nombre) {
  if (!confirm(`¿Eliminar la propuesta "${nombre}"?`)) return;
  db.collection("propuestas")
    .doc(id)
    .delete()
    .then(() => mostrarToast("Propuesta eliminada."))
    .catch((err) => {
      console.error(err);
      mostrarToast("No se pudo eliminar.");
    });
}

// ---------- Toast ----------

let toastTimerProp;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerProp);
  toastTimerProp = setTimeout(() => t.classList.remove("show"), 3200);
}
