// =========================================================
// STAGE SUPPORT — calendario.js
// Cada documento (contrato, propuesta, rider, booking, promotor,
// hoja de ruta o evento) se guarda en la colección "documentos"
// con una fecha, y queda marcado ese día en el calendario.
// =========================================================

const TIPOS_DOCUMENTO = [
  { id: "Contrato", label: "Contratos" },
  { id: "Propuesta", label: "Propuestas" },
  { id: "Rider", label: "Riders" },
  { id: "Booking", label: "Booking" },
  { id: "Promotor", label: "Promotor" },
  { id: "HojaDeRuta", label: "Hojas de Ruta" },
  { id: "Evento", label: "Eventos" },
];

let usuarioActual = null;
let fechaVista = new Date(); // mes que se está mostrando
let docsPorFecha = {}; // { 'YYYY-MM-DD': [doc, doc...] }
let unsubscribeDocs = null;
let fechaSeleccionada = null;
let filtrosActivos = new Set(TIPOS_DOCUMENTO.map((t) => t.id));

(async function () {
  usuarioActual = await protegerPagina();
  pintarNav(usuarioActual.rol, "calendario");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActual) || usuarioActual.email;
  document.getElementById("pass-role").textContent = usuarioActual.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActual.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActual.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActual) || usuarioActual.email);
  }

  pintarLeyenda();
  pintarSelectTipos();
  cargarMes();
})();

function fechaISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function tipoInfo(id) {
  return TIPOS_DOCUMENTO.find((t) => t.id === id) || { id, label: id };
}

// ---------- Leyenda y selects ----------

function pintarLeyenda() {
  const cont = document.getElementById("cal-legend");
  cont.innerHTML = TIPOS_DOCUMENTO.map(
    (t) => `<span class="legend-item"><span class="legend-dot doc-color-${t.id}"></span>${t.label}</span>`
  ).join("");
}

function pintarSelectTipos() {
  const sel = document.getElementById("doc-tipo");
  sel.innerHTML = TIPOS_DOCUMENTO.map((t) => `<option value="${t.id}">${t.label}</option>`).join("");
}

// ---------- Carga de documentos del mes visible ----------

function cargarMes() {
  const inicio = fechaISO(new Date(fechaVista.getFullYear(), fechaVista.getMonth(), 1));
  const fin = fechaISO(new Date(fechaVista.getFullYear(), fechaVista.getMonth() + 1, 0));

  if (unsubscribeDocs) unsubscribeDocs();

  // La cuadrícula se pinta ya mismo, aunque los documentos todavía no
  // hayan llegado (o la consulta falle) — así los números de los días
  // siempre se ven.
  pintarCalendario();

  unsubscribeDocs = db
    .collection("documentos")
    .where("fecha", ">=", inicio)
    .where("fecha", "<=", fin)
    .onSnapshot(
      (snap) => {
        docsPorFecha = {};
        snap.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() };
          if (!docsPorFecha[data.fecha]) docsPorFecha[data.fecha] = [];
          docsPorFecha[data.fecha].push(data);
        });
        pintarCalendario();
        if (fechaSeleccionada) pintarListaDocsDia();
      },
      (err) => {
        console.error(err);
        mostrarToast("No se pudo cargar el calendario.");
      }
    );
}

// ---------- Pintar el mes ----------

function cambiarMes(delta) {
  fechaVista = new Date(fechaVista.getFullYear(), fechaVista.getMonth() + delta, 1);
  cargarMes();
}

function irHoy() {
  fechaVista = new Date();
  cargarMes();
}

