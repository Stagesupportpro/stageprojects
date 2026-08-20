// =========================================================
// STAGE SUPPORT — calendario-roster-maestro.js
// Vista general (Booking & Management) de TODAS las fechas de TODO
// el Roster, en un calendario mensual — con filtro por artista y
// exportación a PDF del año completo (usa construirCalendarioAnualHtml
// de calendario-roster.js, el mismo motor que usa Roster por artista).
// =========================================================

let usuarioActualCR = null;
let fechaVistaCR = new Date();
let entradasDelMesCR = [];
let unsubscribeCR = null;
let filtroTextoCR = "";
let fechaSeleccionadaCR = null;
let logoDocumentoEmpresaCR = null;

(async function () {
  usuarioActualCR = await protegerPagina();
  pintarNav(usuarioActualCR.rol, "calendario-roster");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualCR) || usuarioActualCR.email;
  document.getElementById("pass-role").textContent = usuarioActualCR.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualCR.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualCR.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualCR) || usuarioActualCR.email);
  }

  try {
    const snapEmpresa = await db.collection("configuracion").doc("empresa").get();
    if (snapEmpresa.exists) logoDocumentoEmpresaCR = snapEmpresa.data().logoDocumentos || null;
  } catch (errLogo) {
    console.error(errLogo);
  }

  cargarMesCR();
})();

function fechaISOcr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------- Carga del mes visible ----------

function cargarMesCR() {
  const inicio = fechaISOcr(new Date(fechaVistaCR.getFullYear(), fechaVistaCR.getMonth(), 1));
  const fin = fechaISOcr(new Date(fechaVistaCR.getFullYear(), fechaVistaCR.getMonth() + 1, 0));

  if (unsubscribeCR) unsubscribeCR();

  // La cuadrícula se pinta ya mismo, aunque las fechas todavía no
  // hayan llegado (o la consulta falle) — así los números de los
  // días siempre se ven.
  pintarCalendarioCR();

  unsubscribeCR = db
    .collection("calendarioArtistas")
    .where("fecha", ">=", inicio)
    .where("fecha", "<=", fin)
    .onSnapshot(
      (snap) => {
        entradasDelMesCR = [];
        snap.forEach((doc) => {
          const d = doc.data();
          if (d.estado !== "rechazado") entradasDelMesCR.push({ id: doc.id, ...d });
        });
        pintarCalendarioCR();
        if (fechaSeleccionadaCR) pintarListaDiaCR();
      },
      (err) => {
        console.error(err);
        mostrarToast("No se pudo cargar el calendario del Roster.");
      }
    );
}

function aplicarFiltroCalendarioMaestro() {
  filtroTextoCR = (document.getElementById("cr-busqueda").value || "").trim().toLowerCase();
  pintarCalendarioCR();
  if (fechaSeleccionadaCR) pintarListaDiaCR();
}

function entradasFiltradasCR() {
  if (!filtroTextoCR) return entradasDelMesCR;
  return entradasDelMesCR.filter((e) => (e.rosterNombre || "").toLowerCase().includes(filtroTextoCR));
}

function entradasEnDiaCR(iso) {
  return entradasFiltradasCR().filter((e) => e.fecha === iso);
}

// ---------- Pintar el mes ----------

function cambiarMesCR(delta) {
  fechaVistaCR = new Date(fechaVistaCR.getFullYear(), fechaVistaCR.getMonth() + delta, 1);
  cargarMesCR();
}

function irHoyCR() {
  fechaVistaCR = new Date();
  cargarMesCR();
}

