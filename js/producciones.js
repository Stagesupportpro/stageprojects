// =========================================================
// STAGE SUPPORT — producciones.js
// Colección: /producciones/{id} → { idVisible, nombre, fecha, notas,
//   pmTipo ('usuario'|'personal'), pmId, pmNombre, creadoPor, creadoPorUid }
// Al crear una producción, también se marca en el Calendario (colección
// "documentos") en el día de creación.
// =========================================================

let usuarioActualProd = null;
let opcionesPM = []; // [{ tipo, id, nombre }]
let produccionesListaCache = [];

(async function () {
  usuarioActualProd = await protegerPagina();
  pintarNav(usuarioActualProd.rol, "producciones");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualProd) || usuarioActualProd.email;
  document.getElementById("pass-role").textContent = usuarioActualProd.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualProd.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualProd.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualProd) || usuarioActualProd.email);
  }

  await cargarOpcionesPM();
  escucharProducciones();
})();

// ---------- Opciones de Project Manager: empleados + bolsa de personal ----------

async function cargarOpcionesPM() {
  opcionesPM = [];
  const sel = document.getElementById("prod-pm");

  try {
    const [snapUsuarios, snapPersonal] = await Promise.all([
      db.collection("usuarios").orderBy("nombre").get(),
      db.collection("personal").orderBy("nombre").get(),
    ]);

    const gruposHtml = [];

    if (!snapUsuarios.empty) {
      const opts = snapUsuarios.docs.map((d) => {
        const u = d.data();
        const nombre = nombreCompletoDe(u) || u.email;
        opcionesPM.push({ tipo: "usuario", id: d.id, nombre });
        return `<option value="usuario:${d.id}">${nombre}</option>`;
      });
      gruposHtml.push(`<optgroup label="Empleados">${opts.join("")}</optgroup>`);
    }

    if (!snapPersonal.empty) {
      const opts = snapPersonal.docs.map((d) => {
        const p = d.data();
        const nombre = [p.nombre, p.apellidos].filter(Boolean).join(" ");
        opcionesPM.push({ tipo: "personal", id: d.id, nombre });
        return `<option value="personal:${d.id}">${nombre}</option>`;
      });
      gruposHtml.push(`<optgroup label="Bolsa de personal">${opts.join("")}</optgroup>`);
    }

    sel.innerHTML = gruposHtml.join("") || `<option value="">No hay usuarios ni contactos disponibles</option>`;
  } catch (err) {
    console.error(err);
    sel.innerHTML = `<option value="">No se pudieron cargar los Project Manager</option>`;
  }
}

// ---------- Listado ----------

function escucharProducciones() {
  db.collection("producciones").orderBy("creadoEl", "desc").onSnapshot(
    (snap) => {
      produccionesListaCache = [];
      snap.forEach((doc) => produccionesListaCache.push({ id: doc.id, ...doc.data() }));
      aplicarFiltrosProducciones();
    },
    (err) => {
      console.error(err);
      mostrarToast("No se pudo cargar el listado de producciones.");
    }
  );
}

function aplicarFiltrosProducciones() {
  const texto = (document.getElementById("prod-busqueda").value || "").trim().toLowerCase();
  const filtrados = !texto
    ? produccionesListaCache
    : produccionesListaCache.filter((p) => {
        const enTexto = `${p.nombre || ""} ${p.artistaNombre || ""} ${p.idVisible || ""}`.toLowerCase();
        return enTexto.includes(texto);
      });
  pintarTablaProducciones(filtrados);
}

