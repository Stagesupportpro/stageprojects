// =========================================================
// STAGE SUPPORT — propuesta-detalle.js
// =========================================================

let usuarioActualPD = null;
let docIdPropuesta = null;
let itemsPropuesta = [];
let rosterCachePD = [];
let clientesCachePD = [];

(async function () {
  const params = new URLSearchParams(window.location.search);
  docIdPropuesta = params.get("id");
  if (!docIdPropuesta) {
    window.location.href = "propuestas.html";
    return;
  }

  usuarioActualPD = await protegerPagina(["Comercial", "Admin"]);
  pintarNav(usuarioActualPD.rol, "propuestas");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualPD) || usuarioActualPD.email;
  document.getElementById("pass-role").textContent = usuarioActualPD.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualPD.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualPD.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualPD) || usuarioActualPD.email);
  }

  await cargarClientesPD();
  await cargarRosterPD();
  await cargarPropuesta();
})();

async function cargarClientesPD() {
  const sel = document.getElementById("pd-cliente");
  try {
    const snap = await db.collection("clientes").orderBy("nombre").get();
    clientesCachePD = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const opciones = clientesCachePD.map((c) => `<option value="${c.id}">${escaparHtmlPD(c.nombre)}</option>`).join("");
    sel.innerHTML = `<option value="">— Sin vincular —</option>${opciones}`;
  } catch (err) {
    console.error(err);
  }
}

async function cargarRosterPD() {
  const sel = document.getElementById("pd-roster-select");
  try {
    const snap = await db.collection("roster").orderBy("nombre").get();
    rosterCachePD = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const opciones = rosterCachePD.map((r) => `<option value="${r.id}">${escaparHtmlPD(r.nombre)}</option>`).join("");
    sel.innerHTML = `<option value="">Añadir desde Roster…</option>${opciones}`;
  } catch (err) {
    console.error(err);
  }
  sel.addEventListener("change", () => {
    if (sel.value) {
      anadirItemDesdeRoster(sel.value);
      sel.value = "";
    }
  });
}

async function cargarPropuesta() {
  try {
    const snap = await db.collection("propuestas").doc(docIdPropuesta).get();
    if (!snap.exists) {
      mostrarToast("Esta propuesta no existe.");
      setTimeout(() => (window.location.href = "propuestas.html"), 1500);
      return;
    }
    const d = snap.data();

    document.getElementById("prop-id-badge").textContent = d.idVisible || "—";
    document.getElementById("prop-titulo-cabecera").textContent = d.nombre || "Propuesta";
    document.getElementById("pd-nombre").value = d.nombre || "";
    document.getElementById("pd-estado").value = d.estado || "Borrador";
    document.getElementById("pd-notas").value = d.notas || "";
    if (d.clienteId) document.getElementById("pd-cliente").value = d.clienteId;

    itemsPropuesta = Array.isArray(d.items) ? d.items : [];
    renderItemsPropuesta();
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo cargar la propuesta.");
  }
}

// ---------- Items ----------

function anadirItemDesdeRoster(rosterId) {
  const r = rosterCachePD.find((x) => x.id === rosterId);
  if (!r) return;
  itemsPropuesta.push({
    rosterId: r.id,
    nombre: r.nombre,
    imagen: r.imagenCartel || null,
    descripcion: "",
    precio: null,
  });
  renderItemsPropuesta();
}

function anadirItemManual() {
  itemsPropuesta.push({ rosterId: null, nombre: "", imagen: null, descripcion: "", precio: null });
  renderItemsPropuesta();
}

function eliminarItemPropuesta(i) {
  itemsPropuesta.splice(i, 1);
  renderItemsPropuesta();
}

function renderItemsPropuesta() {
  const cont = document.getElementById("lista-items-propuesta");
  if (itemsPropuesta.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay opciones añadidas a esta propuesta.</p>`;
    return;
  }

  cont.innerHTML = itemsPropuesta
    .map((it, i) => {
      const imgHtml = it.imagen
        ? `<img src="${it.imagen}" alt="" style="width:64px; height:64px; border-radius:8px; object-fit:cover; flex-shrink:0;" />`
        : `<div style="width:64px; height:64px; border-radius:8px; background:var(--color-bg-soft); flex-shrink:0;"></div>`;

      return `
        <div class="day-block">
          <div style="display:flex; gap:14px;">
            ${imgHtml}
            <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
              <input placeholder="Nombre" value="${escaparAttrPD(it.nombre)}" oninput="itemsPropuesta[${i}].nombre=this.value" />
              <input placeholder="Descripción" value="${escaparAttrPD(it.descripcion)}" oninput="itemsPropuesta[${i}].descripcion=this.value" />
              <input type="number" min="0" step="0.01" placeholder="Precio (opcional, se muestra al cliente)" value="${it.precio != null ? it.precio : ""}" oninput="itemsPropuesta[${i}].precio=this.value===''?null:parseFloat(this.value)" />
            </div>
            <button type="button" class="icon-btn danger" style="align-self:flex-start;" onclick="eliminarItemPropuesta(${i})" title="Quitar">🗑</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function escaparHtmlPD(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function escaparAttrPD(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// ---------- Guardar ----------

async function guardarPropuesta() {
  const btn = document.getElementById("btn-guardar-prop");
  btn.disabled = true;

  const clienteId = document.getElementById("pd-cliente").value;
  const clienteEncontrado = clientesCachePD.find((c) => c.id === clienteId);

  const datos = {
    nombre: document.getElementById("pd-nombre").value.trim(),
    estado: document.getElementById("pd-estado").value,
    notas: document.getElementById("pd-notas").value.trim(),
    clienteId: clienteId || null,
    clienteNombre: clienteEncontrado ? clienteEncontrado.nombre : "",
    items: itemsPropuesta,
  };

  try {
    await db.collection("propuestas").doc(docIdPropuesta).update(datos);
    document.getElementById("prop-titulo-cabecera").textContent = datos.nombre || "Propuesta";
    mostrarToast("Propuesta guardada.");
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo guardar. Inténtalo de nuevo.");
  } finally {
    btn.disabled = false;
  }
}

function verComoCliente() {
  window.open(`propuesta-ver.html?id=${docIdPropuesta}`, "_blank");
}

// ---------- Toast ----------

let toastTimerPD;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerPD);
  toastTimerPD = setTimeout(() => t.classList.remove("show"), 3200);
}
