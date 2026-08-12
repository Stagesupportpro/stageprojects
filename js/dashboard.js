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

  await pintarStats(usuarioActualDash.rol);
  pintarPanelesPorRol(usuarioActualDash.rol);
  escucharNotificaciones();
  escucharEvaluaciones();
})();

// ---------- Estadísticas reales ----------

async function contarColeccion(nombre, filtro) {
  try {
    let ref = db.collection(nombre);
    if (filtro) ref = filtro(ref);
    const snap = await ref.get();
    return snap.size;
  } catch (err) {
    console.error(`No se pudo contar ${nombre}:`, err);
    return "—";
  }
}

async function proximoEvento() {
  try {
    const hoyISO = fechaISODash(new Date());
    const snap = await db.collection("documentos").where("fecha", ">=", hoyISO).orderBy("fecha", "asc").limit(1).get();
    if (snap.empty) return "—";
    const d = snap.docs[0].data();
    return new Date(d.fecha + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  } catch (err) {
    console.error(err);
    return "—";
  }
}

function fechaISODash(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function pintarStats(rol) {
  const cont = document.getElementById("stat-grid");
  cont.innerHTML = `<div class="stat-card"><div class="stat-accent"></div><div class="stat-label">Cargando…</div><div class="stat-value">—</div></div>`;

  let stats = [];

  if (rol === "Comercial") {
    const [bookings, clientes, propuestas] = await Promise.all([
      contarColeccion("bookings"),
      contarColeccion("clientes"),
      contarColeccion("propuestas"),
    ]);
    stats = [
      { label: "Bookings", valor: bookings },
      { label: "Clientes en cartera", valor: clientes },
      { label: "Propuestas creadas", valor: propuestas },
    ];
  } else if (rol === "Producción") {
    const [producciones, hojasRuta, proximo] = await Promise.all([
      contarColeccion("producciones"),
      contarColeccion("hojasDeRuta"),
      proximoEvento(),
    ]);
    stats = [
      { label: "Producciones", valor: producciones },
      { label: "Hojas de ruta", valor: hojasRuta },
      { label: "Próximo evento", valor: proximo },
    ];
  } else if (rol === "Admin") {
    const [usuariosActivos, bookings, producciones] = await Promise.all([
      contarColeccion("usuarios", (ref) => ref.where("activo", "==", true)),
      contarColeccion("bookings"),
      contarColeccion("producciones"),
    ]);
    stats = [
      { label: "Usuarios activos", valor: usuariosActivos },
      { label: "Bookings", valor: bookings },
      { label: "Producciones", valor: producciones },
    ];
  }

  cont.innerHTML = stats
    .map(
      (s) => `
        <div class="stat-card">
          <div class="stat-accent"></div>
          <div class="stat-label">${s.label}</div>
          <div class="stat-value">${s.valor}</div>
        </div>
      `
    )
    .join("");
}

function pintarPanelesPorRol(rol) {
  const cont = document.getElementById("role-panels");

  const enlaces = {
    Comercial: [
      { label: "Ver Bookings", href: "bookings.html" },
      { label: "Preparar una propuesta", href: "propuestas.html" },
      { label: "Ver Catálogo", href: "catalogo.html" },
    ],
    "Producción": [
      { label: "Ver Producciones", href: "producciones.html" },
      { label: "Ver Hojas de Ruta", href: "hojasderuta.html" },
    ],
    Admin: [
      { label: "Gestionar usuarios", href: "usuarios.html" },
      { label: "Ver Roles y permisos", href: "roles.html" },
    ],
  };

  const items = enlaces[rol] || [];
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
        <div class="notif-row ${n.leida ? "leida" : ""}" onclick="abrirNotificacion('${n.id}', '${escaparAttrDash(n.enlace || "")}')">
          <div class="notif-dot"></div>
          <div>
            <div class="notif-msg"><strong>${escaparHtmlDash(n.deNombre || "Alguien")}</strong> ${escaparHtmlDash(n.mensaje || "")}</div>
            <div class="notif-meta">${fecha}</div>
          </div>
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

// ---------- Evaluaciones de propuestas ----------

function escucharEvaluaciones() {
  if (usuarioActualDash.rol !== "Admin") return; // decisión de evaluar es cosa de Admin

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
