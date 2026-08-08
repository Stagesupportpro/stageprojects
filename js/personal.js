// =========================================================
// STAGE SUPPORT — personal.js
// Bolsa de contactos externos (sin cuenta de acceso).
// Colección: /personal/{id} → { nombre, apellidos, telefono, email, rol, notas }
// El campo "rol" reutiliza los roles creados en Administración → Roles.
// =========================================================

(async function () {
  const perfil = await protegerPagina();
  pintarNav(perfil.rol, "personal");
  document.getElementById("pass-name").textContent = nombreCompletoDe(perfil) || perfil.email;
  document.getElementById("pass-role").textContent = perfil.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (perfil.foto) {
    avatarEl.innerHTML = `<img src="${perfil.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(perfil) || perfil.email);
  }

  await cargarOpcionesRol();
  escucharPersonal();
})();

// ---------- Roles disponibles (reutiliza Administración → Roles) ----------

async function cargarOpcionesRol() {
  const sel = document.getElementById("p-rol");
  try {
    const snap = await db.collection("roles").orderBy("nombre").get();
    if (snap.empty) {
      sel.innerHTML = `<option value="">Sin roles creados todavía</option>`;
      return;
    }
    sel.innerHTML = snap.docs.map((d) => `<option value="${d.data().nombre}">${d.data().nombre}</option>`).join("");
  } catch (err) {
    console.error(err);
    sel.innerHTML = `<option value="">No se pudieron cargar los roles</option>`;
  }
}

// ---------- Listado ----------

function escucharPersonal() {
  db.collection("personal").orderBy("nombre").onSnapshot(
    (snap) => {
      const filas = [];
      snap.forEach((doc) => filas.push({ id: doc.id, ...doc.data() }));
      pintarTablaPersonal(filas);
    },
    (err) => {
      console.error(err);
      mostrarToast("No se pudo cargar el listado de personal.");
    }
  );
}

function pintarTablaPersonal(personas) {
  const tbody = document.getElementById("tabla-personal");
  document.getElementById("contador-personal").textContent =
    personas.length + (personas.length === 1 ? " contacto" : " contactos");

  if (personas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:36px; color:var(--color-text-muted);">
      Todavía no hay contactos en la bolsa de personal.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = personas
    .map((p) => {
      const nombreCompleto = [p.nombre, p.apellidos].filter(Boolean).join(" ") || "—";
      const tarifaTexto = p.tarifa != null && p.tarifa !== "" ? `${Number(p.tarifa).toLocaleString("es-ES")} €` : "—";
      const situacionTexto = p.situacion === "autonomo" ? "Autónomo" : "Alta en SS";
      return `
        <tr>
          <td>
            <div class="avatar-chip">
              <span class="initials">${inicialesDe(nombreCompleto)}</span>
              <div>
                <div style="font-weight:600;">${escaparHtmlPersonal(nombreCompleto)}</div>
                <div style="color:var(--color-text-muted); font-size:12.5px;">${escaparHtmlPersonal(p.email || "")}</div>
              </div>
            </div>
          </td>
          <td>${escaparHtmlPersonal(p.telefono || "—")}</td>
          <td>${p.rol ? `<span class="role-badge">${escaparHtmlPersonal(p.rol)}</span>` : "—"}</td>
          <td>
            <div>${tarifaTexto}</div>
            <div style="color:var(--color-text-muted); font-size:12px;">${situacionTexto}</div>
          </td>
          <td>
            <div class="row-actions" style="justify-content:flex-end;">
              <button class="icon-btn" title="Editar" onclick='abrirModalEdicionPersonal(${JSON.stringify(p).replace(/'/g, "&#39;")})'>✎</button>
              <button class="icon-btn danger" title="Eliminar" onclick="confirmarEliminarPersonal('${p.id}', '${escaparHtmlPersonal(nombreCompleto).replace(/'/g, "\\'")}')">🗑</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function escaparHtmlPersonal(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// ---------- Modal ----------

function alCambiarSituacion() {
  const esAutonomo = document.getElementById("p-situacion").value === "autonomo";
  document.getElementById("campos-autonomo").style.display = esAutonomo ? "block" : "none";
}

