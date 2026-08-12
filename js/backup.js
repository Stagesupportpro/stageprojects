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

// ---------- Toast ----------

let toastTimerBackup;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerBackup);
  toastTimerBackup = setTimeout(() => t.classList.remove("show"), 3200);
}
