// =========================================================
// STAGE SUPPORT — backup.js
// Reinicio de contadores de numeración (Admin) y exportación
// completa de todas las colecciones a un archivo JSON descargable.
// =========================================================

const ETIQUETAS_PREFIJO = {
  PRO: "Producciones",
  HR: "Hojas de Ruta",
  PROV: "Propuestas",
  BO: "Bookings",
  PR: "Presupuestos",
  R: "Registro de Servicios",
};

// Todas las colecciones que existen en la plataforma — si añades una
// nueva más adelante, añádela también aquí para que entre en el backup.
const COLECCIONES_BACKUP = [
  "usuarios",
  "documentos",
  "roster",
  "rosterJuridico",
  "propuestas",
  "clientes",
  "venues",
  "notificaciones",
  "agenda",
  "notas",
  "bookings",
  "producciones",
  "hojasDeRuta",
  "personal",
  "contadores",
  "roles",
  "comisiones",
  "configuracion",
  "evaluaciones",
  "contratosConfig",
  "campanas",
  "tiposServicio",
  "registroServicios",
];

let usuarioActualBackup = null;

(async function () {
  usuarioActualBackup = await protegerPagina(["Admin"]);
  pintarNav(usuarioActualBackup.rol, "backup");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualBackup) || usuarioActualBackup.email;
  document.getElementById("pass-role").textContent = usuarioActualBackup.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualBackup.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualBackup.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualBackup) || usuarioActualBackup.email);
  }

  await cargarContadores();
})();

function anioActual2() {
  return String(new Date().getFullYear()).slice(-2);
}

async function cargarContadores() {
  const cont = document.getElementById("lista-contadores");
  const prefijos = Object.values(PREFIJOS_ID); // ["PRO","HR","PROV","BO","PR"]
  const anio2 = anioActual2();

  try {
    const filas = await Promise.all(
      prefijos.map(async (prefijo) => {
        const id = `${prefijo}${anio2}`;
        const snap = await db.collection("contadores").doc(id).get();
        const ultimo = snap.exists ? snap.data().ultimo || 0 : 0;
        return { prefijo, id, ultimo };
      })
    );

    cont.innerHTML = filas
      .map(
        (f) => `
          <div class="contador-card">
            <div class="contador-info">
              <span class="id-badge">${f.prefijo}${anio2}</span>
              <div>
                <div class="contador-valor">${String(f.ultimo).padStart(4, "0")}</div>
                <div class="contador-label">${ETIQUETAS_PREFIJO[f.prefijo] || f.prefijo} — último número usado este año</div>
              </div>
            </div>
            <button class="btn-ghost" onclick="reiniciarContador('${f.id}', '${ETIQUETAS_PREFIJO[f.prefijo] || f.prefijo}')">Reiniciar contador ${f.prefijo}</button>
          </div>
        `
      )
      .join("");
  } catch (err) {
    console.error(err);
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">No se pudieron cargar los contadores.</p>`;
  }
}

// ---------- Limpieza de entradas huérfanas del Calendario general ----------
// Cubre las entradas creadas por Bookings/Producciones/Hojas de Ruta ANTES
// de que se guardara el ID de vuelta (documentoCalendarioId) — a partir de
// ahora, borrar el registro original ya limpia su marca en el calendario
// solo, así que esto es una limpieza puntual, no algo que haya que repetir.
async function limpiarEntradasHuerfanasCalendario() {
  const btn = document.getElementById("btn-limpiar-cal");
  const resultado = document.getElementById("resultado-limpieza-cal");
  btn.disabled = true;
  resultado.textContent = "Revisando…";

  const PREFIJOS_ORIGEN = [
    { prefijo: "Booking ", coleccion: "bookings" },
    { prefijo: "Producción ", coleccion: "producciones" },
    { prefijo: "Hoja de ruta ", coleccion: "hojasDeRuta" },
  ];

  try {
    const snap = await db.collection("documentos").get();
    let borradas = 0;
    let revisadas = 0;

    for (const doc of snap.docs) {
      const notas = doc.data().notas || "";
      const origen = PREFIJOS_ORIGEN.find((p) => notas.startsWith(p.prefijo));
      if (!origen) continue;

      revisadas++;
      const idVisibleBuscado = notas.slice(origen.prefijo.length).trim();
      if (!idVisibleBuscado) continue;

      const snapOrigen = await db.collection(origen.coleccion).where("idVisible", "==", idVisibleBuscado).limit(1).get();
      if (snapOrigen.empty) {
        await db.collection("documentos").doc(doc.id).delete();
        borradas++;
      }
    }

    resultado.textContent = `Revisadas ${revisadas} entradas relacionadas con Bookings/Producciones/Hojas de Ruta — ${borradas} estaban huérfanas y se han borrado.`;
    mostrarToast(borradas > 0 ? `${borradas} entrada(s) huérfana(s) borradas.` : "No había ninguna entrada huérfana.");
  } catch (err) {
    console.error(err);
    resultado.textContent = `No se pudo completar la limpieza: ${err.code || ""} ${err.message || err}`.trim();
  } finally {
    btn.disabled = false;
  }
}

