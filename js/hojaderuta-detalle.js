// =========================================================
// STAGE SUPPORT — hojaderuta-detalle.js
// Editor completo de una Hoja de Ruta (contactos, planning por días,
// alojamiento, dietas, previsión meteorológica) + impresión y PDF.
// =========================================================

let usuarioActualHRD = null;
let docIdHR = null;
let contactos = [];
let plannings = [];
let logoEventoDataUrl = null;
let previsionTiempoActual = null;

(async function () {
  const params = new URLSearchParams(window.location.search);
  docIdHR = params.get("id");
  if (!docIdHR) {
    window.location.href = "hojasderuta.html";
    return;
  }

  usuarioActualHRD = await protegerPagina(["Producción", "Admin"]);
  pintarNav(usuarioActualHRD.rol, "hojasderuta");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualHRD) || usuarioActualHRD.email;
  document.getElementById("pass-role").textContent = usuarioActualHRD.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualHRD.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualHRD.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualHRD) || usuarioActualHRD.email);
  }

  await cargarOpcionesArtista();
  await cargarLogoDocumentoEmpresa();
  await cargarHR();
})();

let rosterCache = [];
let logoDocumentoEmpresa = null;

async function cargarOpcionesArtista() {
  const sel = document.getElementById("da-artista");
  try {
    const snap = await db.collection("roster").orderBy("nombre").get();
    rosterCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const opciones = rosterCache.map((r) => `<option value="${r.id}">${escaparHtmlHRD(r.nombre)}</option>`).join("");
    sel.innerHTML = `<option value="">— Selecciona del Roster —</option>${opciones}`;
  } catch (err) {
    console.error(err);
  }
}

async function cargarLogoDocumentoEmpresa() {
  try {
    const snap = await db.collection("configuracion").doc("empresa").get();
    if (snap.exists) logoDocumentoEmpresa = snap.data().logoDocumentos || null;
  } catch (err) {
    console.error(err);
  }
}

function alSeleccionarArtista() {
  const id = document.getElementById("da-artista").value;
  const artista = rosterCache.find((r) => r.id === id);
  if (artista && artista.logo) {
    logoEventoDataUrl = artista.logo;
    mostrarPreviewLogoEvento(logoEventoDataUrl);
  }
}

function fechaISOHRD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------- Cargar ----------

async function cargarHR() {
  try {
    const snap = await db.collection("hojasDeRuta").doc(docIdHR).get();
    if (!snap.exists) {
      mostrarToast("Esta hoja de ruta no existe.");
      setTimeout(() => (window.location.href = "hojasderuta.html"), 1500);
      return;
    }
    const d = snap.data();

    document.getElementById("hr-id-badge").textContent = d.idVisible || "—";
    document.getElementById("hr-titulo-cabecera").textContent = d.nombre || "Hoja de ruta";
    document.getElementById("d-nombre").value = d.nombre || "";
    document.getElementById("d-observaciones").value = d.observaciones || "";

    const da = d.datosActuacion || {};
    document.getElementById("da-artista").value = da.artistaRosterId || "";
    document.getElementById("da-fecha").value = da.fecha || d.fecha || "";
    document.getElementById("da-ciudad").value = da.ciudad || "";
    document.getElementById("da-local").value = da.local || "";
    document.getElementById("da-direccion").value = da.direccion || "";
    document.getElementById("da-maps").value = da.mapsUrl || "";
    document.getElementById("da-parking").value = da.parking || "";

    const aloj = d.alojamiento || {};
    document.getElementById("aloj-activo").checked = !!aloj.activo;
    document.getElementById("aloj-nombre").value = aloj.nombre || "";
    document.getElementById("aloj-direccion").value = aloj.direccion || "";
    document.getElementById("aloj-telefono").value = aloj.telefono || "";
    document.getElementById("aloj-maps").value = aloj.mapsUrl || "";
    document.getElementById("aloj-checkin").value = aloj.checkin || "";
    document.getElementById("aloj-checkout").value = aloj.checkout || "";
    document.getElementById("aloj-parking").value = aloj.parking || "";
    document.getElementById("aloj-notas").value = aloj.notas || "";
    toggleBloque("aloj");

    const dietas = d.dietas || {};
    document.getElementById("dietas-activo").checked = !!dietas.activo;
    document.getElementById("dietas-nombre").value = dietas.nombre || "";
    document.getElementById("dietas-direccion").value = dietas.direccion || "";
    document.getElementById("dietas-telefono").value = dietas.telefono || "";
    document.getElementById("dietas-maps").value = dietas.mapsUrl || "";
    document.getElementById("dietas-horario").value = dietas.horario || "";
    document.getElementById("dietas-notas").value = dietas.notas || "";
    toggleBloque("dietas");

    logoEventoDataUrl = d.logoEvento || null;
    mostrarPreviewLogoEvento(logoEventoDataUrl);

    previsionTiempoActual = d.previsionTiempo || null;
    pintarWeatherBox();

    contactos = Array.isArray(d.contactos) ? d.contactos : [];
    renderContactos();

    plannings = Array.isArray(d.plannings) && d.plannings.length > 0
      ? d.plannings
      : [{ fecha: da.fecha || fechaISOHRD(new Date()), filas: [{ tarea: "", hora: "", observaciones: "" }] }];
    renderPlannings();
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo cargar la hoja de ruta.");
  }
}

