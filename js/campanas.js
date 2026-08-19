// =========================================================
// STAGE SUPPORT — campanas.js
// Colección: /campanas/{id} → { nombre, plataforma, estado,
//   fechaInicio, fechaFin, presupuesto, enlace, objetivo, notas,
//   creadoPor, creadoPorUid, creadoEl }
// =========================================================

let usuarioActualCM = null;

(async function () {
  usuarioActualCM = await protegerPagina();
  pintarNav(usuarioActualCM.rol, "campanas");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualCM) || usuarioActualCM.email;
  document.getElementById("pass-role").textContent = usuarioActualCM.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualCM.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualCM.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualCM) || usuarioActualCM.email);
  }

  escucharCampanas();
})();

// ---------- Listado ----------

function escucharCampanas() {
  db.collection("campanas").onSnapshot(
    (snap) => {
      const filas = [];
      snap.forEach((doc) => filas.push({ id: doc.id, ...doc.data() }));
      filas.sort((a, b) => (b.fechaInicio || "").localeCompare(a.fechaInicio || ""));
      pintarTablaCampanas(filas);
    },
    (err) => {
      console.error(err);
      mostrarToast("No se pudo cargar el listado de campañas.");
    }
  );
}

function pintarTablaCampanas(campanas) {
  const tbody = document.getElementById("tabla-campanas");
  document.getElementById("contador-campanas").textContent = campanas.length + (campanas.length === 1 ? " campaña" : " campañas");

  if (campanas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:36px; color:var(--color-text-muted);">
      Todavía no hay campañas creadas.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = campanas
    .map((c) => {
      const inicio = c.fechaInicio ? new Date(c.fechaInicio + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "—";
      const fin = c.fechaFin ? new Date(c.fechaFin + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "—";
      const presupuesto = c.presupuesto != null ? `${Number(c.presupuesto).toLocaleString("es-ES")} €` : "—";

      return `
        <tr>
          <td style="font-weight:600;">${escaparHtmlCM(c.nombre)}</td>
          <td><span class="plataforma-badge ${c.plataforma || "Otro"}">${escaparHtmlCM(etiquetaPlataformaCM(c.plataforma))}</span></td>
          <td><span class="estado-campana-badge ${c.estado || "Planificada"}">${escaparHtmlCM(c.estado || "Planificada")}</span></td>
          <td>${inicio} — ${fin}</td>
          <td>${presupuesto}</td>
          <td>
            <div class="row-actions" style="justify-content:flex-end;">
              <button class="icon-btn" title="Editar" onclick='abrirModalEdicionCampana(${JSON.stringify(c).replace(/'/g, "&#39;")})'>✎</button>
              <button class="icon-btn danger" title="Eliminar" onclick="confirmarEliminarCampana('${c.id}', '${escaparHtmlCM(c.nombre).replace(/'/g, "\\'")}')">🗑</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function etiquetaPlataformaCM(p) {
  return { Meta: "Meta", Instagram: "Instagram", Facebook: "Facebook", TikTok: "TikTok", GoogleAds: "Google Ads", LinkedIn: "LinkedIn", Otro: "Otro" }[p] || "Otro";
}

function escaparHtmlCM(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function fechaISOCM(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------- Modal ----------

const formCampana = document.getElementById("form-campana");
const overlayCampana = document.getElementById("modal-overlay");

function abrirModalCampana() {
  formCampana.reset();
  document.getElementById("cm-id-edicion").value = "";
  document.getElementById("cm-fecha-inicio").value = fechaISOCM(new Date());
  document.getElementById("modal-titulo").textContent = "Nueva campaña";
  document.getElementById("btn-guardar").textContent = "Crear campaña";
  ocultarMsgCM();
  overlayCampana.classList.add("show");
}

function abrirModalEdicionCampana(c) {
  formCampana.reset();
  document.getElementById("cm-id-edicion").value = c.id;
  document.getElementById("cm-nombre").value = c.nombre || "";
  document.getElementById("cm-plataforma").value = c.plataforma || "Meta";
  document.getElementById("cm-estado").value = c.estado || "Planificada";
  document.getElementById("cm-fecha-inicio").value = c.fechaInicio || "";
  document.getElementById("cm-fecha-fin").value = c.fechaFin || "";
  document.getElementById("cm-presupuesto").value = c.presupuesto != null ? c.presupuesto : "";
  document.getElementById("cm-enlace").value = c.enlace || "";
  document.getElementById("cm-objetivo").value = c.objetivo || "";
  document.getElementById("cm-notas").value = c.notas || "";
  document.getElementById("modal-titulo").textContent = "Editar campaña";
  document.getElementById("btn-guardar").textContent = "Guardar cambios";
  ocultarMsgCM();
  overlayCampana.classList.add("show");
}

function cerrarModal() {
  overlayCampana.classList.remove("show");
}

function ocultarMsgCM() {
  const m = document.getElementById("modal-msg");
  m.className = "form-msg";
  m.textContent = "";
}

formCampana.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("cm-id-edicion").value;
  const btn = document.getElementById("btn-guardar");
  btn.disabled = true;

  const fechaInicio = document.getElementById("cm-fecha-inicio").value;
  const fechaFin = document.getElementById("cm-fecha-fin").value;

  if (fechaFin < fechaInicio) {
    document.getElementById("modal-msg").textContent = "La fecha de fin no puede ser anterior a la de inicio.";
    document.getElementById("modal-msg").className = "form-msg show error";
    btn.disabled = false;
    return;
  }

  const datos = {
    nombre: document.getElementById("cm-nombre").value.trim(),
    plataforma: document.getElementById("cm-plataforma").value,
    estado: document.getElementById("cm-estado").value,
    fechaInicio,
    fechaFin,
    presupuesto: document.getElementById("cm-presupuesto").value !== "" ? parseFloat(document.getElementById("cm-presupuesto").value) : null,
    enlace: document.getElementById("cm-enlace").value.trim(),
    objetivo: document.getElementById("cm-objetivo").value.trim(),
    notas: document.getElementById("cm-notas").value.trim(),
  };

  try {
    if (id) {
      await db.collection("campanas").doc(id).update(datos);
      mostrarToast("Campaña actualizada.");
    } else {
      await db.collection("campanas").add({
        ...datos,
        creadoPor: nombreCompletoDe(usuarioActualCM) || usuarioActualCM.email,
        creadoPorUid: usuarioActualCM.uid,
        creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
      });
      mostrarToast("Campaña creada.");
    }
    cerrarModal();
  } catch (err) {
    console.error(err);
    document.getElementById("modal-msg").textContent = "No se pudo guardar. Inténtalo de nuevo.";
    document.getElementById("modal-msg").className = "form-msg show error";
  } finally {
    btn.disabled = false;
  }
});

function confirmarEliminarCampana(id, nombre) {
  if (!confirm(`¿Eliminar la campaña "${nombre}"?`)) return;
  db.collection("campanas")
    .doc(id)
    .delete()
    .then(() => mostrarToast("Campaña eliminada."))
    .catch((err) => {
      console.error(err);
      mostrarToast("No se pudo eliminar.");
    });
}

// ---------- Toast ----------

let toastTimerCM;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerCM);
  toastTimerCM = setTimeout(() => t.classList.remove("show"), 3200);
}
