// =========================================================
// STAGE SUPPORT — hojasderuta.js
// Colección: /hojasDeRuta/{id} → { idVisible, nombre, fecha, notas,
//   produccionId, produccionNombre, creadoPor, creadoPorUid }
// Al crear una, también se marca en el Calendario el día de creación.
// =========================================================

let usuarioActualHR = null;
let produccionesDisponibles = []; // [{ id, idVisible, nombre }]
let hrListaCache = [];

(async function () {
  usuarioActualHR = await protegerPagina();
  pintarNav(usuarioActualHR.rol, "hojasderuta");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualHR) || usuarioActualHR.email;
  document.getElementById("pass-role").textContent = usuarioActualHR.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualHR.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualHR.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualHR) || usuarioActualHR.email);
  }

  await cargarProducciones();
  escucharHR();
})();

async function cargarProducciones() {
  const sel = document.getElementById("hr-produccion");
  try {
    const snap = await db.collection("producciones").orderBy("creadoEl", "desc").get();
    produccionesDisponibles = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const opciones = produccionesDisponibles
      .map((p) => `<option value="${p.id}">${p.idVisible} — ${escaparHtmlHR(p.nombre)}</option>`)
      .join("");
    sel.innerHTML = `<option value="">— Sin vincular —</option>${opciones}`;
  } catch (err) {
    console.error(err);
  }
}

function escucharHR() {
  db.collection("hojasDeRuta").orderBy("creadoEl", "desc").onSnapshot(
    (snap) => {
      hrListaCache = [];
      snap.forEach((doc) => hrListaCache.push({ id: doc.id, ...doc.data() }));
      aplicarFiltrosHR();
    },
    (err) => {
      console.error(err);
      mostrarToast("No se pudo cargar el listado de hojas de ruta.");
    }
  );
}

function aplicarFiltrosHR() {
  const texto = (document.getElementById("hr-busqueda").value || "").trim().toLowerCase();
  const filtrados = !texto
    ? hrListaCache
    : hrListaCache.filter((h) => {
        const enTexto = `${h.nombre || ""} ${h.produccionNombre || ""} ${h.idVisible || ""}`.toLowerCase();
        return enTexto.includes(texto);
      });
  pintarTablaHR(filtrados);
}

