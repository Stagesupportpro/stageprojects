// =========================================================
// STAGE SUPPORT — comisiones.js
// Comisiones estándar predeterminadas.
// Colección: /comisiones/{id} → { nombre, porcentaje, notas }
// =========================================================

(async function () {
  const perfil = await protegerPagina(["Admin"]);
  pintarNav(perfil.rol, "comisiones");
  document.getElementById("pass-name").textContent = nombreCompletoDe(perfil) || perfil.email;
  document.getElementById("pass-role").textContent = perfil.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (perfil.foto) {
    avatarEl.innerHTML = `<img src="${perfil.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(perfil) || perfil.email);
  }

  escucharComisiones();
})();

function escucharComisiones() {
  db.collection("comisiones").orderBy("nombre").onSnapshot(
    (snap) => {
      const filas = [];
      snap.forEach((doc) => filas.push({ id: doc.id, ...doc.data() }));
      pintarTablaComisiones(filas);
    },
    (err) => {
      console.error(err);
      mostrarToast("No se pudo cargar el listado de comisiones.");
    }
  );
}

function pintarTablaComisiones(comisiones) {
  const tbody = document.getElementById("tabla-comisiones");
  document.getElementById("contador-comisiones").textContent =
    comisiones.length + (comisiones.length === 1 ? " comisión" : " comisiones");

  if (comisiones.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:36px; color:var(--color-text-muted);">
      Todavía no hay comisiones estándar creadas.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = comisiones
    .map(
      (c) => `
        <tr>
          <td style="font-weight:600;">${escaparHtmlCom(c.nombre)}</td>
          <td>${Number(c.porcentaje).toLocaleString("es-ES")}%</td>
          <td style="color:var(--color-text-muted);">${escaparHtmlCom(c.notas || "—")}</td>
          <td>
            <div class="row-actions" style="justify-content:flex-end;">
              <button class="icon-btn" title="Editar" onclick='abrirModalEdicionComision(${JSON.stringify(c).replace(/'/g, "&#39;")})'>✎</button>
              <button class="icon-btn danger" title="Eliminar" onclick="confirmarEliminarComision('${c.id}', '${escaparHtmlCom(c.nombre).replace(/'/g, "\\'")}')">🗑</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

function escaparHtmlCom(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// ---------- Modal ----------

const formComision = document.getElementById("form-comision");
const overlayComision = document.getElementById("modal-overlay");

function abrirModalComision() {
  formComision.reset();
  document.getElementById("comision-id-edicion").value = "";
  document.getElementById("modal-titulo").textContent = "Nueva comisión";
  document.getElementById("btn-guardar").textContent = "Crear comisión";
  ocultarMsgModalCom();
  overlayComision.classList.add("show");
}

function abrirModalEdicionComision(c) {
  formComision.reset();
  document.getElementById("comision-id-edicion").value = c.id;
  document.getElementById("comision-nombre").value = c.nombre || "";
  document.getElementById("comision-porcentaje").value = c.porcentaje != null ? c.porcentaje : "";
  document.getElementById("comision-notas").value = c.notas || "";
  document.getElementById("modal-titulo").textContent = "Editar comisión";
  document.getElementById("btn-guardar").textContent = "Guardar cambios";
  ocultarMsgModalCom();
  overlayComision.classList.add("show");
}

function cerrarModal() {
  overlayComision.classList.remove("show");
}

function ocultarMsgModalCom() {
  const m = document.getElementById("modal-msg");
  m.className = "form-msg";
  m.textContent = "";
}

function mostrarMsgModalCom(texto) {
  const m = document.getElementById("modal-msg");
  m.textContent = texto;
  m.className = "form-msg show error";
}

formComision.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("comision-id-edicion").value;
  const btn = document.getElementById("btn-guardar");
  btn.disabled = true;

  const datos = {
    nombre: document.getElementById("comision-nombre").value.trim(),
    porcentaje: parseFloat(document.getElementById("comision-porcentaje").value),
    notas: document.getElementById("comision-notas").value.trim(),
  };

  try {
    if (id) {
      await db.collection("comisiones").doc(id).update(datos);
      mostrarToast("Comisión actualizada.");
    } else {
      await db.collection("comisiones").add({
        ...datos,
        creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
      });
      mostrarToast("Comisión creada.");
    }
    cerrarModal();
  } catch (err) {
    console.error(err);
    mostrarMsgModalCom("No se pudo guardar. Inténtalo de nuevo.");
  } finally {
    btn.disabled = false;
  }
});

function confirmarEliminarComision(id, nombre) {
  if (!confirm(`¿Eliminar la comisión "${nombre}"?`)) return;
  db.collection("comisiones")
    .doc(id)
    .delete()
    .then(() => mostrarToast("Comisión eliminada."))
    .catch((err) => {
      console.error(err);
      mostrarToast("No se pudo eliminar.");
    });
}

// ---------- Toast ----------

let toastTimerCom;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerCom);
  toastTimerCom = setTimeout(() => t.classList.remove("show"), 3200);
}