function pintarTablaProducciones(producciones) {
  const tbody = document.getElementById("tabla-producciones");
  document.getElementById("contador-producciones").textContent =
    producciones.length + (producciones.length === 1 ? " producción" : " producciones");

  if (producciones.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:36px; color:var(--color-text-muted);">
      Todavía no hay producciones creadas.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = producciones
    .map((p) => {
      const fecha = p.fecha ? new Date(p.fecha + "T00:00:00").toLocaleDateString("es-ES") : "—";
      return `
        <tr>
          <td><span class="id-badge">${escaparHtmlProd(p.idVisible || "—")}</span> <span class="permiso-tag">V${p.version || 1}</span></td>
          <td style="font-weight:600;">${escaparHtmlProd(p.nombre)}</td>
          <td>${escaparHtmlProd(p.artistaNombre || "—")}</td>
          <td>
            <div class="pm-chip">
              <span class="pm-tag">${p.pmTipo === "personal" ? "Externo" : "Equipo"}</span>
              ${escaparHtmlProd(p.pmNombre || "—")}
            </div>
          </td>
          <td>${fecha}</td>
          <td>
            <div class="row-actions" style="justify-content:flex-end;">
              <a class="btn-ghost" style="text-decoration:none; padding:6px 12px; font-size:12px;" href="produccion-detalle.html?id=${p.id}">Abrir</a>
              <button class="icon-btn" title="Edición rápida" onclick='abrirModalEdicionProduccion(${JSON.stringify(p).replace(/'/g, "&#39;")})'>✎</button>
              <button class="icon-btn" title="Crear nueva versión" onclick='crearNuevaVersionProduccion(${JSON.stringify(p).replace(/'/g, "&#39;")})'>⎘</button>
              <button class="icon-btn danger" title="Eliminar" onclick="confirmarEliminarProduccion('${p.id}', '${escaparHtmlProd(p.nombre).replace(/'/g, "\\'")}')">🗑</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function escaparHtmlProd(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// ---------- Modal ----------

const formProduccion = document.getElementById("form-produccion");
const overlayProduccion = document.getElementById("modal-overlay");

function abrirModalProduccion() {
  formProduccion.reset();
  document.getElementById("prod-id-edicion").value = "";
  document.getElementById("prod-id-visible").value = "";
  document.getElementById("campo-id-existente").style.display = "none";
  document.getElementById("prod-fecha").value = fechaISOProd(new Date());
  document.getElementById("modal-titulo").textContent = "Nueva producción";
  document.getElementById("modal-sub").textContent = "Se le asignará automáticamente un ID correlativo (PRO<año>-0001).";
  document.getElementById("btn-guardar").textContent = "Crear producción";
  ocultarMsgModalProd();
  overlayProduccion.classList.add("show");
}

function abrirModalEdicionProduccion(p) {
  formProduccion.reset();
  document.getElementById("prod-id-edicion").value = p.id;
  document.getElementById("prod-id-visible").value = p.idVisible || "";
  document.getElementById("campo-id-existente").style.display = "block";
  document.getElementById("prod-id-badge").textContent = p.idVisible || "—";
  document.getElementById("prod-nombre").value = p.nombre || "";
  document.getElementById("prod-fecha").value = p.fecha || fechaISOProd(new Date());
  document.getElementById("prod-notas").value = p.notas || "";
  if (p.pmTipo && p.pmId) document.getElementById("prod-pm").value = `${p.pmTipo}:${p.pmId}`;
  document.getElementById("modal-titulo").textContent = "Editar producción";
  document.getElementById("modal-sub").textContent = "El ID de una producción no cambia una vez creada.";
  document.getElementById("btn-guardar").textContent = "Guardar cambios";
  ocultarMsgModalProd();
  overlayProduccion.classList.add("show");
}

function cerrarModal() {
  overlayProduccion.classList.remove("show");
}

function ocultarMsgModalProd() {
  const m = document.getElementById("modal-msg");
  m.className = "form-msg";
  m.textContent = "";
}

function mostrarMsgModalProd(texto) {
  const m = document.getElementById("modal-msg");
  m.textContent = texto;
  m.className = "form-msg show error";
}

function fechaISOProd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

formProduccion.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("prod-id-edicion").value;
  const btn = document.getElementById("btn-guardar");
  btn.disabled = true;

  const [pmTipo, pmId] = document.getElementById("prod-pm").value.split(":");
  const pmEncontrado = opcionesPM.find((o) => o.tipo === pmTipo && o.id === pmId);

  const datosBase = {
    nombre: document.getElementById("prod-nombre").value.trim(),
    fecha: document.getElementById("prod-fecha").value,
    notas: document.getElementById("prod-notas").value.trim(),
    pmTipo: pmTipo || null,
    pmId: pmId || null,
    pmNombre: pmEncontrado ? pmEncontrado.nombre : "",
  };

  try {
    if (id) {
      await db.collection("producciones").doc(id).update(datosBase);
      mostrarToast("Producción actualizada.");
      cerrarModal();
    } else {
      const idVisible = await generarSiguienteId(PREFIJOS_ID.produccion);

      await db.collection("producciones").add({
        ...datosBase,
        idVisible,
        creadoPor: nombreCompletoDe(usuarioActualProd) || usuarioActualProd.email,
        creadoPorUid: usuarioActualProd.uid,
        creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // También queda marcada en el Calendario, el día de creación.
      await db.collection("documentos").add({
        tipo: "Evento",
        titulo: `${datosBase.nombre} (${idVisible})`,
        fecha: fechaISOProd(new Date()),
        enlace: "",
        notas: `Producción ${idVisible}`,
        creadoPor: nombreCompletoDe(usuarioActualProd) || usuarioActualProd.email,
        creadoPorUid: usuarioActualProd.uid,
        creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
      });

      mostrarToast(`Producción ${idVisible} creada y marcada en el calendario.`);
      cerrarModal();
    }
  } catch (err) {
    console.error(err);
    mostrarMsgModalProd("No se pudo guardar. Inténtalo de nuevo.");
  } finally {
    btn.disabled = false;
  }
});

// ---------- Versiones ----------

async function crearNuevaVersionProduccion(p) {
  if (!confirm(`¿Crear la versión V${(p.version || 1) + 1} de esta producción? La original (V${p.version || 1}) se conserva como histórico.`)) return;

  try {
    const { id, creadoEl, ...datos } = p;
    await db.collection("producciones").add({
      ...datos,
      version: (p.version || 1) + 1,
      grupoVersionId: p.grupoVersionId || p.id,
      versionAnteriorId: p.id,
      creadoPor: nombreCompletoDe(usuarioActualProd) || usuarioActualProd.email,
      creadoPorUid: usuarioActualProd.uid,
      creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
    });
    if (!p.grupoVersionId) {
      await db.collection("producciones").doc(p.id).update({ grupoVersionId: p.id });
    }
    mostrarToast(`Versión V${(p.version || 1) + 1} creada.`);
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo crear la nueva versión.");
  }
}

// ---------- Eliminar ----------

function confirmarEliminarProduccion(id, nombre) {
  if (!confirm(`¿Eliminar la producción "${nombre}"? Esto no borra su marca en el calendario.`)) return;
  db.collection("producciones")
    .doc(id)
    .delete()
    .then(() => mostrarToast("Producción eliminada."))
    .catch((err) => {
      console.error(err);
      mostrarToast("No se pudo eliminar.");
    });
}

// ---------- Toast ----------

let toastTimerProd;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerProd);
  toastTimerProd = setTimeout(() => t.classList.remove("show"), 3200);
}