async function reiniciarContador(id, etiqueta) {
  const confirmado = confirm(
    `¿Reiniciar el contador de ${etiqueta} (${id}) a 0000?\n\nEl próximo ${id.replace(/\d\d$/, "")} que se cree empezará otra vez en 0001. Solo hazlo si estás seguro de que no hay IDs ya usados que se puedan repetir.`
  );
  if (!confirmado) return;

  try {
    await db.collection("contadores").doc(id).set({ ultimo: 0 }, { merge: true });
    mostrarToast(`Contador ${id} reiniciado.`);
    await cargarContadores();
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo reiniciar el contador.");
  }
}

// ---------- Backup completo ----------

function fechaISOBackup(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function descargarBackup() {
  const btn = document.getElementById("btn-backup");
  btn.disabled = true;
  btn.textContent = "Preparando backup…";

  const resultado = {
    generadoEl: new Date().toISOString(),
    generadoPor: nombreCompletoDe(usuarioActualBackup) || usuarioActualBackup.email,
    colecciones: {},
  };

  try {
    for (const col of COLECCIONES_BACKUP) {
      try {
        const snap = await db.collection(col).get();
        resultado.colecciones[col] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.error(`No se pudo leer ${col}:`, err);
        resultado.colecciones[col] = { error: String(err) };
      }
    }

    const json = JSON.stringify(
      resultado,
      (key, value) => {
        // Los Timestamp de Firestore no se serializan bien tal cual — se pasan a texto ISO.
        if (value && typeof value === "object" && typeof value.toDate === "function") {
          return value.toDate().toISOString();
        }
        return value;
      },
      2
    );

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stage-support-backup-${fechaISOBackup(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    mostrarToast("Backup descargado.");
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo generar el backup.");
  } finally {
    btn.disabled = false;
    btn.textContent = "⬇️ Descargar backup completo";
  }
}

// ---------- Restaurar backup ----------

let archivoBackupSeleccionado = null;

function alElegirArchivoBackup(event) {
  const archivo = event.target.files[0];
  archivoBackupSeleccionado = archivo || null;
  const estado = document.getElementById("backup-import-estado");
  const btn = document.getElementById("btn-importar-backup");

  if (archivo) {
    estado.textContent = `Archivo elegido: ${archivo.name} (${(archivo.size / 1024).toFixed(0)} KB)`;
    btn.disabled = false;
  } else {
    estado.textContent = "Ningún archivo seleccionado.";
    btn.disabled = true;
  }
}

async function importarBackup() {
  if (!archivoBackupSeleccionado) return;

  const confirmado = confirm(
    "Esto va a SOBRESCRIBIR en la base de datos cualquier documento cuyo ID coincida con uno del archivo. No borra nada que no esté en el archivo, pero los cambios sobrescritos no se pueden deshacer.\n\n¿Seguro que quieres continuar?"
  );
  if (!confirmado) return;

  const btn = document.getElementById("btn-importar-backup");
  btn.disabled = true;
  btn.textContent = "Restaurando…";

  try {
    const texto = await archivoBackupSeleccionado.text();
    const datos = JSON.parse(texto);
    const colecciones = datos.colecciones || {};

    let totalDocs = 0;
    for (const [nombreCol, docs] of Object.entries(colecciones)) {
      if (!Array.isArray(docs)) continue; // p.ej. colecciones que fallaron al exportar ({error: ...})

      for (let i = 0; i < docs.length; i += 400) {
        const lote = docs.slice(i, i + 400);
        const batch = db.batch();
        lote.forEach((doc) => {
          const { id, ...campos } = doc;
          if (!id) return;
          batch.set(db.collection(nombreCol).doc(id), campos);
        });
        await batch.commit();
        totalDocs += lote.length;
      }
    }

    mostrarToast(`Backup restaurado: ${totalDocs} documentos.`);
    await cargarContadores();
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo importar el backup. Comprueba que el archivo es válido.");
  } finally {
    btn.disabled = false;
    btn.textContent = "⬆️ Restaurar backup";
    archivoBackupSeleccionado = null;
    document.getElementById("backup-import-input").value = "";
    document.getElementById("backup-import-estado").textContent = "Ningún archivo seleccionado.";
  }
}

// ---------- Toast ----------

let toastTimerBackup;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerBackup);
  toastTimerBackup = setTimeout(() => t.classList.remove("show"), 3200);
}
