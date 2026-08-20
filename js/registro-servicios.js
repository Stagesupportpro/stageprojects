// =========================================================
// STAGE SUPPORT — registro-servicios.js (listado)
// Colección: /registroServicios/{id} → {
//   idVisible, nombre, lineas: [{...}], observaciones,
//   version, grupoVersionId, versionAnteriorId,
//   creadoPor, creadoPorUid, creadoEl
// }
// Cada registro agrupa varias líneas de servicio (el reporte mensual
// al cliente) — el alta rápida solo pide el nombre; las líneas y los
// totales viven dentro de la ficha completa (registro-servicio-detalle.html).
// =========================================================

let usuarioActualRS = null;
let rsListaCache = [];
let clientesCacheRS = [];

(async function () {
  usuarioActualRS = await protegerPagina();
  pintarNav(usuarioActualRS.rol, "registro-servicios");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualRS) || usuarioActualRS.email;
  document.getElementById("pass-role").textContent = usuarioActualRS.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualRS.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualRS.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualRS) || usuarioActualRS.email);
  }

  await cargarClientesRS();
  escucharRS();
})();

async function cargarClientesRS() {
  try {
    const snap = await db.collection("clientes").orderBy("nombre").get();
    clientesCacheRS = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    document.getElementById("rs-cliente").innerHTML =
      `<option value="">— Selecciona un cliente —</option>` + clientesCacheRS.map((c) => `<option value="${c.id}">${escaparHtmlRS(c.nombre)}</option>`).join("");
  } catch (err) {
    console.error(err);
  }
}

// ---------- Listado y búsqueda ----------

function escucharRS() {
  db.collection("registroServicios").orderBy("creadoEl", "desc").onSnapshot(
    (snap) => {
      rsListaCache = [];
      snap.forEach((doc) => rsListaCache.push({ id: doc.id, ...doc.data() }));
      aplicarFiltrosRS();
    },
    (err) => {
      console.error(err);
      mostrarToast("No se pudo cargar el registro de servicios.");
    }
  );
}

function aplicarFiltrosRS() {
  const texto = (document.getElementById("rs-busqueda").value || "").trim().toLowerCase();
  const filtrados = !texto
    ? rsListaCache
    : rsListaCache.filter((r) => `${r.nombre || ""} ${r.clienteNombre || ""} ${r.idVisible || ""}`.toLowerCase().includes(texto));
  pintarTablaRS(filtrados);
}

// ---------- Totales de un registro (a partir de sus líneas) ----------

function calcularTotalesRS(registro) {
  const lineas = Array.isArray(registro.lineas) ? registro.lineas : [];
  const totalEfectivo = lineas.filter((l) => l.formaPago === "EF").reduce((sum, l) => sum + (l.importe || 0), 0);
  const totalFactura = lineas.filter((l) => l.formaPago === "FRA").reduce((sum, l) => sum + (l.importe || 0), 0);
  const totalPendiente = lineas.filter((l) => !l.formaPago).reduce((sum, l) => sum + (l.importe || 0), 0);
  const iva = totalFactura * 0.21;
  const totalPagar = totalEfectivo + totalFactura + iva + totalPendiente;
  return { totalEfectivo, totalFactura, totalPendiente, iva, totalPagar };
}

