// =========================================================
// STAGE SUPPORT — calendario-roster.js
// Módulo compartido de disponibilidad del Roster. Lo usan Bookings,
// Producciones y Roster para leer/escribir en una única fuente:
// la colección /calendarioArtistas/{id}.
//
// Cada documento: { rosterId, rosterNombre, fecha, ciudad, estado
//   ('pendiente'|'aceptado'|'rechazado'), origen ('booking'|
//   'produccion'|'manual'), origenRefId, origenId, origenIdVisible,
//   notas, creadoEl }
//
// El ID de documento para entradas de booking/producción es
// determinista (`${origen}_${refId}_${rosterId}`), así que volver a
// guardar el mismo booking nunca duplica — solo actualiza o borra lo
// que ya no corresponda (p.ej. si se quita un artista).
// =========================================================

const ETIQUETAS_ESTADO_CAL = { pendiente: "Pendiente Confirmación", aceptado: "Aceptado", rechazado: "Rechazado" };

/**
 * Sincroniza las entradas de calendario de uno o varios artistas para
 * un origen (booking o producción) concreto. Borra las que ya no
 * correspondan (artista quitado) y crea/actualiza el resto.
 */
async function sincronizarCalendarioArtistas({ origen, refId, refIdVisible, artistas, fecha, ciudad, estado }) {
  const origenRefId = `${origen}_${refId}`;
  const artistasValidos = (artistas || []).filter((a) => a.rosterId);

  try {
    const snapExistentes = await db.collection("calendarioArtistas").where("origenRefId", "==", origenRefId).get();
    const idsActuales = new Set(artistasValidos.map((a) => `${origenRefId}_${a.rosterId}`));
    const batch = db.batch();

    snapExistentes.forEach((doc) => {
      if (!idsActuales.has(doc.id)) batch.delete(doc.ref);
    });

    artistasValidos.forEach((a) => {
      const ref = db.collection("calendarioArtistas").doc(`${origenRefId}_${a.rosterId}`);
      batch.set(ref, {
        rosterId: a.rosterId,
        rosterNombre: a.nombre || "",
        fecha: a.fecha || fecha || "",
        ciudad: ciudad || "",
        estado: estado || "pendiente",
        origen,
        origenRefId,
        origenId: refId,
        origenIdVisible: refIdVisible || "",
        creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
  } catch (err) {
    console.error("No se pudo sincronizar el calendario de disponibilidad:", err);
  }
}

/**
 * Borra todas las entradas de calendario de un origen (al eliminar
 * un booking o producción, por ejemplo).
 */
async function eliminarCalendarioArtistasDeOrigen(origen, refId) {
  const origenRefId = `${origen}_${refId}`;
  try {
    const snap = await db.collection("calendarioArtistas").where("origenRefId", "==", origenRefId).get();
    const batch = db.batch();
    snap.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  } catch (err) {
    console.error("No se pudo limpiar el calendario de disponibilidad:", err);
  }
}

/**
 * Busca conflictos: otras entradas (pendiente o aceptado) del mismo
 * artista en la misma fecha, distintas del origen que se está
 * editando ahora mismo (para no chocar contigo mismo al reeditar).
 * Consulta solo por rosterId (una condición) y filtra la fecha en el
 * propio navegador, para no depender de ningún índice compuesto.
 */
async function comprobarConflictosArtista(rosterId, fecha, origenRefIdExcluir) {
  if (!rosterId || !fecha) return [];
  try {
    const snap = await db.collection("calendarioArtistas").where("rosterId", "==", rosterId).get();
    const conflictos = [];
    snap.forEach((doc) => {
      const d = doc.data();
      if (d.fecha !== fecha) return;
      if (d.estado === "rechazado") return;
      if (origenRefIdExcluir && d.origenRefId === origenRefIdExcluir) return;
      conflictos.push(d);
    });
    return conflictos;
  } catch (err) {
    console.error("No se pudo comprobar la disponibilidad:", err);
    return [];
  }
}

/**
 * Comprueba varios artistas de golpe (para un booking con varios) y,
 * si hay algún conflicto, muestra el modal de aviso. Devuelve true si
 * hay que dejar seguir igualmente (el usuario decide seguir a pesar
 * del aviso), o false si prefiere revisarlo — nunca bloquea del todo,
 * solo avisa con claridad.
 */
async function comprobarYAvisarConflictos(artistas, fecha, origenRefIdExcluir) {
  const artistasValidos = (artistas || []).filter((a) => a.rosterId);
  const resultados = await Promise.all(artistasValidos.map((a) => comprobarConflictosArtista(a.rosterId, a.fecha || fecha, origenRefIdExcluir)));

  const avisos = [];
  artistasValidos.forEach((a, i) => {
    if (resultados[i].length > 0) avisos.push({ artista: a, fecha: a.fecha || fecha, conflictos: resultados[i] });
  });

  if (avisos.length === 0) return true;

  return mostrarModalConflictoArtista(avisos);
}

/**
 * Modal dinámico (no necesita HTML propio en cada página) que avisa
 * de que uno o varios artistas ya tienen algo pendiente/aceptado ese
 * día, y en qué booking/producción está cada conflicto. Devuelve una
 * Promise<boolean> — true si el usuario decide continuar igualmente.
 */
function mostrarModalConflictoArtista(avisos) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay show";
    overlay.style.zIndex = "9999";

    const filasHtml = avisos
      .map((av) => {
        const fechaTexto = av.fecha ? new Date(av.fecha + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) : "";
        return `
          <div class="conflicto-artista-bloque">
            <div class="conflicto-artista-nombre">⚠️ ${escaparHtmlCalRoster(av.artista.nombre)}${fechaTexto ? ` — ${fechaTexto}` : ""}</div>
            ${av.conflictos
              .map(
                (c) => `
                  <div class="conflicto-artista-linea">
                    <span class="estado-pago-badge ${c.estado === "aceptado" ? "EF" : "pendiente"}">${ETIQUETAS_ESTADO_CAL[c.estado] || c.estado}</span>
                    en <strong>${escaparHtmlCalRoster(c.origenIdVisible || "otro registro")}</strong>
                    ${c.ciudad ? `— ${escaparHtmlCalRoster(c.ciudad)}` : ""}
                  </div>
                `
              )
              .join("")}
          </div>
        `;
      })
      .join("");

    overlay.innerHTML = `
      <div class="modal" style="max-width:460px;">
        <h2>Artista ocupado</h2>
        <p class="modal-sub">Revisa antes de seguir:</p>
        <div style="margin: 10px 0 18px;">${filasHtml}</div>
        <div class="modal-actions">
          <button type="button" class="btn-ghost" id="conflicto-cancelar">Revisar antes de seguir</button>
          <button type="button" class="btn-accent" id="conflicto-continuar">Continuar igualmente</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector("#conflicto-cancelar").onclick = () => {
      overlay.remove();
      resolve(false);
    };
    overlay.querySelector("#conflicto-continuar").onclick = () => {
      overlay.remove();
      resolve(true);
    };
  });
}

/**
 * El calendario anual va en A4 vertical, con los 6+6 meses ajustados
 * a un ancho fijo (ver .cal-anual-page en el CSS) para que quepan
 * siempre en una sola hoja, sin depender del ancho de la ventana del
 * navegador en cada momento — una hoja de estilo temporal, quitada
 * justo después de imprimir, sin tocar el resto de impresiones de
 * la plataforma.
 */
function imprimirCalendarioVertical() {
  const estilo = document.createElement("style");
  estilo.id = "estilo-print-vertical-temporal";
  estilo.textContent = "@page { size: A4 portrait; margin: 8mm; }";
  document.head.appendChild(estilo);
  setTimeout(() => {
    window.print();
    setTimeout(() => estilo.remove(), 500);
  }, 50);
}

function escaparHtmlCalRoster(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// =========================================================
// Calendario anual imprimible — mismo formato que la referencia en
// papel: 12 meses en cuadrícula (6+6), un día por fila, coloreado
// según el estado, con el nombre de la ciudad (y del artista, en la
// vista general de varios artistas a la vez).
// =========================================================

const MESES_CAL_ROSTER = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/**
 * @param {number} anio
 * @param {Object} entradasPorFecha - { 'YYYY-MM-DD': [{ciudad, estado, rosterNombre}, ...] }
 * @param {string} tituloDoc
 * @param {string|null} logoStageSupport - logoDocumentos de la empresa
 * @param {string|null} logoArtista - cartel/logo del artista (si se imprime para uno solo)
 */
function construirCalendarioAnualHtml(anio, entradasPorFecha, tituloDoc, logoStageSupport, logoArtista) {
  function construirMes(mesIndex) {
    const diasEnMes = new Date(anio, mesIndex + 1, 0).getDate();
    let filas = "";
    for (let d = 1; d <= diasEnMes; d++) {
      const iso = `${anio}-${String(mesIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const diaSemana = new Date(anio, mesIndex, d).getDay(); // 0 = domingo, 6 = sábado
      const esFinde = diaSemana === 0 || diaSemana === 6;
      const entradas = entradasPorFecha[iso] || [];

      let claseFila = "";
      let claseDia = esFinde ? "cal-anual-finde" : "";
      let texto = "";
      if (entradas.length > 0) {
        const hayAceptado = entradas.some((e) => e.estado === "aceptado");
        claseFila = hayAceptado ? "cal-anual-verde" : "cal-anual-ambar";
        claseDia = ""; // el evento manda sobre la marca de fin de semana
        texto = entradas.map((e) => [e.ciudad, e.rosterNombre].filter(Boolean).join(" - ")).join(" · ");
      }
      filas += `<tr class="${claseFila}"><td class="cal-anual-dia ${claseDia}">${d}</td><td class="cal-anual-texto">${escaparHtmlCalRoster(texto)}</td></tr>`;
    }
    return `
      <table class="cal-anual-mes">
        <thead><tr><th colspan="2">${MESES_CAL_ROSTER[mesIndex]}</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    `;
  }

  const fila1 = [0, 1, 2, 3, 4, 5].map(construirMes).join("");
  const fila2 = [6, 7, 8, 9, 10, 11].map(construirMes).join("");
  const ahora = new Date().toLocaleString("es-ES");

  return `
    <div class="doc-page cal-anual-page">
      <div class="doc-header">
        <img class="doc-logo" src="${logoStageSupport || "assets/logo_stagesupport.png"}" onerror="this.style.display='none'" />
        ${logoArtista ? `<img class="doc-logo-evento" src="${logoArtista}" />` : ""}
      </div>
      <div class="doc-title-block">
        <h1>${escaparHtmlCalRoster(tituloDoc)}</h1>
        <div class="doc-id-text">Impreso: ${ahora}</div>
      </div>
      <div class="cal-anual-grid-fila">${fila1}</div>
      <div class="cal-anual-grid-fila">${fila2}</div>
      <div class="doc-footer-note">Generado por Stage Support - ${ahora}</div>
    </div>
  `;
}