function pintarCalendario() {
  const anio = fechaVista.getFullYear();
  const mes = fechaVista.getMonth();

  document.getElementById("cal-title").textContent = fechaVista.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  const primerDiaMes = new Date(anio, mes, 1);
  // getDay(): 0=domingo..6=sábado → lo pasamos a 0=lunes..6=domingo
  const offset = (primerDiaMes.getDay() + 6) % 7;
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const hoyISO = fechaISO(new Date());

  const celdas = [];

  for (let i = 0; i < offset; i++) {
    const diaPrevio = new Date(anio, mes, i - offset + 1);
    celdas.push({ date: diaPrevio, otroMes: true });
  }
  for (let d = 1; d <= diasEnMes; d++) {
    celdas.push({ date: new Date(anio, mes, d), otroMes: false });
  }
  while (celdas.length % 7 !== 0) {
    const ultima = celdas[celdas.length - 1].date;
    celdas.push({ date: new Date(ultima.getFullYear(), ultima.getMonth(), ultima.getDate() + 1), otroMes: true });
  }

  const grid = document.getElementById("cal-grid");
  grid.innerHTML = celdas
    .map((c) => {
      const iso = fechaISO(c.date);
      const docs = docsPorFecha[iso] || [];
      const tiposDelDia = [...new Set(docs.map((d) => d.tipo))];
      const clases = ["cal-cell"];
      if (c.otroMes) clases.push("other-month");
      if (iso === hoyISO) clases.push("today");
      if (docs.length > 0) clases.push("has-docs");

      const dotsVisibles = tiposDelDia.slice(0, 5);
      const restantes = tiposDelDia.length - dotsVisibles.length;
      const dotsHtml =
        docs.length > 0
          ? `<div class="cal-dots">${dotsVisibles
              .map((t) => `<span class="cal-dot doc-color-${t}"></span>`)
              .join("")}${restantes > 0 ? `<span class="cal-dot-more">+${restantes}</span>` : ""}</div>`
          : "";

      return `
        <div class="${clases.join(" ")}" onclick="abrirModalDia('${iso}')">
          <span class="cal-daynum">${c.date.getDate()}</span>
          ${dotsHtml}
        </div>
      `;
    })
    .join("");
}

// ---------- Modal: documentos del día ----------

function abrirModalDia(iso) {
  fechaSeleccionada = iso;
  filtrosActivos = new Set(TIPOS_DOCUMENTO.map((t) => t.id));

  const fecha = new Date(iso + "T00:00:00");
  document.getElementById("modal-dia-titulo").textContent = fecha.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  pintarChipsFiltro();
  pintarListaDocsDia();
  document.getElementById("modal-dia-overlay").classList.add("show");
}

function cerrarModalDia() {
  document.getElementById("modal-dia-overlay").classList.remove("show");
  fechaSeleccionada = null;
}

function pintarChipsFiltro() {
  const cont = document.getElementById("filter-chips");
  cont.innerHTML = TIPOS_DOCUMENTO.map(
    (t) => `
      <button type="button" class="filter-chip ${filtrosActivos.has(t.id) ? "active" : ""}" onclick="toggleFiltro('${t.id}')">
        <span class="dot-inline doc-color-${t.id}"></span>${t.label}
      </button>
    `
  ).join("");
}

function toggleFiltro(tipoId) {
  if (filtrosActivos.has(tipoId)) {
    filtrosActivos.delete(tipoId);
  } else {
    filtrosActivos.add(tipoId);
  }
  pintarChipsFiltro();
  pintarListaDocsDia();
}

function pintarListaDocsDia() {
  const cont = document.getElementById("lista-docs-dia");
  const docs = (docsPorFecha[fechaSeleccionada] || []).filter((d) => filtrosActivos.has(d.tipo));

  if (docs.length === 0) {
    cont.innerHTML = `<div class="empty-state" style="padding:24px 16px;">
      <strong>Nada por aquí</strong>
      No hay documentos de este tipo creados este día.
    </div>`;
    return;
  }

  cont.innerHTML = docs
    .map((d) => {
      const puedeGestionar = usuarioActual.rol === "Admin" || d.creadoPorUid === usuarioActual.uid;
      const info = tipoInfo(d.tipo);
      const enlaceHtml = d.enlace
        ? `<a href="${d.enlace}" target="_blank" rel="noopener" style="color:var(--color-text); text-decoration:underline;">Ver enlace</a> · `
        : "";
      return `
        <div class="doc-row">
          <div class="doc-row-bar doc-color-${d.tipo}"></div>
          <div style="flex:1; min-width:0;">
            <div class="doc-row-title">${escaparHtmlCal(d.titulo)}</div>
            <div class="doc-row-meta">
              <span class="doc-badge"><span class="dot-inline doc-color-${d.tipo}"></span>${info.label.replace(/s$/, "")}</span>
              · ${escaparHtmlCal(d.creadoPor || "—")}
              ${d.notas ? " · " + escaparHtmlCal(d.notas) : ""}
            </div>
            ${enlaceHtml ? `<div class="doc-row-meta" style="margin-top:4px;">${enlaceHtml}</div>` : ""}
          </div>
          ${
            puedeGestionar
              ? `<div class="doc-row-actions">
                  <button class="icon-btn" title="Editar" onclick='editarDoc(${JSON.stringify(d).replace(/'/g, "&#39;")})'>✎</button>
                  <button class="icon-btn danger" title="Eliminar" onclick="confirmarEliminarDoc('${d.id}')">🗑</button>
                </div>`
              : ""
          }
        </div>
      `;
    })
    .join("");
}