function pintarTablaRS(filas) {
  const tbody = document.getElementById("tabla-rs");
  document.getElementById("contador-rs").textContent = filas.length + (filas.length === 1 ? " registro" : " registros");

  if (filas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:36px; color:var(--color-text-muted);">
      Todavía no hay registros creados.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filas
    .map((r) => {
      const numLineas = Array.isArray(r.lineas) ? r.lineas.length : 0;
      const { totalPagar } = calcularTotalesRS(r);
      return `
        <tr>
          <td><span class="id-badge">${escaparHtmlRS(r.idVisible || "—")}</span> <span class="permiso-tag">V${r.version || 1}</span></td>
          <td style="font-weight:600;">${escaparHtmlRS(r.nombre)}</td>
          <td>${escaparHtmlRS(r.clienteNombre || "—")}</td>
          <td>${numLineas}</td>
          <td style="font-weight:600;">${formatoEuroRS(totalPagar)}</td>
          <td>
            <div class="row-actions" style="justify-content:flex-end;">
              <a class="btn-ghost" style="text-decoration:none; padding:6px 12px; font-size:12px;" href="registro-servicio-detalle.html?id=${r.id}">Abrir</a>
              <a class="btn-ghost" style="text-decoration:none; padding:6px 12px; font-size:12px;" href="registro-servicio-ver.html?id=${r.id}" target="_blank">Ver</a>
              <button class="icon-btn" title="Crear nueva versión" onclick='crearNuevaVersionRS(${JSON.stringify(r).replace(/'/g, "&#39;")})'>⎘</button>
              <button class="icon-btn danger" title="Eliminar" onclick="confirmarEliminarRS('${r.id}', '${escaparHtmlRS(r.nombre).replace(/'/g, "\\'")}')">🗑</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function formatoEuroRS(n) {
  return Number(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function escaparHtmlRS(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function fechaISORS(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------- Modal de alta rápida ----------

const formRS = document.getElementById("form-rs");
const overlayRS = document.getElementById("modal-overlay");

function abrirModalRegistro() {
  formRS.reset();
  ocultarMsgRS();
  overlayRS.classList.add("show");
}

function cerrarModal() {
  overlayRS.classList.remove("show");
}

function ocultarMsgRS() {
  const m = document.getElementById("modal-msg");
  m.className = "form-msg";
  m.textContent = "";
}

formRS.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btn-guardar");
  btn.disabled = true;

  const nombre = document.getElementById("rs-nombre").value.trim();
  const clienteId = document.getElementById("rs-cliente").value;
  const clienteEncontrado = clientesCacheRS.find((c) => c.id === clienteId);

  try {
    const idVisible = await generarSiguienteId(PREFIJOS_ID.registroServicio);
    const ref = await db.collection("registroServicios").add({
      idVisible,
      nombre,
      clienteId: clienteId || null,
      clienteNombre: clienteEncontrado ? clienteEncontrado.nombre : "",
      lineas: [],
      observaciones: "",
      version: 1,
      creadoPor: nombreCompletoDe(usuarioActualRS) || usuarioActualRS.email,
      creadoPorUid: usuarioActualRS.uid,
      creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
    });
    window.location.href = `registro-servicio-detalle.html?id=${ref.id}`;
  } catch (err) {
    console.error(err);
    document.getElementById("modal-msg").textContent = `No se pudo crear: ${err.code || ""} ${err.message || err}`.trim();
    document.getElementById("modal-msg").className = "form-msg show error";
    btn.disabled = false;
  }
});

// ---------- Versiones ----------

async function crearNuevaVersionRS(r) {
  if (!confirm(`¿Crear la versión V${(r.version || 1) + 1} de "${r.nombre}"? El original (V${r.version || 1}) se conserva como histórico.`)) return;

  try {
    const { id, creadoEl, ...datos } = r;
    await db.collection("registroServicios").add({
      ...datos,
      version: (r.version || 1) + 1,
      grupoVersionId: r.grupoVersionId || r.id,
      versionAnteriorId: r.id,
      creadoPor: nombreCompletoDe(usuarioActualRS) || usuarioActualRS.email,
      creadoPorUid: usuarioActualRS.uid,
      creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
    });
    if (!r.grupoVersionId) {
      await db.collection("registroServicios").doc(r.id).update({ grupoVersionId: r.id });
    }
    mostrarToast(`Versión V${(r.version || 1) + 1} creada.`);
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo crear la nueva versión.");
  }
}

// ---------- Eliminar ----------

function confirmarEliminarRS(id, nombre) {
  if (!confirm(`¿Eliminar el registro "${nombre}"? Esto borra todas sus líneas.`)) return;
  db.collection("registroServicios")
    .doc(id)
    .delete()
    .then(() => mostrarToast("Registro eliminado."))
    .catch((err) => {
      console.error(err);
      mostrarToast("No se pudo eliminar.");
    });
}

// ---------- Toast ----------

let toastTimerRS;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerRS);
  toastTimerRS = setTimeout(() => t.classList.remove("show"), 3200);
}
