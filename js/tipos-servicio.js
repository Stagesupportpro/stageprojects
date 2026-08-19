// =========================================================
// STAGE SUPPORT — tipos-servicio.js
// Colección: /tiposServicio/{id} → { nombre, descripcion, tarifa,
//   unidad ('servicio'|'hora'|'dia'|'unidad'), notas,
//   creadoPor, creadoPorUid, creadoEl }
// =========================================================

const ETIQUETAS_UNIDAD_TS = { servicio: "por servicio", hora: "por hora", dia: "por día", unidad: "por unidad" };

let usuarioActualTS = null;

(async function () {
  usuarioActualTS = await protegerPagina();
  pintarNav(usuarioActualTS.rol, "tipos-servicio");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualTS) || usuarioActualTS.email;
  document.getElementById("pass-role").textContent = usuarioActualTS.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualTS.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualTS.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualTS) || usuarioActualTS.email);
  }

  escucharTiposServicio();
})();

function escucharTiposServicio() {
  db.collection("tiposServicio").orderBy("nombre").onSnapshot(
    (snap) => {
      const filas = [];
      snap.forEach((doc) => filas.push({ id: doc.id, ...doc.data() }));
      pintarTablaTiposServicio(filas);
    },
    (err) => {
      console.error(err);
      mostrarToast("No se pudo cargar el listado.");
    }
  );
}

function pintarTablaTiposServicio(tipos) {
  const tbody = document.getElementById("tabla-tipos-servicio");
  document.getElementById("contador-tipos-servicio").textContent = tipos.length + (tipos.length === 1 ? " tipo de servicio" : " tipos de servicio");

  if (tipos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:36px; color:var(--color-text-muted);">
      Todavía no hay tipos de servicio creados.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = tipos
    .map(
      (t) => `
        <tr>
          <td style="font-weight:600;">${escaparHtmlTS(t.nombre)}</td>
          <td>${escaparHtmlTS(t.descripcion || "—")}</td>
          <td>${Number(t.tarifa || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € <span style="color:var(--color-text-muted); font-size:12px;">(${ETIQUETAS_UNIDAD_TS[t.unidad] || "por servicio"})</span></td>
          <td>
            <div class="row-actions" style="justify-content:flex-end;">
              <button class="icon-btn" title="Editar" onclick='abrirModalEdicionTipoServicio(${JSON.stringify(t).replace(/'/g, "&#39;")})'>✎</button>
              <button class="icon-btn danger" title="Eliminar" onclick="confirmarEliminarTipoServicio('${t.id}', '${escaparHtmlTS(t.nombre).replace(/'/g, "\\'")}')">🗑</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

function escaparHtmlTS(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// ---------- Modal ----------

const formTipoServicio = document.getElementById("form-tipo-servicio");
const overlayTipoServicio = document.getElementById("modal-overlay");

function abrirModalTipoServicio() {
  formTipoServicio.reset();
  document.getElementById("ts-id-edicion").value = "";
  document.getElementById("modal-titulo").textContent = "Nuevo tipo de servicio";
  document.getElementById("btn-guardar").textContent = "Crear";
  ocultarMsgTS();
  overlayTipoServicio.classList.add("show");
}

function abrirModalEdicionTipoServicio(t) {
  formTipoServicio.reset();
  document.getElementById("ts-id-edicion").value = t.id;
  document.getElementById("ts-nombre").value = t.nombre || "";
  document.getElementById("ts-descripcion").value = t.descripcion || "";
  document.getElementById("ts-tarifa").value = t.tarifa != null ? t.tarifa : "";
  document.getElementById("ts-unidad").value = t.unidad || "servicio";
  document.getElementById("ts-notas").value = t.notas || "";
  document.getElementById("modal-titulo").textContent = "Editar tipo de servicio";
  document.getElementById("btn-guardar").textContent = "Guardar cambios";
  ocultarMsgTS();
  overlayTipoServicio.classList.add("show");
}

function cerrarModal() {
  overlayTipoServicio.classList.remove("show");
}

function ocultarMsgTS() {
  const m = document.getElementById("modal-msg");
  m.className = "form-msg";
  m.textContent = "";
}

formTipoServicio.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("ts-id-edicion").value;
  const btn = document.getElementById("btn-guardar");
  btn.disabled = true;

  const datos = {
    nombre: document.getElementById("ts-nombre").value.trim(),
    descripcion: document.getElementById("ts-descripcion").value.trim(),
    tarifa: parseFloat(document.getElementById("ts-tarifa").value) || 0,
    unidad: document.getElementById("ts-unidad").value,
    notas: document.getElementById("ts-notas").value.trim(),
  };

  try {
    if (id) {
      await db.collection("tiposServicio").doc(id).update(datos);
      mostrarToast("Tipo de servicio actualizado.");
    } else {
      await db.collection("tiposServicio").add({
        ...datos,
        creadoPor: nombreCompletoDe(usuarioActualTS) || usuarioActualTS.email,
        creadoPorUid: usuarioActualTS.uid,
        creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
      });
      mostrarToast("Tipo de servicio creado.");
    }
    cerrarModal();
  } catch (err) {
    console.error(err);
    document.getElementById("modal-msg").textContent = `No se pudo guardar: ${err.code || ""} ${err.message || err}`.trim();
    document.getElementById("modal-msg").className = "form-msg show error";
  } finally {
    btn.disabled = false;
  }
});

function confirmarEliminarTipoServicio(id, nombre) {
  if (!confirm(`¿Eliminar "${nombre}"?`)) return;
  db.collection("tiposServicio")
    .doc(id)
    .delete()
    .then(() => mostrarToast("Eliminado."))
    .catch((err) => {
      console.error(err);
      mostrarToast("No se pudo eliminar.");
    });
}

// ---------- Toast ----------

let toastTimerTS;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerTS);
  toastTimerTS = setTimeout(() => t.classList.remove("show"), 3200);
}