function pintarCalendarioCR() {
  const anio = fechaVistaCR.getFullYear();
  const mes = fechaVistaCR.getMonth();

  document.getElementById("cal-title-cr").textContent = fechaVistaCR.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  const primerDiaMes = new Date(anio, mes, 1);
  const offset = (primerDiaMes.getDay() + 6) % 7;
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const hoyISO = fechaISOcr(new Date());

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

  const grid = document.getElementById("cal-grid-cr");
  grid.innerHTML = celdas
    .map((c) => {
      const iso = fechaISOcr(c.date);
      const entradas = entradasEnDiaCR(iso);
      const clases = ["cal-cell"];
      if (c.otroMes) clases.push("other-month");
      if (iso === hoyISO) clases.push("today");
      if (entradas.length > 0) clases.push("has-campanas");

      const dotsVisibles = entradas.slice(0, 5);
      const restantes = entradas.length - dotsVisibles.length;
      const dotsHtml =
        entradas.length > 0
          ? `<div class="cal-dots">${dotsVisibles
              .map((e) => `<span class="cal-dot" style="width:8px; height:8px; padding:0; background:${e.estado === "aceptado" ? "#2FA84F" : "#D99A1B"};"></span>`)
              .join("")}${restantes > 0 ? `<span class="cal-dot-more">+${restantes}</span>` : ""}</div>`
          : "";

      return `
        <div class="${clases.join(" ")}" onclick="abrirModalDiaCR('${iso}')">
          <span class="cal-daynum">${c.date.getDate()}</span>
          ${dotsHtml}
        </div>
      `;
    })
    .join("");
}

// ---------- Modal del día ----------

function abrirModalDiaCR(iso) {
  fechaSeleccionadaCR = iso;
  const fecha = new Date(iso + "T00:00:00");
  document.getElementById("modal-dia-titulo").textContent = fecha.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  pintarListaDiaCR();
  document.getElementById("modal-dia-overlay").classList.add("show");
}

function cerrarModalDiaCR() {
  document.getElementById("modal-dia-overlay").classList.remove("show");
  fechaSeleccionadaCR = null;
}

function pintarListaDiaCR() {
  const cont = document.getElementById("lista-dia-cr");
  const entradas = entradasEnDiaCR(fechaSeleccionadaCR);

  if (entradas.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px; padding:16px 0;">No hay artistas con fecha este día.</p>`;
    return;
  }

  cont.innerHTML = entradas
    .map((e) => {
      const enlace = e.origen === "booking" ? `booking-detalle.html?id=${e.origenId}` : e.origen === "produccion" ? `produccion-detalle.html?id=${e.origenId}` : null;
      const estadoTexto = e.estado === "aceptado" ? "Aceptado" : "Pendiente Confirmación";
      const claseEstado = e.estado === "aceptado" ? "EF" : "pendiente";
      return `
        <div class="dash-mini-row">
          <div>
            <div class="dash-mini-titulo">${escaparHtmlCR(e.rosterNombre || "—")}</div>
            <div class="dash-mini-meta">
              <span class="estado-pago-badge ${claseEstado}">${estadoTexto}</span>
              ${e.ciudad ? `· ${escaparHtmlCR(e.ciudad)}` : ""}
              ${e.origenIdVisible ? `· ${escaparHtmlCR(e.origenIdVisible)}` : ""}
            </div>
          </div>
          ${enlace ? `<a class="btn-ghost" style="text-decoration:none; padding:6px 12px; font-size:12px;" href="${enlace}" target="_blank">Abrir</a>` : ""}
        </div>
      `;
    })
    .join("");
}

function escaparHtmlCR(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// ---------- Exportar PDF (año completo) ----------

async function exportarPdfCalendarioMaestro() {
  const anio = fechaVistaCR.getFullYear();
  mostrarToast("Preparando PDF…");

  try {
    const inicio = `${anio}-01-01`;
    const fin = `${anio}-12-31`;
    const snap = await db.collection("calendarioArtistas").where("fecha", ">=", inicio).where("fecha", "<=", fin).get();
    let entradas = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => e.estado !== "rechazado");
    if (filtroTextoCR) entradas = entradas.filter((e) => (e.rosterNombre || "").toLowerCase().includes(filtroTextoCR));

    if (entradas.length === 0) {
      mostrarToast("No hay fechas que exportar con este filtro.");
      return;
    }

    const entradasPorFecha = {};
    entradas.forEach((e) => {
      if (!entradasPorFecha[e.fecha]) entradasPorFecha[e.fecha] = [];
      entradasPorFecha[e.fecha].push({ ciudad: e.ciudad, estado: e.estado, rosterNombre: e.rosterNombre });
    });

    // Si el filtro deja un único artista, se usa su logo y se le
    // quita el nombre repetido de cada celda (ya está en el título).
    const nombresUnicos = [...new Set(entradas.map((e) => e.rosterNombre))];
    let logoArtista = null;
    let titulo = `Calendario ${anio} — Roster completo`;

    if (nombresUnicos.length === 1) {
      titulo = `Calendario ${anio} — ${nombresUnicos[0]}`;
      Object.keys(entradasPorFecha).forEach((k) => entradasPorFecha[k].forEach((x) => (x.rosterNombre = "")));
      try {
        const snapArtista = await db.collection("roster").doc(entradas[0].rosterId).get();
        if (snapArtista.exists) logoArtista = snapArtista.data().logo || null;
      } catch (errArtista) {
        console.error(errArtista);
      }
    }

    const printArea = document.getElementById("print-area");
    printArea.innerHTML = construirCalendarioAnualHtml(anio, entradasPorFecha, titulo, logoDocumentoEmpresaCR, logoArtista);
    printArea.style.display = "block";

    await html2pdf()
      .from(printArea)
      .set({
        margin: 8,
        filename: `Calendario_${anio}_Roster.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
      })
      .save();

    printArea.style.display = "none";
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo generar el PDF.");
  }
}

// ---------- Toast ----------

let toastTimerCR;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerCR);
  toastTimerCR = setTimeout(() => t.classList.remove("show"), 3200);
}