// ---------- Contactos ----------

function renderContactos() {
  const cont = document.getElementById("lista-contactos");
  if (contactos.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay contactos añadidos.</p>`;
    return;
  }
  cont.innerHTML = contactos
    .map(
      (c, i) => `
        <div class="repeat-row contactos-row">
          <input list="tipos-contacto" placeholder="Tipo" value="${escaparAttr(c.tipo)}" oninput="contactos[${i}].tipo=this.value" />
          <input placeholder="Nombre" value="${escaparAttr(c.nombre)}" oninput="contactos[${i}].nombre=this.value" />
          <input placeholder="Teléfono" value="${escaparAttr(c.telefono)}" oninput="contactos[${i}].telefono=this.value" />
          <input placeholder="Observaciones" value="${escaparAttr(c.observaciones)}" oninput="contactos[${i}].observaciones=this.value" />
          <button type="button" class="remove-row-btn" onclick="eliminarContacto(${i})" title="Quitar">✕</button>
        </div>
      `
    )
    .join("");
}

function anadirContacto() {
  contactos.push({ tipo: "", nombre: "", telefono: "", observaciones: "" });
  renderContactos();
}

function eliminarContacto(i) {
  contactos.splice(i, 1);
  renderContactos();
}

// ---------- Planning ----------

function renderPlannings() {
  const cont = document.getElementById("lista-plannings");
  cont.innerHTML = plannings
    .map((dia, di) => {
      const filasHtml = dia.filas
        .map(
          (f, fi) => `
            <div class="repeat-row planning-row">
              <input placeholder="Tarea" value="${escaparAttr(f.tarea)}" oninput="plannings[${di}].filas[${fi}].tarea=this.value" />
              <input placeholder="Hora" value="${escaparAttr(f.hora)}" oninput="plannings[${di}].filas[${fi}].hora=this.value" />
              <input placeholder="Observaciones" value="${escaparAttr(f.observaciones)}" oninput="plannings[${di}].filas[${fi}].observaciones=this.value" />
              <button type="button" class="remove-row-btn" onclick="eliminarFilaPlanning(${di},${fi})" title="Quitar">✕</button>
            </div>
          `
        )
        .join("");

      return `
        <div class="day-block">
          <div class="day-block-head">
            <label style="font-size:13px; font-weight:600;">Día:</label>
            <input type="date" value="${escaparAttr(dia.fecha)}" oninput="plannings[${di}].fecha=this.value" />
            <button type="button" class="icon-btn danger" style="margin-left:auto;" title="Eliminar día" onclick="eliminarDiaPlanning(${di})">🗑</button>
          </div>
          ${filasHtml}
          <button type="button" class="add-row-link" onclick="anadirFilaPlanning(${di})">+ Añadir fila</button>
        </div>
      `;
    })
    .join("");
}

function anadirDiaPlanning() {
  plannings.push({ fecha: fechaISOHRD(new Date()), filas: [{ tarea: "", hora: "", observaciones: "" }] });
  renderPlannings();
}

function eliminarDiaPlanning(di) {
  plannings.splice(di, 1);
  renderPlannings();
}

function anadirFilaPlanning(di) {
  plannings[di].filas.push({ tarea: "", hora: "", observaciones: "" });
  renderPlannings();
}

function eliminarFilaPlanning(di, fi) {
  plannings[di].filas.splice(fi, 1);
  renderPlannings();
}

// ---------- Bloques opcionales (Alojamiento / Dietas) ----------

function toggleBloque(nombre) {
  const activo = document.getElementById(`${nombre}-activo`).checked;
  document.getElementById(`bloque-${nombre}`).style.display = activo ? "grid" : "none";
}

// ---------- Logo del evento ----------

function procesarLogoEvento(event) {
  const archivo = event.target.files[0];
  if (!archivo || !archivo.type.startsWith("image/")) return;

  const lector = new FileReader();
  lector.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 220;
      let w = img.width;
      let h = img.height;
      if (w > MAX || h > MAX) {
        const ratio = Math.min(MAX / w, MAX / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      logoEventoDataUrl = canvas.toDataURL("image/png");
      mostrarPreviewLogoEvento(logoEventoDataUrl);
    };
    img.src = e.target.result;
  };
  lector.readAsDataURL(archivo);
}

function mostrarPreviewLogoEvento(dataUrl) {
  const preview = document.getElementById("evento-logo-preview");
  const btnQuitar = document.getElementById("btn-quitar-logo-evento");
  if (dataUrl) {
    preview.innerHTML = `<img src="${dataUrl}" alt="" />`;
    btnQuitar.style.display = "inline-flex";
  } else {
    preview.textContent = "Sin logo";
    btnQuitar.style.display = "none";
  }
}

function quitarLogoEvento() {
  logoEventoDataUrl = null;
  document.getElementById("evento-logo-input").value = "";
  mostrarPreviewLogoEvento(null);
}

// ---------- Previsión meteorológica (Open-Meteo, gratis, sin clave) ----------

const CODIGOS_TIEMPO = {
  0: "Despejado", 1: "Poco nuboso", 2: "Parcialmente nublado", 3: "Cubierto",
  45: "Niebla", 48: "Niebla helada",
  51: "Llovizna floja", 53: "Llovizna", 55: "Llovizna intensa",
  61: "Lluvia floja", 63: "Lluvia", 65: "Lluvia intensa",
  71: "Nieve floja", 73: "Nieve", 75: "Nieve intensa",
  80: "Chubascos flojos", 81: "Chubascos", 82: "Chubascos fuertes",
  95: "Tormenta", 96: "Tormenta con granizo", 99: "Tormenta fuerte con granizo",
};

async function consultarPrevisionTiempo() {
  const ciudad = document.getElementById("da-ciudad").value.trim();
  const fecha = document.getElementById("da-fecha").value;
  const box = document.getElementById("weather-box");

  if (!ciudad || !fecha) {
    mostrarToast("Rellena Ciudad y Fecha antes de consultar la previsión.");
    return;
  }

  box.textContent = "Consultando…";

  try {
    const geoResp = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ciudad)}&count=1&language=es&format=json`
    );
    const geoData = await geoResp.json();
    if (!geoData.results || geoData.results.length === 0) {
      previsionTiempoActual = null;
      box.textContent = "No se ha encontrado esa ciudad.";
      return;
    }
    const { latitude, longitude, name } = geoData.results[0];

    const foreResp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=${fecha}&end_date=${fecha}`
    );
    const foreData = await foreResp.json();

    if (!foreData.daily || !foreData.daily.time || foreData.daily.time.length === 0) {
      previsionTiempoActual = null;
      box.textContent = `Sin previsión disponible para ${name} en esa fecha (normalmente solo hay datos para los próximos ~16 días).`;
      return;
    }

    previsionTiempoActual = {
      ciudad: name,
      tiempo: CODIGOS_TIEMPO[foreData.daily.weathercode[0]] || "—",
      tempMax: foreData.daily.temperature_2m_max[0],
      tempMin: foreData.daily.temperature_2m_min[0],
      precipitacion: foreData.daily.precipitation_probability_max[0],
      consultadoEl: new Date().toISOString(),
    };
    pintarWeatherBox();
  } catch (err) {
    console.error(err);
    box.textContent = "No se pudo consultar la previsión (comprueba tu conexión).";
  }
}

function pintarWeatherBox() {
  const box = document.getElementById("weather-box");
  if (!previsionTiempoActual) {
    box.textContent = "Todavía no se ha consultado. Rellena Ciudad y Fecha y pulsa \"Consultar previsión\".";
    return;
  }
  const p = previsionTiempoActual;
  box.innerHTML = `
    <div class="weather-stat"><strong>${escaparHtmlHRD(p.tiempo)}</strong>${escaparHtmlHRD(p.ciudad || "")}</div>
    <div class="weather-stat"><strong>${p.tempMax}° / ${p.tempMin}°</strong>máx / mín</div>
    <div class="weather-stat"><strong>${p.precipitacion}%</strong>precipitación</div>
  `;
}

// ---------- Recopilar datos actuales del formulario ----------

function recopilarDatosHR() {
  return {
    nombre: document.getElementById("d-nombre").value.trim(),
    observaciones: document.getElementById("d-observaciones").value.trim(),
    datosActuacion: {
      artistaRosterId: document.getElementById("da-artista").value,
      artista: (() => {
        const sel = document.getElementById("da-artista");
        return sel.value && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : "";
      })(),
      fecha: document.getElementById("da-fecha").value,
      ciudad: document.getElementById("da-ciudad").value.trim(),
      local: document.getElementById("da-local").value.trim(),
      direccion: document.getElementById("da-direccion").value.trim(),
      mapsUrl: document.getElementById("da-maps").value.trim(),
      parking: document.getElementById("da-parking").value,
    },
    contactos,
    plannings,
    alojamiento: {
      activo: document.getElementById("aloj-activo").checked,
      nombre: document.getElementById("aloj-nombre").value.trim(),
      direccion: document.getElementById("aloj-direccion").value.trim(),
      telefono: document.getElementById("aloj-telefono").value.trim(),
      mapsUrl: document.getElementById("aloj-maps").value.trim(),
      checkin: document.getElementById("aloj-checkin").value.trim(),
      checkout: document.getElementById("aloj-checkout").value.trim(),
      parking: document.getElementById("aloj-parking").value,
      notas: document.getElementById("aloj-notas").value.trim(),
    },
    dietas: {
      activo: document.getElementById("dietas-activo").checked,
      nombre: document.getElementById("dietas-nombre").value.trim(),
      direccion: document.getElementById("dietas-direccion").value.trim(),
      telefono: document.getElementById("dietas-telefono").value.trim(),
      mapsUrl: document.getElementById("dietas-maps").value.trim(),
      horario: document.getElementById("dietas-horario").value.trim(),
      notas: document.getElementById("dietas-notas").value.trim(),
    },
    logoEvento: logoEventoDataUrl || null,
    previsionTiempo: previsionTiempoActual || null,
  };
}

// ---------- Guardar ----------

async function guardarHR() {
  const btn = document.getElementById("btn-guardar-hr");
  btn.disabled = true;
  try {
    const datos = recopilarDatosHR();
    await db.collection("hojasDeRuta").doc(docIdHR).update({
      ...datos,
      fecha: datos.datosActuacion.fecha || null,
    });
    document.getElementById("hr-titulo-cabecera").textContent = datos.nombre || "Hoja de ruta";
    mostrarToast("Hoja de ruta guardada.");
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo guardar. Inténtalo de nuevo.");
  } finally {
    btn.disabled = false;
  }
}

// ---------- Imprimir / PDF ----------

function escaparHtmlHRD(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function escaparAttr(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function construirHtmlImprimible(datos, idVisible) {
  const da = datos.datosActuacion;
  const fechaLarga = da.fecha ? new Date(da.fecha + "T00:00:00").toLocaleDateString("es-ES") : "—";

  const filaLabel = (label, valor) => `<tr><td class="label">${label}</td><td>${escaparHtmlHRD(valor || "—")}</td></tr>`;

  const contactosHtml = datos.contactos.length
    ? `
      <table class="doc-table">
        <tr><th class="doc-section-title" colspan="4">CONTACTOS</th></tr>
        <tr><th>Tipo</th><th>Nombre</th><th>Teléfono</th><th>Observaciones</th></tr>
        ${datos.contactos
          .map((c) => `<tr><td>${escaparHtmlHRD(c.tipo)}</td><td>${escaparHtmlHRD(c.nombre)}</td><td>${escaparHtmlHRD(c.telefono)}</td><td>${escaparHtmlHRD(c.observaciones)}</td></tr>`)
          .join("")}
      </table>
    `
    : "";

  const planningsHtml = datos.plannings
    .map((dia) => {
      const fechaDia = dia.fecha ? new Date(dia.fecha + "T00:00:00").toLocaleDateString("es-ES") : "—";
      return `
        <table class="doc-table">
          <tr><th class="doc-section-title" colspan="3">PLANNING ${fechaDia}</th></tr>
          <tr><th>Tarea</th><th>Hora</th><th>Observaciones</th></tr>
          ${dia.filas
            .map((f) => `<tr><td>${escaparHtmlHRD(f.tarea)}</td><td>${escaparHtmlHRD(f.hora)}</td><td>${escaparHtmlHRD(f.observaciones)}</td></tr>`)
            .join("")}
        </table>
      `;
    })
    .join("");

  const alojamientoHtml = datos.alojamiento.activo
    ? `
      <table class="doc-table">
        <tr><th class="doc-section-title" colspan="2">ALOJAMIENTO</th></tr>
        ${filaLabel("Nombre", datos.alojamiento.nombre)}
        ${filaLabel("Dirección", datos.alojamiento.direccion)}
        ${filaLabel("Teléfono", datos.alojamiento.telefono)}
        ${filaLabel("Check-in / Check-out", `${datos.alojamiento.checkin || "—"} / ${datos.alojamiento.checkout || "—"}`)}
        ${filaLabel("Parking", datos.alojamiento.parking)}
        ${filaLabel("Notas", datos.alojamiento.notas)}
      </table>
    `
    : "";

  const dietasHtml = datos.dietas.activo
    ? `
      <table class="doc-table">
        <tr><th class="doc-section-title" colspan="2">DIETAS</th></tr>
        ${filaLabel("Restaurante / Catering", datos.dietas.nombre)}
        ${filaLabel("Dirección", datos.dietas.direccion)}
        ${filaLabel("Teléfono", datos.dietas.telefono)}
        ${filaLabel("Horario", datos.dietas.horario)}
        ${filaLabel("Notas", datos.dietas.notas)}
      </table>
    `
    : "";

  const p = datos.previsionTiempo;
  const meteoHtml = `
    <table class="doc-table">
      <tr><th class="doc-section-title" colspan="4">PREVISIÓN METEOROLÓGICA</th></tr>
      <tr><th>Ciudad</th><th>Tiempo previsto</th><th>% precipitación</th><th>Temp. máx. / mín.</th></tr>
      <tr>
        <td>${escaparHtmlHRD(da.ciudad || "—")}</td>
        <td>${p ? escaparHtmlHRD(p.tiempo) : "—"}</td>
        <td>${p ? p.precipitacion + "%" : "—"}</td>
        <td>${p ? `${p.tempMax}° / ${p.tempMin}°` : "—"}</td>
      </tr>
    </table>
  `;

  const ahora = new Date().toLocaleString("es-ES");

  return `
    <div class="doc-page">
      <div class="doc-header">
        <img class="doc-logo" src="${logoDocumentoEmpresa || "assets/logo_stagesupport.png"}" onerror="this.style.display='none'" />
        ${logoEventoDataUrl ? `<img class="doc-logo-evento" src="${logoEventoDataUrl}" />` : ""}
      </div>
      <div class="doc-title-block">
        <h1>${escaparHtmlHRD(datos.nombre || "Hoja de ruta")}</h1>
        <div class="doc-id-text">${escaparHtmlHRD(idVisible)}</div>
      </div>

      <table class="doc-table">
        <tr><th class="doc-section-title" colspan="4">DATOS DE LA ACTUACIÓN</th></tr>
        <tr>
          <td class="label">Artista/Grupo</td><td>${escaparHtmlHRD(da.artista)}</td>
          <td class="label">Fecha</td><td>${fechaLarga}</td>
        </tr>
        <tr>
          <td class="label">Ciudad</td><td>${escaparHtmlHRD(da.ciudad)}</td>
          <td class="label">Local/Recinto/Festival</td><td>${escaparHtmlHRD(da.local)}</td>
        </tr>
        <tr>
          <td class="label">Dirección</td>
          <td colspan="3">${escaparHtmlHRD(da.direccion)} ${da.mapsUrl ? `— <a href="${da.mapsUrl}">${da.mapsUrl}</a>` : ""}</td>
        </tr>
        <tr>
          <td class="label">Parking</td><td colspan="3">${escaparHtmlHRD(da.parking || "—")}</td>
        </tr>
      </table>

      ${contactosHtml}
      ${planningsHtml}
      ${alojamientoHtml}
      ${dietasHtml}
      ${meteoHtml}

      ${datos.observaciones ? `<table class="doc-table"><tr><th class="doc-section-title">OBSERVACIONES</th></tr><tr><td>${escaparHtmlHRD(datos.observaciones)}</td></tr></table>` : ""}

      <div class="doc-provisional">HOJA DE RUTA PROVISIONAL</div>
      <div class="doc-footer-note">Generado por Stage Support - ${ahora}</div>
    </div>
  `;
}

function imprimirHR() {
  const datos = recopilarDatosHR();
  const idVisible = document.getElementById("hr-id-badge").textContent;
  document.getElementById("print-area").innerHTML = construirHtmlImprimible(datos, idVisible);
  setTimeout(() => window.print(), 50);
}

function descargarPdfHR() {
  const datos = recopilarDatosHR();
  const idVisible = document.getElementById("hr-id-badge").textContent;
  const printArea = document.getElementById("print-area");
  printArea.innerHTML = construirHtmlImprimible(datos, idVisible);
  printArea.style.display = "block";

  const nombreArchivo = `${idVisible}_${(datos.nombre || "hoja-de-ruta").replace(/[^\w\- ]/g, "").trim()}.pdf`;

  html2pdf()
    .from(printArea)
    .set({
      margin: 10,
      filename: nombreArchivo,
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    })
    .save()
    .then(() => {
      printArea.style.display = "none";
    });
}

// ---------- Toast ----------

let toastTimerHRD;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerHRD);
  toastTimerHRD = setTimeout(() => t.classList.remove("show"), 3200);
}
