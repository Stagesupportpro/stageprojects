// =========================================================
// STAGE SUPPORT — ver-propuestas.js
// Listado de solo consulta: cada fila abre la propuesta en modo
// cliente (propuesta-ver.html), desde donde se puede exportar a PDF
// o enviar a evaluar.
// =========================================================

const ETIQUETAS_ESTADO_VP = {
  Borrador: "Borrador",
  Enviada: "Enviada",
  Aceptada: "Aceptada",
  Rechazada: "Rechazada",
};

(async function () {
  const perfil = await protegerPagina(["Comercial", "Admin"]);
  pintarNav(perfil.rol, "ver-propuestas");
  document.getElementById("pass-name").textContent = nombreCompletoDe(perfil) || perfil.email;
  document.getElementById("pass-role").textContent = perfil.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (perfil.foto) {
    avatarEl.innerHTML = `<img src="${perfil.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(perfil) || perfil.email);
  }

  escucharVerPropuestas();
})();

function escucharVerPropuestas() {
  db.collection("propuestas").orderBy("creadoEl", "desc").onSnapshot(
    (snap) => {
      const filas = [];
      snap.forEach((doc) => filas.push({ id: doc.id, ...doc.data() }));
      pintarTablaVP(filas);
    },
    (err) => {
      console.error(err);
      mostrarToast("No se pudo cargar el listado de propuestas.");
    }
  );
}

function pintarTablaVP(propuestas) {
  const tbody = document.getElementById("tabla-vp");
  document.getElementById("contador-vp").textContent =
    propuestas.length + (propuestas.length === 1 ? " propuesta" : " propuestas");

  if (propuestas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:36px; color:var(--color-text-muted);">
      Todavía no hay propuestas creadas.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = propuestas
    .map(
      (p) => `
        <tr>
          <td><span class="id-badge">${escaparHtmlVP(p.idVisible || "—")}</span> <span class="permiso-tag">V${p.version || 1}</span></td>
          <td style="font-weight:600;">${escaparHtmlVP(p.nombre)}</td>
          <td>${escaparHtmlVP(p.clienteNombre || "—")}</td>
          <td><span class="role-badge">${ETIQUETAS_ESTADO_VP[p.estado] || "Borrador"}</span></td>
          <td>
            <div class="row-actions" style="justify-content:flex-end;">
              <a class="btn-accent" style="text-decoration:none; padding:8px 16px; font-size:12.5px;" href="propuesta-ver.html?id=${p.id}" target="_blank">👁️ Ver</a>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

function escaparHtmlVP(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// ---------- Toast ----------

let toastTimerVP;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerVP);
  toastTimerVP = setTimeout(() => t.classList.remove("show"), 3200);
}
