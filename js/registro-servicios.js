// =========================================================
// STAGE SUPPORT — registro-servicios.js
// Colección: /registroServicios/{id} → {
//   idVisible, clienteId, clienteNombre, servicioId, servicioNombre,
//   actuacion, localizacion, fecha, importe (BI),
//   formaPago ('' | 'FRA' | 'EF'), nFactura, observaciones,
//   version, grupoVersionId, versionAnteriorId,
//   creadoPor, creadoPorUid, creadoEl
// }
// =========================================================

let usuarioActualRS = null;
let rsListaCache = [];
let clientesCacheRS = [];
let serviciosCacheRS = [];

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

  await Promise.all([cargarClientesRS(), cargarServiciosRS()]);
  escucharRS();
})();

// ---------- Listas de apoyo ----------

async function cargarClientesRS() {
  const sel = document.getElementById("rs-cliente");
  try {
    const snap = await db.collection("clientes").orderBy("nombre").get();
    clientesCacheRS = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    sel.innerHTML = `<option value="">— Selecciona un cliente —</option>${clientesCacheRS.map((c) => `<option value="${c.id}">${escaparHtmlRS(c.nombre)}</option>`).join("")}`;
  } catch (err) {
    console.error(err);
  }
}

async function cargarServiciosRS() {
  const sel = document.getElementById("rs-servicio");
  try {
    const snap = await db.collection("tiposServicio").orderBy("nombre").get();
    serviciosCacheRS = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    sel.innerHTML = `<option value="">— Selecciona un tipo de servicio —</option>${serviciosCacheRS
      .map((s) => `<option value="${s.id}">${escaparHtmlRS(s.nombre)}</option>`)
      .join("")}`;
  } catch (err) {
    console.error(err);
  }
}

function alSeleccionarServicioRS() {
  const id = document.getElementById("rs-servicio").value;
  const s = serviciosCacheRS.find((x) => x.id === id);
  if (s && s.tarifa != null) {
    document.getElementById("rs-importe").value = s.tarifa;
  }
}

// ---------- Listado, búsqueda y totales ----------

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
    : rsListaCache.filter((r) => {
        const enTexto = `${r.clienteNombre || ""} ${r.servicioNombre || ""} ${r.actuacion || ""} ${r.idVisible || ""}`.toLowerCase();
        return enTexto.includes(texto);
      });
  pintarTablaRS(filtrados);
  pintarTotalesRS(filtrados);
}

