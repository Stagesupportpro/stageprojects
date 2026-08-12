// =========================================================
// STAGE SUPPORT — usuarios.js
// Panel de administración de usuarios (solo rol Admin)
// =========================================================

let usuarioActual = null;

(async function () {
  usuarioActual = await protegerPagina(["Admin"]);
  pintarNav(usuarioActual.rol, "usuarios");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActual) || usuarioActual.email;
  document.getElementById("pass-role").textContent = usuarioActual.rol;
  pintarAvatarPass(usuarioActual);

  await cargarOpcionesRolUsuarios();
  escucharUsuarios();
})();

// ---------- Roles disponibles (tira de Administración → Roles) ----------

async function cargarOpcionesRolUsuarios() {
  const sel = document.getElementById("rol");
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

// ---------- Foto de perfil ----------
// Se guarda directamente en Firestore como imagen comprimida (Data URL),
// para no depender de Firebase Storage (requiere plan Blaze).
// Redimensionada a 200x200 y comprimida a JPEG ~0.75 → unos 15-30 KB,
// muy por debajo del límite de 1 MB por documento de Firestore.

function procesarFoto(event) {
  const archivo = event.target.files[0];
  if (!archivo) return;

  if (!archivo.type.startsWith("image/")) {
    mostrarToast("Elige un archivo de imagen.");
    return;
  }

  const lector = new FileReader();
  lector.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const TAMANO = 200;
      const canvas = document.createElement("canvas");
      canvas.width = TAMANO;
      canvas.height = TAMANO;
      const ctx = canvas.getContext("2d");

      // Recorte cuadrado centrado (cover)
      const lado = Math.min(img.width, img.height);
      const sx = (img.width - lado) / 2;
      const sy = (img.height - lado) / 2;
      ctx.drawImage(img, sx, sy, lado, lado, 0, 0, TAMANO, TAMANO);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
      document.getElementById("foto-data").value = dataUrl;
      mostrarPreviewFoto(dataUrl);
    };
    img.src = e.target.result;
  };
  lector.readAsDataURL(archivo);
}

function mostrarPreviewFoto(dataUrl) {
  const preview = document.getElementById("photo-preview");
  const btnQuitar = document.getElementById("btn-quitar-foto");
  if (dataUrl) {
    preview.innerHTML = `<img src="${dataUrl}" alt="" />`;
    btnQuitar.style.display = "inline-flex";
  } else {
    const nombre = document.getElementById("nombre").value || "?";
    preview.textContent = inicialesDe(nombre);
    btnQuitar.style.display = "none";
  }
}

function quitarFoto() {
  document.getElementById("foto-data").value = "";
  document.getElementById("foto-input").value = "";
  mostrarPreviewFoto(null);
}

// ---------- Avatar del pase de acceso (sidebar) ----------

function pintarAvatarPass(perfil) {
  const el = document.getElementById("pass-avatar");
  if (!el) return;
  if (perfil.foto) {
    el.innerHTML = `<img src="${perfil.foto}" alt="" />`;
  } else {
    el.textContent = inicialesDe(nombreCompletoDe(perfil) || perfil.email);
  }
}

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
      const nombreCompleto = [u.nombre, u.apellidos].filter(Boolean).join(" ") || "—";
      const avatarHtml = u.foto
        ? `<img class="avatar-photo" src="${u.foto}" alt="" />`
        : `<span class="initials">${inicialesDe(nombreCompleto)}</span>`;
      return `
        <tr>
          <td>
            <div class="avatar-chip">
              ${avatarHtml}
              <div>
                <div style="font-weight:600;">${escaparHtml(nombreCompleto)}</div>
                <div style="color:var(--color-text-muted); font-size:12.5px;">${escaparHtml(u.email || "")}</div>
              </div>
            </div>
          </td>
          <td>${escaparHtml(u.telefono || "—")}</td>
          <td><span class="role-badge ${u.rol}">${u.rol}</span></td>
          <td><span class="status-dot ${activo ? "" : "inactive"}">${activo ? "Activo" : "Suspendido"}</span></td>
          <td>
            <div class="row-actions" style="justify-content:flex-end;">
              <button class="icon-btn" title="Editar" onclick='abrirModalEdicion(${JSON.stringify(u).replace(/'/g, "&#39;")})'>✎</button>
              <button class="icon-btn danger" title="Eliminar" onclick="confirmarEliminar('${u.id}', '${escaparHtml(nombreCompleto).replace(/'/g, "\\'")}')">🗑</button>
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
  document.getElementById("foto-data").value = "";
  mostrarPreviewFoto(null);
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
  document.getElementById("apellidos").value = u.apellidos || "";
  document.getElementById("telefono").value = u.telefono || "";
  document.getElementById("email").value = u.email || "";
  document.getElementById("foto-data").value = u.foto || "";
  mostrarPreviewFoto(u.foto || null);
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
        apellidos: document.getElementById("apellidos").value.trim(),
        telefono: document.getElementById("telefono").value.trim(),
        foto: document.getElementById("foto-data").value || null,
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
      const apellidos = document.getElementById("apellidos").value.trim();
      const telefono = document.getElementById("telefono").value.trim();
      const foto = document.getElementById("foto-data").value || null;
      const rol = document.getElementById("rol").value;

      if (!esDominioValido(email)) {
        mostrarMsgModal("El email debe ser del dominio @" + DOMINIO_PERMITIDO);
        btn.disabled = false;
        return;
      }

      // Se crea en la app "Secondary" para no cerrar la sesión del admin actual.
      const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);

      try {
        await db.collection("usuarios").doc(cred.user.uid).set({
          nombre,
          apellidos,
          telefono,
          foto,
          email,
          rol,
          activo: true,
          creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } catch (errPerfil) {
        // La cuenta de acceso YA se creó en Authentication, pero el perfil
        // en Firestore ha fallado — sin esto, la cuenta queda "en el limbo"
        // (no puede entrar y no aparece en este listado). Se avisa con el
        // UID exacto para poder recuperarla a mano desde Firebase Console
        // (Firestore → usuarios → nuevo documento con ese ID).
        console.error(errPerfil);
        mostrarMsgModal(
          `Se creó el acceso pero falló al guardar el perfil. UID de la cuenta: ${cred.user.uid} — créala a mano en Firestore → usuarios con ese ID, o bórrala en Authentication y vuelve a intentarlo.`
        );
        await secondaryAuth.signOut();
        btn.disabled = false;
        return;
      }

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
