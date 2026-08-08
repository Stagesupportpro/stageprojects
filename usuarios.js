// =========================================================
// STAGE SUPPORT — usuarios.js
// Panel de administración de usuarios (solo rol Admin)
// =========================================================

let usuarioActual = null;

(async function () {
  usuarioActual = await protegerPagina(["Admin"]);
  pintarNav(usuarioActual.rol, "usuarios");
  document.getElementById("pass-name").textContent = usuarioActual.nombre || usuarioActual.email;
  document.getElementById("pass-role").textContent = usuarioActual.rol;

  escucharUsuarios();
})();

// ---------- Listado en tiempo real ----------

function escucharUsuarios() {
  db.collection("usuarios").orderBy("nombre").onSnapshot(
    (snap) => {
      const filas = [];
      snap.forEach((doc) => filas.push({ id: doc.id, ...doc.data() }));
      pintarTabla(filas);
    },
    (err) => {
      console.error(err);
      mostrarToast("No se pudo cargar el listado de usuarios.");
    }
  );
}

function pintarTabla(usuarios) {
  const tbody = document.getElementById("tabla-usuarios");
  const contador = document.getElementById("contador-usuarios");
  contador.textContent = usuarios.length + (usuarios.length === 1 ? " usuario" : " usuarios");

  if (usuarios.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:36px; color:var(--color-text-muted);">
      Todavía no hay usuarios dados de alta.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = usuarios
    .map((u) => {
      const activo = u.activo !== false;
      return `
        <tr>
          <td>
            <div class="avatar-chip">
              <span class="initials">${inicialesDe(u.nombre || u.email)}</span>
              <div>
                <div style="font-weight:600;">${escaparHtml(u.nombre || "—")}</div>
                <div style="color:var(--color-text-muted); font-size:12.5px;">${escaparHtml(u.email || "")}</div>
              </div>
            </div>
          </td>
          <td><span class="role-badge ${u.rol}">${u.rol}</span></td>
          <td><span class="status-dot ${activo ? "" : "inactive"}">${activo ? "Activo" : "Suspendido"}</span></td>
          <td>
            <div class="row-actions" style="justify-content:flex-end;">
              <button class="icon-btn" title="Editar" onclick='abrirModalEdicion(${JSON.stringify(u).replace(/'/g, "&#39;")})'>✎</button>
              <button class="icon-btn danger" title="Eliminar" onclick="confirmarEliminar('${u.id}', '${escaparHtml(u.nombre || u.email).replace(/'/g, "\\'")}')">🗑</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function escaparHtml(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// ---------- Modal: alta / edición ----------

const form = document.getElementById("form-usuario");
const overlay = document.getElementById("modal-overlay");

function abrirModal() {
  form.reset();
  document.getElementById("uid-edicion").value = "";
  document.getElementById("modal-titulo").textContent = "Nuevo usuario";
  document.getElementById("modal-sub").textContent = "Se creará una cuenta con acceso inmediato a la plataforma.";
  document.getElementById("campo-email").style.display = "block";
  document.getElementById("campo-password").style.display = "block";
  document.getElementById("password").required = true;
  document.getElementById("email").disabled = false;
  document.getElementById("campo-activo").style.display = "none";
  document.getElementById("btn-guardar").textContent = "Crear usuario";
  ocultarMsgModal();
  overlay.classList.add("show");
}

function abrirModalEdicion(u) {
  form.reset();
  document.getElementById("uid-edicion").value = u.id;
  document.getElementById("nombre").value = u.nombre || "";
  document.getElementById("email").value = u.email || "";
  document.getElementById("rol").value = u.rol || "Comercial";
  document.getElementById("activo").value = u.activo === false ? "false" : "true";

  document.getElementById("modal-titulo").textContent = "Editar usuario";
  document.getElementById("modal-sub").textContent = "Actualiza el rol o el estado de acceso de este usuario.";
  document.getElementById("campo-email").style.display = "block";
  document.getElementById("email").disabled = true; // el email de login no se edita aquí
  document.getElementById("campo-password").style.display = "none";
  document.getElementById("password").required = false;
  document.getElementById("campo-activo").style.display = "block";
  document.getElementById("btn-guardar").textContent = "Guardar cambios";
  ocultarMsgModal();
  overlay.classList.add("show");
}

function cerrarModal() {
  overlay.classList.remove("show");
}

function ocultarMsgModal() {
  const m = document.getElementById("modal-msg");
  m.className = "form-msg";
  m.textContent = "";
}

function mostrarMsgModal(texto) {
  const m = document.getElementById("modal-msg");
  m.textContent = texto;
  m.className = "form-msg show error";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const uid = document.getElementById("uid-edicion").value;
  const btn = document.getElementById("btn-guardar");
  btn.disabled = true;

  try {
    if (uid) {
      // ---- Editar usuario existente (rol / estado) ----
      await db.collection("usuarios").doc(uid).update({
        nombre: document.getElementById("nombre").value.trim(),
        rol: document.getElementById("rol").value,
        activo: document.getElementById("activo").value === "true",
      });
      mostrarToast("Usuario actualizado.");
      cerrarModal();
    } else {
      // ---- Crear usuario nuevo ----
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const nombre = document.getElementById("nombre").value.trim();
      const rol = document.getElementById("rol").value;

      if (!esDominioValido(email)) {
        mostrarMsgModal("El email debe ser del dominio @" + DOMINIO_PERMITIDO);
        btn.disabled = false;
        return;
      }

      // Se crea en la app "Secondary" para no cerrar la sesión del admin actual.
      const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);

      await db.collection("usuarios").doc(cred.user.uid).set({
        nombre,
        email,
        rol,
        activo: true,
        creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
      });

      await secondaryAuth.signOut();
      mostrarToast("Usuario creado correctamente.");
      cerrarModal();
    }
  } catch (err) {
    const mensajes = {
      "auth/email-already-in-use": "Ya existe una cuenta con ese email.",
      "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
      "auth/invalid-email": "El email no es válido.",
    };
    mostrarMsgModal(mensajes[err.code] || "No se pudo guardar. Inténtalo de nuevo.");
  } finally {
    btn.disabled = false;
  }
});

// ---------- Eliminar ----------

function confirmarEliminar(uid, nombre) {
  if (!confirm(`¿Quitar el acceso de "${nombre}" a la plataforma?`)) return;
  eliminarUsuario(uid);
}

async function eliminarUsuario(uid) {
  try {
    // Esto revoca su acceso a la plataforma de inmediato (borra su perfil,
    // y protegerPagina() lo expulsará en su próxima carga o al recargar).
    // La cuenta de Firebase Auth en sí no se puede borrar desde el cliente
    // por seguridad: para un borrado completo hace falta una Cloud Function
    // con el Admin SDK (ver README → "Eliminar cuentas por completo").
    await db.collection("usuarios").doc(uid).delete();
    mostrarToast("Acceso eliminado.");
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo eliminar el usuario.");
  }
}

// ---------- Toast ----------

let toastTimer;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}