const formPersonal = document.getElementById("form-personal");
const overlayPersonal = document.getElementById("modal-overlay");

function abrirModalPersonal() {
  formPersonal.reset();
  document.getElementById("personal-id-edicion").value = "";
  document.getElementById("modal-titulo").textContent = "Nuevo contacto";
  document.getElementById("btn-guardar").textContent = "Crear contacto";
  alCambiarSituacion();
  ocultarMsgModalPersonal();
  overlayPersonal.classList.add("show");
}

function abrirModalEdicionPersonal(p) {
  formPersonal.reset();
  document.getElementById("personal-id-edicion").value = p.id;
  document.getElementById("p-nombre").value = p.nombre || "";
  document.getElementById("p-apellidos").value = p.apellidos || "";
  document.getElementById("p-telefono").value = p.telefono || "";
  document.getElementById("p-email").value = p.email || "";
  document.getElementById("p-notas").value = p.notas || "";
  document.getElementById("p-tarifa").value = p.tarifa != null ? p.tarifa : "";
  document.getElementById("p-situacion").value = p.situacion || "ss";
  document.getElementById("p-retencion").value = p.retencion != null ? p.retencion : "";
  document.getElementById("p-iva").value = p.iva != null ? p.iva : "";
  if (p.rol) document.getElementById("p-rol").value = p.rol;
  alCambiarSituacion();
  document.getElementById("modal-titulo").textContent = "Editar contacto";
  document.getElementById("btn-guardar").textContent = "Guardar cambios";
  ocultarMsgModalPersonal();
  overlayPersonal.classList.add("show");
}

function cerrarModal() {
  overlayPersonal.classList.remove("show");
}

function ocultarMsgModalPersonal() {
  const m = document.getElementById("modal-msg");
  m.className = "form-msg";
  m.textContent = "";
}

function mostrarMsgModalPersonal(texto) {
  const m = document.getElementById("modal-msg");
  m.textContent = texto;
  m.className = "form-msg show error";
}

formPersonal.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("personal-id-edicion").value;
  const btn = document.getElementById("btn-guardar");
  btn.disabled = true;

  const situacion = document.getElementById("p-situacion").value;
  const tarifaValor = document.getElementById("p-tarifa").value;

  const datos = {
    nombre: document.getElementById("p-nombre").value.trim(),
    apellidos: document.getElementById("p-apellidos").value.trim(),
    telefono: document.getElementById("p-telefono").value.trim(),
    email: document.getElementById("p-email").value.trim(),
    rol: document.getElementById("p-rol").value,
    notas: document.getElementById("p-notas").value.trim(),
    tarifa: tarifaValor !== "" ? parseFloat(tarifaValor) : null,
    situacion,
    retencion: situacion === "autonomo" && document.getElementById("p-retencion").value !== ""
      ? parseFloat(document.getElementById("p-retencion").value)
      : null,
    iva: situacion === "autonomo" && document.getElementById("p-iva").value !== ""
      ? parseFloat(document.getElementById("p-iva").value)
      : null,
  };

  try {
    if (id) {
      await db.collection("personal").doc(id).update(datos);
      mostrarToast("Contacto actualizado.");
    } else {
      await db.collection("personal").add({
        ...datos,
        creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
      });
      mostrarToast("Contacto creado.");
    }
    cerrarModal();
  } catch (err) {
    console.error(err);
    mostrarMsgModalPersonal("No se pudo guardar. Inténtalo de nuevo.");
  } finally {
    btn.disabled = false;
  }
});

function confirmarEliminarPersonal(id, nombre) {
  if (!confirm(`¿Eliminar a "${nombre}" de la bolsa de personal?`)) return;
  db.collection("personal")
    .doc(id)
    .delete()
    .then(() => mostrarToast("Contacto eliminado."))
    .catch((err) => {
      console.error(err);
      mostrarToast("No se pudo eliminar.");
    });
}

// ---------- Toast ----------

let toastTimerPersonal;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerPersonal);
  toastTimerPersonal = setTimeout(() => t.classList.remove("show"), 3200);
}