function pintarTablaRS(filas) {
  const tbody = document.getElementById("tabla-rs");
  document.getElementById("contador-rs").textContent = filas.length + (filas.length === 1 ? " registro" : " registros");

  if (filas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:36px; color:var(--color-text-muted);">
      Todavía no hay servicios registrados.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filas
    .map((r) => {
      const fecha = r.fecha ? new Date(r.fecha + "T00:00:00").toLocaleDateString("es-ES") : "—";
      const estadoClase = r.formaPago === "FRA" ? "FRA" : r.formaPago === "EF" ? "EF" : "pendiente";
      const estadoTexto = r.formaPago === "FRA" ? "Factura" : r.formaPago === "EF" ? "Efectivo" : "Pendiente";
      return `
        <tr>
          <td><span class="id-badge">${escaparHtmlRS(r.idVisible || "—")}</span> <span class="permiso-tag">V${r.version || 1}</span></td>
          <td style="font-weight:600;">${escaparHtmlRS(r.clienteNombre || "—")}</td>
          <td>${escaparHtmlRS(r.servicioNombre || "—")}</td>
          <td>${escaparHtmlRS(r.actuacion || "—")}</td>
          <td>${fecha}</td>
          <td>${formatoEuroRS(r.importe)}</td>
          <td><span class="estado-pago-badge ${estadoClase}">${estadoTexto}</span></td>
          <td>
            <div class="row-actions" style="justify-content:flex-end;">
              <a class="btn-ghost" style="text-decoration:none; padding:6px 12px; font-size:12px;" href="registro-servicio-ver.html?id=${r.id}" target="_blank">Ver</a>
              <button class="icon-btn" title="Editar" onclick='abrirModalEdicionRS(${JSON.stringify(r).replace(/'/g, "&#39;")})'>✎</button>
              <button class="icon-btn" title="Crear nueva versión" onclick='crearNuevaVersionRS(${JSON.stringify(r).replace(/'/g, "&#39;")})'>⎘</button>
              <button class="icon-btn danger" title="Eliminar" onclick="confirmarEliminarRS('${r.id}', '${escaparHtmlRS(r.clienteNombre || "").replace(/'/g, "\\'")}')">🗑</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function pintarTotalesRS(filas) {
  const totalEfectivo = filas.filter((r) => r.formaPago === "EF").reduce((sum, r) => sum + (r.importe || 0), 0);
  const totalFactura = filas.filter((r) => r.formaPago === "FRA").reduce((sum, r) => sum + (r.importe || 0), 0);
  const totalPendiente = filas.filter((r) => !r.formaPago).reduce((sum, r) => sum + (r.importe || 0), 0);
  const iva = totalFactura * 0.21;
  const totalPagar = totalEfectivo + totalFactura + iva + totalPendiente;

  document.getElementById("rs-total-efectivo").textContent = formatoEuroRS(totalEfectivo);
  document.getElementById("rs-total-factura").textContent = formatoEuroRS(totalFactura);
  document.getElementById("rs-total-iva").textContent = formatoEuroRS(iva);
  document.getElementById("rs-total-pendiente").textContent = formatoEuroRS(totalPendiente);
  document.getElementById("rs-total-pagar").textContent = formatoEuroRS(totalPagar);
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

// ---------- Modal ----------

const formRS = document.getElementById("form-rs");
const overlayRS = document.getElementById("modal-overlay");

function alCambiarFormaPagoRS() {
  const valor = document.querySelector('input[name="rs-forma-pago"]:checked').value;
  document.getElementById("campo-rs-nfactura").style.display = valor === "FRA" ? "block" : "none";
}

function abrirModalRegistroServicio() {
  formRS.reset();
  document.getElementById("rs-id-edicion").value = "";
  document.getElementById("campo-id-existente").style.display = "none";
  document.getElementById("rs-fecha").value = fechaISORS(new Date());
  document.getElementById("modal-titulo").textContent = "Nuevo registro";
  document.getElementById("modal-sub").textContent = "Se le asignará automáticamente un ID correlativo (R<año>-0001).";
  document.getElementById("btn-guardar").textContent = "Crear registro";
  alCambiarFormaPagoRS();
  ocultarMsgRS();
  overlayRS.classList.add("show");
}

function abrirModalEdicionRS(r) {
  formRS.reset();
  document.getElementById("rs-id-edicion").value = r.id;
  document.getElementById("campo-id-existente").style.display = "block";
  document.getElementById("rs-id-badge").textContent = r.idVisible || "—";
  document.getElementById("rs-cliente").value = r.clienteId || "";
  document.getElementById("rs-servicio").value = r.servicioId || "";
  document.getElementById("rs-actuacion").value = r.actuacion || "";
  document.getElementById("rs-localizacion").value = r.localizacion || "";
  document.getElementById("rs-fecha").value = r.fecha || "";
  document.getElementById("rs-importe").value = r.importe != null ? r.importe : "";
  document.querySelector(`input[name="rs-forma-pago"][value="${r.formaPago || ""}"]`).checked = true;
  document.getElementById("rs-nfactura").value = r.nFactura || "";
  document.getElementById("rs-observaciones").value = r.observaciones || "";
  document.getElementById("modal-titulo").textContent = "Editar registro";
  document.getElementById("modal-sub").textContent = "El ID de un registro no cambia una vez creado.";
  document.getElementById("btn-guardar").textContent = "Guardar cambios";
  alCambiarFormaPagoRS();
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
  const id = document.getElementById("rs-id-edicion").value;
  const btn = document.getElementById("btn-guardar");
  btn.disabled = true;

  const clienteId = document.getElementById("rs-cliente").value;
  const clienteEncontrado = clientesCacheRS.find((c) => c.id === clienteId);
  const servicioId = document.getElementById("rs-servicio").value;
  const servicioEncontrado = serviciosCacheRS.find((s) => s.id === servicioId);
  const formaPago = document.querySelector('input[name="rs-forma-pago"]:checked').value;

  const datos = {
    clienteId: clienteId || null,
    clienteNombre: clienteEncontrado ? clienteEncontrado.nombre : "",
    servicioId: servicioId || null,
    servicioNombre: servicioEncontrado ? servicioEncontrado.nombre : "",
    actuacion: document.getElementById("rs-actuacion").value.trim(),
    localizacion: document.getElementById("rs-localizacion").value.trim(),
    fecha: document.getElementById("rs-fecha").value,
    importe: parseFloat(document.getElementById("rs-importe").value) || 0,
    formaPago: formaPago || null,
    nFactura: formaPago === "FRA" ? document.getElementById("rs-nfactura").value.trim() : "",
    observaciones: document.getElementById("rs-observaciones").value.trim(),
  };

  try {
    if (id) {
      await db.collection("registroServicios").doc(id).update(datos);
      mostrarToast("Registro actualizado.");
      cerrarModal();
    } else {
      const idVisible = await generarSiguienteId(PREFIJOS_ID.registroServicio);
      await db.collection("registroServicios").add({
        ...datos,
        idVisible,
        version: 1,
        creadoPor: nombreCompletoDe(usuarioActualRS) || usuarioActualRS.email,
        creadoPorUid: usuarioActualRS.uid,
        creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
      });
      mostrarToast(`Registro ${idVisible} creado.`);
      cerrarModal();
    }
  } catch (err) {
    console.error(err);
    document.getElementById("modal-msg").textContent = `No se pudo guardar: ${err.code || ""} ${err.message || err}`.trim();
    document.getElementById("modal-msg").className = "form-msg show error";
  } finally {
    btn.disabled = false;
  }
});

// ---------- Versiones ----------

async function crearNuevaVersionRS(r) {
  if (!confirm(`¿Crear la versión V${(r.version || 1) + 1} de este registro? El original (V${r.version || 1}) se conserva como histórico.`)) return;

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

function confirmarEliminarRS(id, nombreCliente) {
  if (!confirm(`¿Eliminar este registro de servicio${nombreCliente ? ` de "${nombreCliente}"` : ""}?`)) return;
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
