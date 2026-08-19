// =========================================================
// STAGE SUPPORT — dashboard.js
// Estadísticas reales por rol + panel de notificaciones.
// =========================================================

let usuarioActualDash = null;

(async function () {
  usuarioActualDash = await protegerPagina();

  pintarNav(usuarioActualDash.rol, "dashboard");

  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualDash) || usuarioActualDash.email;
  document.getElementById("pass-role").textContent = usuarioActualDash.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualDash.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualDash.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualDash) || usuarioActualDash.email);
  }
  document.getElementById("saludo").textContent = "Hola, " + (usuarioActualDash.nombre ? usuarioActualDash.nombre.split(" ")[0] : usuarioActualDash.email);
  document.getElementById("fecha-hoy").textContent = new Date().toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long",
  });

  escucharStats(usuarioActualDash.rol);
  pintarPanelesPorRol(usuarioActualDash.rol);
  escucharNotificaciones();
  escucharEvaluaciones();
  escucharActivoAhora();
  escucharPropuestasPendientes();
  escucharProximasCitas();
})();

// ---------- Estadísticas reales ----------

function escucharConteoColeccion(nombre, filtro, indice) {
  let ref = db.collection(nombre);
  if (filtro) ref = filtro(ref);
  ref.onSnapshot(
    (snap) => {
      const el = document.getElementById(`stat-valor-${indice}`);
      if (el) el.textContent = snap.size;
    },
    (err) => console.error(`No se pudo escuchar ${nombre}:`, err)
  );
}