function pintarTablaHR(hojas) {
  const tbody = document.getElementById("tabla-hr");
  document.getElementById("contador-hr").textContent =
    hojas.length + (hojas.length === 1 ? " hoja de ruta" : " hojas de ruta");

  if (hojas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:36px; color:var(--color-text-muted);">
      Todavía no hay hojas de ruta creadas.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = hojas
    .map((h) => {
      const fecha = h.fecha ? new Date(h.fecha + "T00:00:00").toLocaleDateString("es-ES") : "—";
      return `
        <tr>
          <td><span class="id-badge">${escaparHtmlHR(h.idVisible || "—")}</span></td>
          <td style="font-weight:600;">${escaparHtmlHR(h.nombre)}</td>
          <td>${h.produccionNombre ? escaparHtmlHR(h.produccionNombre) : "—"}</td>
          <td>${fecha}</td>
          <td>
            <div class="row-actions" style="justify-content:flex-end;">
              <a class="btn-ghost" style="text-decoration:none; padding:6px 12px; font-size:12px;" href="hojaderuta-detalle.html?id=${h.id}">Abrir</a>
              <button class="icon-btn" title="Edición rápida" onclick='abrirModalEdicionHR(${JSON.stringify(h).replace(/'/g, "&#39;")})'>✎</button>
              <button class="icon-btn danger" title="Eliminar" onclick="confirmarEliminarHR('${h.id}', '${escaparHtmlHR(h.nombre).replace(/'/g, "\\'")}')">🗑</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function escaparHtmlHR(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// ---------- Modal ----------

const formHR = document.getElementById("form-hr");
const overlayHR = document.getElementById("modal-overlay");

function abrirModalHR() {
  formHR.reset();
  document.getElementById("hr-id-edicion").value = "";
  document.getElementById("campo-id-existente").style.display = "none";
  document.getElementById("hr-fecha").value = fechaISOHR(new Date());
  document.getElementById("modal-titulo").textContent = "Nueva hoja de ruta";
  document.getElementById("modal-sub").textContent = "Se le asignará automáticamente un ID correlativo (HR<año>-0001).";
  document.getElementById("btn-guardar").textContent = "Crear hoja de ruta";
  ocultarMsgModalHR();
  overlayHR.classList.add("show");
}

function abrirModalEdicionHR(h) {
  formHR.reset();
  document.getElementById("hr-id-edicion").value = h.id;
  document.getElementById("campo-id-existente").style.display = "block";
  document.getElementById("hr-id-badge").textContent = h.idVisible || "—";
  document.getElementById("hr-nombre").value = h.nombre || "";
  document.getElementById("hr-fecha").value = h.fecha || fechaISOHR(new Date());
  document.getElementById("hr-notas").value = h.notas || "";
  document.getElementById("hr-produccion").value = h.produccionId || "";
  document.getElementById("modal-titulo").textContent = "Editar hoja de ruta";
  document.getElementById("modal-sub").textContent = "El ID de una hoja de ruta no cambia una vez creada.";
  document.getElementById("btn-guardar").textContent = "Guardar cambios";
  ocultarMsgModalHR();
  overlayHR.classList.add("show");
}

function cerrarModal() {
  overlayHR.classList.remove("show");
}

function ocultarMsgModalHR() {
  const m = document.getElementById("modal-msg");
  m.className = "form-msg";
  m.textContent = "";
}

function mostrarMsgModalHR(texto) {
  const m = document.getElementById("modal-msg");
  m.textContent = texto;
  m.className = "form-msg show error";
}

function fechaISOHR(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

formHR.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("hr-id-edicion").value;
  const btn = document.getElementById("btn-guardar");
  btn.disabled = true;

  const produccionId = document.getElementById("hr-produccion").value;
  const produccionEncontrada = produccionesDisponibles.find((p) => p.id === produccionId);

  const datosBase = {
    nombre: document.getElementById("hr-nombre").value.trim(),
    fecha: document.getElementById("hr-fecha").value,
    notas: document.getElementById("hr-notas").value.trim(),
    produccionId: produccionId || null,
    produccionNombre: produccionEncontrada
      ? `${produccionEncontrada.idVisible} — ${produccionEncontrada.nombre}`
      : "",
  };

  try {
    if (id) {
      await db.collection("hojasDeRuta").doc(id).update(datosBase);
      mostrarToast("Hoja de ruta actualizada.");
      cerrarModal();
    } else {
      const idVisible = await generarSiguienteId(PREFIJOS_ID.hojaDeRuta);

      const refNueva = await db.collection("hojasDeRuta").add({
        ...datosBase,
        idVisible,
        creadoPor: nombreCompletoDe(usuarioActualHR) || usuarioActualHR.email,
        creadoPorUid: usuarioActualHR.uid,
        creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // También queda marcada en el Calendario, el día de creación.
      const refDoc = await db.collection("documentos").add({
        tipo: "HojaDeRuta",
        titulo: `${datosBase.nombre} (${idVisible})`,
        fecha: fechaISOHR(new Date()),
        enlace: "",
        notas: `Hoja de ruta ${idVisible}`,
        creadoPor: nombreCompletoDe(usuarioActualHR) || usuarioActualHR.email,
        creadoPorUid: usuarioActualHR.uid,
        creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection("hojasDeRuta").doc(refNueva.id).update({ documentoCalendarioId: refDoc.id });

      mostrarToast(`Hoja de ruta ${idVisible} creada. Abriendo editor…`);
      window.location.href = `hojaderuta-detalle.html?id=${refNueva.id}`;
      return;
    }
  } catch (err) {
    console.error(err);
    mostrarMsgModalHR("No se pudo guardar. Inténtalo de nuevo.");
  } finally {
    btn.disabled = false;
  }
});

// ---------- Eliminar ----------

function confirmarEliminarHR(id, nombre) {
  if (!confirm(`¿Eliminar la hoja de ruta "${nombre}"? Esto también la quita del calendario.`)) return;
  db.collection("hojasDeRuta")
    .doc(id)
    .get()
    .then(async (snap) => {
      const documentoCalendarioId = snap.exists ? snap.data().documentoCalendarioId : null;
      await db.collection("hojasDeRuta").doc(id).delete();
      if (documentoCalendarioId) {
        await db.collection("documentos").doc(documentoCalendarioId).delete().catch((err) => console.error(err));
      }
      mostrarToast("Hoja de ruta eliminada.");
    })
    .catch((err) => {
      console.error(err);
      mostrarToast("No se pudo eliminar.");
    });
}

// ---------- Toast ----------

let toastTimerHR;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerHR);
  toastTimerHR = setTimeout(() => t.classList.remove("show"), 3200);
}
