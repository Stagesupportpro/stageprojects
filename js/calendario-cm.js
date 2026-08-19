// =========================================================
// STAGE SUPPORT — calendario-cm.js
// Cuadrícula mensual mostrando qué campañas de marketing están
// activas cada día (por rango fechaInicio–fechaFin), a diferencia
// del calendario general que marca un único día por documento.
// =========================================================

const PLATAFORMAS_CM = [
  { id: "Meta", label: "Meta" },
  { id: "Instagram", label: "Instagram" },
  { id: "Facebook", label: "Facebook" },
  { id: "TikTok", label: "TikTok" },
  { id: "GoogleAds", label: "Google Ads" },
  { id: "LinkedIn", label: "LinkedIn" },
  { id: "Otro", label: "Otro" },
];

let usuarioActualCalCM = null;
let fechaVistaCM = new Date();
let campanasDelMes = []; // campañas que se solapan con el mes visible
let unsubscribeCampanasCM = null;
let fechaSeleccionadaCM = null;

(async function () {
  usuarioActualCalCM = await protegerPagina();
  pintarNav(usuarioActualCalCM.rol, "calendario-cm");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualCalCM) || usuarioActualCalCM.email;
  document.getElementById("pass-role").textContent = usuarioActualCalCM.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualCalCM.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualCalCM.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualCalCM) || usuarioActualCalCM.email);
  }

  pintarLeyendaCM();
  cargarMesCM();
})();

function fechaISOcm(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function pintarLeyendaCM() {
  const cont = document.getElementById("cal-legend-cm");
  cont.innerHTML = PLATAFORMAS_CM.map(
    (p) => `<span class="legend-item"><span class="legend-dot plataforma-badge ${p.id}" style="width:10px; height:10px; padding:0; border-radius:50%;"></span>${p.label}</span>`
  ).join("");
}

// ---------- Carga del mes visible ----------

function cargarMesCM() {
  const finMes = fechaISOcm(new Date(fechaVistaCM.getFullYear(), fechaVistaCM.getMonth() + 1, 0));

  if (unsubscribeCampanasCM) unsubscribeCampanasCM();

  // La cuadrícula del mes se pinta ya mismo, aunque las campañas todavía
  // no hayan llegado (o la consulta falle) — así los números de los días
  // siempre se ven, y solo los puntos de campaña dependen de Firestore.
  pintarCalendarioCM();

  // Una campaña "cabe" en el mes visible si empezó como muy tarde el
  // último día del mes — el otro extremo (que no haya terminado antes
  // de que empezara el mes) se filtra en el navegador, porque Firestore
  // no permite un rango en dos campos distintos a la vez sin índice.
  unsubscribeCampanasCM = db
    .collection("campanas")
    .where("fechaInicio", "<=", finMes)
    .onSnapshot(
      (snap) => {
        const inicioMes = fechaISOcm(new Date(fechaVistaCM.getFullYear(), fechaVistaCM.getMonth(), 1));
        campanasDelMes = [];
        snap.forEach((doc) => {
          const c = { id: doc.id, ...doc.data() };
          if (c.fechaFin && c.fechaFin >= inicioMes) campanasDelMes.push(c);
        });
        pintarCalendarioCM();
        if (fechaSeleccionadaCM) pintarListaCampanasDia();
      },
      (err) => {
        console.error(err);
        mostrarToast("No se pudo cargar el calendario de campañas.");
      }
    );
}

function campanasActivasEnDia(iso) {
  return campanasDelMes.filter((c) => c.fechaInicio <= iso && c.fechaFin >= iso);
}

// ---------- Pintar el mes ----------

function cambiarMesCM(delta) {
  fechaVistaCM = new Date(fechaVistaCM.getFullYear(), fechaVistaCM.getMonth() + delta, 1);
  cargarMesCM();
}

function irHoyCM() {
  fechaVistaCM = new Date();
  cargarMesCM();
}

function pintarCalendarioCM() {
  const anio = fechaVistaCM.getFullYear();
  const mes = fechaVistaCM.getMonth();

  document.getElementById("cal-title-cm").textContent = fechaVistaCM.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  const primerDiaMes = new Date(anio, mes, 1);
  const offset = (primerDiaMes.getDay() + 6) % 7;
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const hoyISO = fechaISOcm(new Date());

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

  const grid = document.getElementById("cal-grid-cm");
  grid.innerHTML = celdas
    .map((c) => {
      const iso = fechaISOcm(c.date);
      const activas = campanasActivasEnDia(iso);
      const plataformas = [...new Set(activas.map((x) => x.plataforma || "Otro"))];
      const clases = ["cal-cell"];
      if (c.otroMes) clases.push("other-month");
      if (iso === hoyISO) clases.push("today");
      if (activas.length > 0) clases.push("has-campanas");

      const dotsVisibles = plataformas.slice(0, 5);
      const restantes = plataformas.length - dotsVisibles.length;
      const dotsHtml =
        activas.length > 0
          ? `<div class="cal-dots">${dotsVisibles
              .map((p) => `<span class="cal-dot plataforma-badge ${p}" style="width:8px; height:8px; padding:0;"></span>`)
              .join("")}${restantes > 0 ? `<span class="cal-dot-more">+${restantes}</span>` : ""}</div>`
          : "";

      return `
        <div class="${clases.join(" ")}" onclick="abrirModalDiaCM('${iso}')">
          <span class="cal-daynum">${c.date.getDate()}</span>
          ${dotsHtml}
        </div>
      `;
    })
    .join("");
}

// ---------- Modal: campañas del día ----------

function abrirModalDiaCM(iso) {
  fechaSeleccionadaCM = iso;
  const fecha = new Date(iso + "T00:00:00");
  document.getElementById("modal-dia-titulo").textContent = fecha.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  pintarListaCampanasDia();
  document.getElementById("modal-dia-overlay").classList.add("show");
}

function cerrarModalDiaCM() {
  document.getElementById("modal-dia-overlay").classList.remove("show");
  fechaSeleccionadaCM = null;
}

function pintarListaCampanasDia() {
  const cont = document.getElementById("lista-campanas-dia");
  const activas = campanasActivasEnDia(fechaSeleccionadaCM);

  if (activas.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px; padding:16px 0;">No hay campañas activas este día.</p>`;
    return;
  }

  cont.innerHTML = activas
    .map(
      (c) => `
        <div class="dash-mini-row">
          <div>
            <div class="dash-mini-titulo">${escaparHtmlCalCM(c.nombre)}</div>
            <div class="dash-mini-meta">${c.objetivo ? escaparHtmlCalCM(c.objetivo) : ""}</div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
            <span class="plataforma-badge ${c.plataforma || "Otro"}">${escaparHtmlCalCM(c.plataforma || "Otro")}</span>
            <span class="estado-campana-badge ${c.estado || "Planificada"}">${escaparHtmlCalCM(c.estado || "Planificada")}</span>
          </div>
        </div>
      `
    )
    .join("");
}

function escaparHtmlCalCM(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// ---------- Toast ----------

let toastTimerCalCM;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerCalCM);
  toastTimerCalCM = setTimeout(() => t.classList.remove("show"), 3200);
}
