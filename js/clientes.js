// =========================================================
// STAGE SUPPORT — clientes.js
// Colección: /clientes/{id} → { nombre, categoria, cif, contacto,
//   telefono, email, direccion, notas }
// categoria: 'privado' | 'admin_publica' | 'otros'
// =========================================================

const ETIQUETAS_CATEGORIA = {
  privado: "Privado",
  admin_publica: "Administración Pública",
  otros: "Otros",
};

(async function () {
  const perfil = await protegerPagina(["Comercial", "Admin"]);
  pintarNav(perfil.rol, "clientes");
  document.getElementById("pass-name").textContent = nombreCompletoDe(perfil) || perfil.email;
  document.getElementById("pass-role").textContent = perfil.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (perfil.foto) {
    avatarEl.innerHTML = `<img src="${perfil.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(perfil) || perfil.email);
  }

  escucharClientes();
})();

function escucharClientes() {
  db.collection("clientes").orderBy("nombre").onSnapshot(
    (snap) => {
      const filas = [];
      snap.forEach((doc) => filas.push({ id: doc.id, ...doc.data() }));
      pintarTablaClientes(filas);
    },
    (err) => {
      console.error(err);
      mostrarToast("No se pudo cargar el listado de clientes.");
    }
  );
}

function pintarTablaClientes(clientes) {
  const tbody = document.getElementById("tabla-clientes");
  document.getElementById("contador-clientes").textContent =
    clientes.length + (clientes.length === 1 ? " cliente" : " clientes");

  if (clientes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:36px; color:var(--color-text-muted);">
      Todavía no hay clientes creados.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = clientes
    .map(
      (c) => `
        <tr>
          <td style="font-weight:600;">${escaparHtmlCli(c.nombre)}</td>
          <td><span class="role-badge">${ETIQUETAS_CATEGORIA[c.categoria] || "—"}</span></td>
          <td>${escaparHtmlCli(c.telefono || "—")}</td>
          <td>
            <div class="row-actions" style="justify-content:flex-end;">
              <button class="icon-btn" title="Editar" onclick='abrirModalEdicionCliente(${JSON.stringify(c).replace(/'/g, "&#39;")})'>✎</button>
              <button class="icon-btn danger" title="Eliminar" onclick="confirmarEliminarCliente('${c.id}', '${escaparHtmlCli(c.nombre).replace(/'/g, "\\'")}')">🗑</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

function escaparHtmlCli(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// ---------- Modal ----------

const formCliente = document.getElementById("form-cliente");
const overlayCliente = document.getElementById("modal-overlay");

function abrirModalCliente() {
  formCliente.reset();
  document.getElementById("cli-id-edicion").value = "";
  document.getElementById("modal-titulo").textContent = "Nuevo cliente";
  document.getElementById("btn-guardar").textContent = "Crear cliente";
  ocultarMsgModalCli();
  overlayCliente.classList.add("show");
}

function abrirModalEdicionCliente(c) {
  formCliente.reset();
  document.getElementById("cli-id-edicion").value = c.id;
  document.getElementById("cli-nombre").value = c.nombre || "";
  document.getElementById("cli-categoria").value = c.categoria || "privado";
  document.getElementById("cli-cif").value = c.cif || "";
  document.getElementById("cli-contacto").value = c.contacto || "";
  document.getElementById("cli-telefono").value = c.telefono || "";
  document.getElementById("cli-email").value = c.email || "";
  document.getElementById("cli-direccion").value = c.direccion || "";
  document.getElementById("cli-notas").value = c.notas || "";
  document.getElementById("modal-titulo").textContent = "Editar cliente";
  document.getElementById("btn-guardar").textContent = "Guardar cambios";
  ocultarMsgModalCli();
  overlayCliente.classList.add("show");
}

function cerrarModal() {
  overlayCliente.classList.remove("show");
}

function ocultarMsgModalCli() {
  const m = document.getElementById("modal-msg");
  m.className = "form-msg";
  m.textContent = "";
}

function mostrarMsgModalCli(texto) {
  const m = document.getElementById("modal-msg");
  m.textContent = texto;
  m.className = "form-msg show error";
}

formCliente.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("cli-id-edicion").value;
  const btn = document.getElementById("btn-guardar");
  btn.disabled = true;

  const datos = {
    nombre: document.getElementById("cli-nombre").value.trim(),
    categoria: document.getElementById("cli-categoria").value,
    cif: document.getElementById("cli-cif").value.trim(),
    contacto: document.getElementById("cli-contacto").value.trim(),
    telefono: document.getElementById("cli-telefono").value.trim(),
    email: document.getElementById("cli-email").value.trim(),
    direccion: document.getElementById("cli-direccion").value.trim(),
    notas: document.getElementById("cli-notas").value.trim(),
  };

  try {
    if (id) {
      await db.collection("clientes").doc(id).update(datos);
      mostrarToast("Cliente actualizado.");
    } else {
      await db.collection("clientes").add({
        ...datos,
        creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
      });
      mostrarToast("Cliente creado.");
    }
    cerrarModal();
  } catch (err) {
    console.error(err);
    mostrarMsgModalCli("No se pudo guardar. Inténtalo de nuevo.");
  } finally {
    btn.disabled = false;
  }
});

function confirmarEliminarCliente(id, nombre) {
  if (!confirm(`¿Eliminar el cliente "${nombre}"?`)) return;
  db.collection("clientes")
    .doc(id)
    .delete()
    .then(() => mostrarToast("Cliente eliminado."))
    .catch((err) => {
      console.error(err);
      mostrarToast("No se pudo eliminar.");
    });
}

// ---------- Toast ----------

let toastTimerCli;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerCli);
  toastTimerCli = setTimeout(() => t.classList.remove("show"), 3200);
}