function escucharProximoEvento(indice) {
  const hoyISO = fechaISODash(new Date());
  db.collection("documentos")
    .where("fecha", ">=", hoyISO)
    .orderBy("fecha", "asc")
    .limit(1)
    .onSnapshot(
      (snap) => {
        const el = document.getElementById(`stat-valor-${indice}`);
        if (!el) return;
        if (snap.empty) {
          el.textContent = "—";
          return;
        }
        const d = snap.docs[0].data();
        el.textContent = new Date(d.fecha + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" });
      },
      (err) => console.error(err)
    );
}

function fechaISODash(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Catálogo de posibles tarjetas — se muestran las que encajen con los
// permisos reales del rol (hasta 3), en este orden de prioridad. Así
// funciona igual de bien con roles personalizados que con los 3
// originales, sin tener que tocar código cada vez que se crea un rol.
const CATALOGO_STATS_DASH = [
  { permiso: "usuarios", label: "Usuarios activos", coleccion: "usuarios", filtro: (ref) => ref.where("activo", "==", true) },
  { permiso: "bookings", label: "Bookings", coleccion: "bookings" },
  { permiso: "producciones", label: "Producciones", coleccion: "producciones" },
  { permiso: "hojasderuta", label: "Hojas de ruta", coleccion: "hojasDeRuta" },
  { permiso: "clientes", label: "Clientes en cartera", coleccion: "clientes" },
  { permiso: "propuestas", label: "Propuestas creadas", coleccion: "propuestas" },
  { permiso: "roster", label: "Espectáculos en Roster", coleccion: "roster" },
  { permiso: "venues", label: "Venues dados de alta", coleccion: "venues" },
];

// A diferencia de la versión anterior (una sola lectura al cargar la
// página), esto deja una escucha en vivo por cada tarjeta — si algo
// cambia mientras el Dashboard está abierto, el número se actualiza
// solo, sin tener que recargar la página.
function escucharStats(rol) {
  const cont = document.getElementById("stat-grid");
  const permisos = permisosActuales || {};
  const seleccionadas = CATALOGO_STATS_DASH.filter((s) => permisos[s.permiso]).slice(0, 3);

  const hayHuecoParaEvento = seleccionadas.length < 3 && permisos.calendario;
  if (hayHuecoParaEvento) {
    seleccionadas.push({ label: "Próximo evento", especial: "proximoEvento" });
  }

  if (seleccionadas.length === 0) {
    cont.innerHTML = `<div class="empty-state"><strong>Sin indicadores configurados</strong>Tu rol todavía no tiene acceso a ninguna sección con estadísticas.</div>`;
    return;
  }

  cont.innerHTML = seleccionadas
    .map(
      (s, i) => `
        <div class="stat-card">
          <div class="stat-accent"></div>
          <div class="stat-label">${s.label}</div>
          <div class="stat-value" id="stat-valor-${i}">—</div>
        </div>
      `
    )
    .join("");

  seleccionadas.forEach((s, i) => {
    if (s.especial === "proximoEvento") {
      escucharProximoEvento(i);
    } else {
      escucharConteoColeccion(s.coleccion, s.filtro, i);
    }
  });
}

// Catálogo de posibles accesos directos — se muestran los que
// encajen con los permisos reales del rol (hasta 4).
const CATALOGO_ENLACES_DASH = [
  { permiso: "bookings", label: "Ver Bookings", href: "bookings.html" },
  { permiso: "propuestas", label: "Preparar una propuesta", href: "propuestas.html" },
  { permiso: "catalogo", label: "Ver Catálogo", href: "catalogo.html" },
  { permiso: "producciones", label: "Ver Producciones", href: "producciones.html" },
  { permiso: "hojasderuta", label: "Ver Hojas de Ruta", href: "hojasderuta.html" },
  { permiso: "usuarios", label: "Gestionar usuarios", href: "usuarios.html" },
  { permiso: "roles", label: "Ver Roles y permisos", href: "roles.html" },
  { permiso: "roster", label: "Abrir el Roster", href: "roster.html" },
  { permiso: "venues", label: "Ver Venues", href: "venues.html" },
  { permiso: "clientes", label: "Ver Clientes", href: "clientes.html" },
];

function pintarPanelesPorRol(rol) {
  const cont = document.getElementById("role-panels");
  const permisos = permisosActuales || {};
  const items = CATALOGO_ENLACES_DASH.filter((it) => permisos[it.permiso]).slice(0, 4);

  cont.innerHTML = items.length
    ? `<div class="stat-grid">${items
        .map((it) => `<a href="${it.href}" class="stat-card" style="text-decoration:none; display:flex; align-items:center; justify-content:center; text-align:center; color:var(--color-text); font-weight:700;">${it.label} →</a>`)
        .join("")}</div>`
    : `<div class="empty-state"><strong>Todo al día</strong>No hay accesos directos configurados para tu rol todavía.</div>`;
}

// ---------- Notificaciones ----------

function escucharNotificaciones() {
  db.collection("notificaciones")
    .where("paraUid", "==", usuarioActualDash.uid)
    .limit(20)
    .onSnapshot(
      (snap) => {
        const filas = [];
        snap.forEach((doc) => filas.push({ id: doc.id, ...doc.data() }));
        filas.sort((a, b) => {
          const fa = a.creadoEl && a.creadoEl.toMillis ? a.creadoEl.toMillis() : 0;
          const fb = b.creadoEl && b.creadoEl.toMillis ? b.creadoEl.toMillis() : 0;
          return fb - fa;
        });
        pintarNotificaciones(filas);
      },
      (err) => console.error("No se pudieron cargar las notificaciones:", err)
    );
}

function pintarNotificaciones(notifs) {
  const card = document.getElementById("card-notificaciones");
  const cont = document.getElementById("lista-notificaciones");

  if (notifs.length === 0) {
    card.style.display = "none";
    return;
  }
  card.style.display = "block";

  cont.innerHTML = notifs
    .map((n) => {
      const fecha = n.creadoEl && n.creadoEl.toDate ? n.creadoEl.toDate().toLocaleString("es-ES") : "";
      return `
        <div class="notif-row ${n.leida ? "leida" : ""}">
          <div class="notif-dot"></div>
          <div style="flex:1; cursor:pointer;" onclick="abrirNotificacion('${n.id}', '${escaparAttrDash(n.enlace || "")}')">
            <div class="notif-msg"><strong>${escaparHtmlDash(n.deNombre || "Alguien")}</strong> ${escaparHtmlDash(n.mensaje || "")}</div>
            <div class="notif-meta">${fecha}</div>
          </div>
          <button class="icon-btn" title="Eliminar" onclick="event.stopPropagation(); eliminarNotificacion('${n.id}')">✕</button>
        </div>
      `;
    })
    .join("");
}

function escaparHtmlDash(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function escaparAttrDash(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/'/g, "&#39;");
}

async function abrirNotificacion(id, enlace) {
  try {
    await db.collection("notificaciones").doc(id).update({ leida: true });
  } catch (err) {
    console.error(err);
  }
  if (enlace) window.location.href = enlace;
}

async function marcarTodasLeidas() {
  try {
    const snap = await db.collection("notificaciones").where("paraUid", "==", usuarioActualDash.uid).where("leida", "==", false).get();
    const batch = db.batch();
    snap.forEach((doc) => batch.update(doc.ref, { leida: true }));
    await batch.commit();
  } catch (err) {
    console.error(err);
  }
}

async function eliminarNotificacion(id) {
  try {
    await db.collection("notificaciones").doc(id).delete();
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo eliminar la notificación.");
  }
}

async function eliminarTodasNotificaciones() {
  if (!confirm("¿Eliminar todas tus notificaciones? No se puede deshacer.")) return;
  try {
    const snap = await db.collection("notificaciones").where("paraUid", "==", usuarioActualDash.uid).get();
    const batch = db.batch();
    snap.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudieron eliminar las notificaciones.");
  }
}

// ---------- Activo ahora (Calendario, próximos 14 días) ----------

function escucharActivoAhora() {
  const permisos = permisosActuales || {};
  if (!permisos.calendario) return;

  const hoy = new Date();
  const en14dias = new Date();
  en14dias.setDate(hoy.getDate() + 14);

  db.collection("documentos")
    .where("fecha", ">=", fechaISODash(hoy))
    .where("fecha", "<=", fechaISODash(en14dias))
    .onSnapshot(
      (snap) => {
        const filas = [];
        snap.forEach((doc) => filas.push({ id: doc.id, ...doc.data() }));
        filas.sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
        pintarActivoAhora(filas);
      },
      (err) => console.error("No se pudo escuchar el calendario:", err)
    );
}

function pintarActivoAhora(filas) {
  const card = document.getElementById("card-activo");
  const cont = document.getElementById("lista-activo");

  if (filas.length === 0) {
    card.style.display = "none";
    return;
  }
  card.style.display = "block";

  cont.innerHTML = filas
    .slice(0, 8)
    .map((d) => {
      const fecha = d.fecha ? new Date(d.fecha + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "";
      return `
        <div class="dash-mini-row">
          <div>
            <div class="dash-mini-titulo">${escaparHtmlDash(d.titulo || "Sin título")}</div>
            <div class="dash-mini-meta">${escaparHtmlDash(d.tipo || "")}</div>
          </div>
          <div class="dash-mini-fecha">${fecha}</div>
        </div>
      `;
    })
    .join("");
}

// ---------- Propuestas pendientes ----------

function escucharPropuestasPendientes() {
  const permisos = permisosActuales || {};
  if (!permisos.propuestas) return;

  db.collection("propuestas")
    .where("estado", "in", ["Borrador", "Enviada"])
    .onSnapshot(
      (snap) => {
        const filas = [];
        snap.forEach((doc) => filas.push({ id: doc.id, ...doc.data() }));
        filas.sort((a, b) => {
          const fa = a.creadoEl && a.creadoEl.toMillis ? a.creadoEl.toMillis() : 0;
          const fb = b.creadoEl && b.creadoEl.toMillis ? b.creadoEl.toMillis() : 0;
          return fb - fa;
        });
        pintarPropuestasPendientes(filas);
      },
      (err) => console.error("No se pudieron escuchar las propuestas:", err)
    );
}

function pintarPropuestasPendientes(filas) {
  const card = document.getElementById("card-propuestas-pendientes");
  const cont = document.getElementById("lista-propuestas-pendientes");

  if (filas.length === 0) {
    card.style.display = "none";
    return;
  }
  card.style.display = "block";

  cont.innerHTML = filas
    .slice(0, 8)
    .map(
      (p) => `
        <div class="dash-mini-row" style="cursor:pointer;" onclick="window.location.href='propuesta-detalle.html?id=${p.id}'">
          <div>
            <div class="dash-mini-titulo">${escaparHtmlDash(p.nombre)}</div>
            <div class="dash-mini-meta">${escaparHtmlDash(p.clienteNombre || "Sin cliente")}</div>
          </div>
          <div class="dash-mini-fecha">${escaparHtmlDash(p.estado || "Borrador")}</div>
        </div>
      `
    )
    .join("");
}

// ---------- Próximas citas (Agenda propia + compartida, 14 días) ----------

let citasPropiasDash = [];
let citasCompartidasDash = [];

function escucharProximasCitas() {
  const permisos = permisosActuales || {};
  if (!permisos.agenda) return;

  const hoyISO = fechaISODash(new Date());
  const en14dias = new Date();
  en14dias.setDate(new Date().getDate() + 14);
  const en14ISO = fechaISODash(en14dias);

  db.collection("agenda")
    .where("propietarioUid", "==", usuarioActualDash.uid)
    .onSnapshot(
      (snap) => {
        citasPropiasDash = [];
        snap.forEach((doc) => citasPropiasDash.push({ id: doc.id, ...doc.data() }));
        pintarProximasCitas(hoyISO, en14ISO);
      },
      (err) => console.error(err)
    );

  db.collection("agenda")
    .where("compartidoCon", "array-contains", usuarioActualDash.uid)
    .onSnapshot(
      (snap) => {
        citasCompartidasDash = [];
        snap.forEach((doc) => citasCompartidasDash.push({ id: doc.id, ...doc.data() }));
        pintarProximasCitas(hoyISO, en14ISO);
      },
      (err) => console.error(err)
    );
}

function pintarProximasCitas(hoyISO, en14ISO) {
  const card = document.getElementById("card-proximas-citas");
  const cont = document.getElementById("lista-proximas-citas");

  const todas = [...citasPropiasDash, ...citasCompartidasDash]
    .filter((c) => c.fecha && c.fecha >= hoyISO && c.fecha <= en14ISO)
    .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "") || (a.hora || "").localeCompare(b.hora || ""));

  if (todas.length === 0) {
    card.style.display = "none";
    return;
  }
  card.style.display = "block";

  cont.innerHTML = todas
    .slice(0, 8)
    .map((c) => {
      const fecha = new Date(c.fecha + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" });
      return `
        <div class="dash-mini-row" style="cursor:pointer;" onclick="window.location.href='agenda.html'">
          <div>
            <div class="dash-mini-titulo">${escaparHtmlDash(c.titulo)}</div>
            <div class="dash-mini-meta">${[c.hora, c.ubicacion].filter(Boolean).map(escaparHtmlDash).join(" · ")}</div>
          </div>
          <div class="dash-mini-fecha">${fecha}</div>
        </div>
      `;
    })
    .join("");
}

function escucharEvaluaciones() {
  // Ver y decidir evaluaciones es cosa de perfiles con acceso administrativo
  // (se usa el permiso de "usuarios" como indicador de ese nivel de confianza).
  if (!permisosActuales || !permisosActuales.usuarios) return;

  db.collection("evaluaciones")
    .where("estado", "==", "Pendiente")
    .onSnapshot(
      (snap) => {
        const filas = [];
        snap.forEach((doc) => filas.push({ id: doc.id, ...doc.data() }));
        filas.sort((a, b) => {
          const fa = a.solicitadoEl && a.solicitadoEl.toMillis ? a.solicitadoEl.toMillis() : 0;
          const fb = b.solicitadoEl && b.solicitadoEl.toMillis ? b.solicitadoEl.toMillis() : 0;
          return fb - fa;
        });
        pintarEvaluaciones(filas);
      },
      (err) => console.error("No se pudieron cargar las evaluaciones:", err)
    );
}

function pintarEvaluaciones(evaluaciones) {
  const card = document.getElementById("card-evaluaciones");
  const cont = document.getElementById("lista-evaluaciones");

  if (evaluaciones.length === 0) {
    card.style.display = "none";
    return;
  }
  card.style.display = "block";

  cont.innerHTML = evaluaciones
    .map((ev) => {
      const fecha = ev.solicitadoEl && ev.solicitadoEl.toDate ? ev.solicitadoEl.toDate().toLocaleDateString("es-ES") : "";
      return `
        <div class="evaluacion-row">
          <div class="evaluacion-info">
            <div class="evaluacion-titulo">${escaparHtmlDash(ev.propuestaNombre)} <span class="id-badge" style="margin-left:6px;">${escaparHtmlDash(ev.propuestaIdVisible || "")}</span></div>
            <div class="evaluacion-meta">${escaparHtmlDash(ev.clienteNombre || "—")} · Solicitado por ${escaparHtmlDash(ev.solicitadoPor || "—")}${fecha ? " · " + fecha : ""}</div>
          </div>
          <div class="evaluacion-acciones">
            <a class="btn-ghost" style="text-decoration:none; padding:7px 12px; font-size:12px;" href="${ev.enlace}" target="_blank">Ver</a>
            <button class="btn-ghost" style="padding:7px 12px; font-size:12px;" onclick="decidirEvaluacion('${ev.id}', 'Rechazada')">✕ Rechazar</button>
            <button class="btn-accent" style="padding:7px 12px; font-size:12px;" onclick="decidirEvaluacion('${ev.id}', 'Aceptada')">✓ Aceptar</button>
          </div>
        </div>
      `;
    })
    .join("");
}

async function decidirEvaluacion(id, decision) {
  if (!confirm(`¿Marcar esta propuesta como "${decision}"?`)) return;

  try {
    const snap = await db.collection("evaluaciones").doc(id).get();
    if (!snap.exists) return;
    const ev = snap.data();

    await db.collection("evaluaciones").doc(id).update({
      estado: decision,
      resueltoPor: nombreCompletoDe(usuarioActualDash) || usuarioActualDash.email,
      resueltoEl: firebase.firestore.FieldValue.serverTimestamp(),
    });

    if (ev.propuestaId) {
      await db.collection("propuestas").doc(ev.propuestaId).update({ estado: decision });
    }

    if (ev.solicitadoPorUid) {
      await crearNotificacion(
        ev.solicitadoPorUid,
        "sistema",
        `tu propuesta "${ev.propuestaNombre}" ha sido ${decision.toLowerCase()}`,
        ev.enlace || "ver-propuestas.html",
        usuarioActualDash
      );
    }

    mostrarToast(`Propuesta marcada como ${decision.toLowerCase()}.`);
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo registrar la decisión.");
  }
}

// ---------- Toast ----------
// (esta función ya se usaba en el archivo, pero nunca llegó a
// definirse — por eso no se veía confirmación al aceptar/rechazar
// una evaluación; ahora sí existe, con su elemento en dashboard.html.)

let toastTimerDash;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  if (!t) return;
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerDash);
  toastTimerDash = setTimeout(() => t.classList.remove("show"), 3200);
}