function escaparHtmlCal(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// ---------- Modal: nuevo / editar documento ----------

const formDoc = document.getElementById("form-doc");
const overlayDoc = document.getElementById("modal-doc-overlay");

function abrirModalNuevoDoc(fechaPrellenada) {
  formDoc.reset();
  document.getElementById("doc-id-edicion").value = "";
  document.getElementById("doc-fecha").value = fechaPrellenada || fechaISO(new Date());
  document.getElementById("modal-doc-titulo").textContent = "Nuevo documento";
  document.getElementById("modal-doc-sub").textContent = "Quedará marcado en el calendario en la fecha indicada.";
  document.getElementById("btn-guardar-doc").textContent = "Guardar";
  ocultarMsgDoc();
  overlayDoc.classList.add("show");
}

function abrirModalNuevoDocDesdeDia() {
  const fecha = fechaSeleccionada;
  cerrarModalDia();
  abrirModalNuevoDoc(fecha);
}

function editarDoc(d) {
  formDoc.reset();
  document.getElementById("doc-id-edicion").value = d.id;
  document.getElementById("doc-tipo").value = d.tipo;
  document.getElementById("doc-titulo").value = d.titulo || "";
  document.getElementById("doc-fecha").value = d.fecha;
  document.getElementById("doc-enlace").value = d.enlace || "";
  document.getElementById("doc-notas").value = d.notas || "";
  document.getElementById("modal-doc-titulo").textContent = "Editar documento";
  document.getElementById("modal-doc-sub").textContent = "Actualiza los datos de este documento.";
  document.getElementById("btn-guardar-doc").textContent = "Guardar cambios";
  ocultarMsgDoc();
  cerrarModalDia();
  overlayDoc.classList.add("show");
}

function cerrarModalDoc() {
  overlayDoc.classList.remove("show");
}

function ocultarMsgDoc() {
  const m = document.getElementById("modal-doc-msg");
  m.className = "form-msg";
  m.textContent = "";
}

function mostrarMsgDoc(texto) {
  const m = document.getElementById("modal-doc-msg");
  m.textContent = texto;
  m.className = "form-msg show error";
}

formDoc.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("doc-id-edicion").value;
  const btn = document.getElementById("btn-guardar-doc");
  btn.disabled = true;

  const datos = {
    tipo: document.getElementById("doc-tipo").value,
    titulo: document.getElementById("doc-titulo").value.trim(),
    fecha: document.getElementById("doc-fecha").value,
    enlace: document.getElementById("doc-enlace").value.trim(),
    notas: document.getElementById("doc-notas").value.trim(),
  };

  try {
    if (id) {
      await db.collection("documentos").doc(id).update(datos);
      mostrarToast("Documento actualizado.");
    } else {
      await db.collection("documentos").add({
        ...datos,
        creadoPor: nombreCompletoDe(usuarioActual) || usuarioActual.email,
        creadoPorUid: usuarioActual.uid,
        creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
      });
      mostrarToast("Documento creado y marcado en el calendario.");
    }
    cerrarModalDoc();
  } catch (err) {
    console.error(err);
    mostrarMsgDoc("No se pudo guardar. Inténtalo de nuevo.");
  } finally {
    btn.disabled = false;
  }
});

function confirmarEliminarDoc(id) {
  if (!confirm("¿Eliminar este documento del calendario?")) return;
  db.collection("documentos")
    .doc(id)
    .delete()
    .then(() => mostrarToast("Documento eliminado."))
    .catch((err) => {
      console.error(err);
      mostrarToast("No se pudo eliminar.");
    });
}

// ---------- Toast ----------

let toastTimerCal;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerCal);
  toastTimerCal = setTimeout(() => t.classList.remove("show"), 3200);
}
