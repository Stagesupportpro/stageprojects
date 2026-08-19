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

    document.getElementById("prop-id-badge").textContent = `${d.idVisible || "—"} · V${d.version || 1}`;
    document.getElementById("prop-titulo-cabecera").textContent = d.nombre || "Propuesta";
    document.getElementById("pd-nombre").value = d.nombre || "";
    document.getElementById("pd-estado").value = d.estado || "Borrador";
    document.getElementById("pd-notas").value = d.notas || "";
    document.getElementById("pd-mostrar-precios").value = d.mostrarPrecios === false ? "no" : "si";
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
    descripcion: r.descripcionComercial || "",
    fecha: "",
    ciclo: "",
    bi: r.cache != null ? r.cache : null,
    comisionPct: r.comisionPorcentaje != null ? r.comisionPorcentaje : 0,
    ivaPct: r.ivaPorcentaje != null ? r.ivaPorcentaje : 21,
  });
  renderItemsPropuesta();
}

function anadirItemManual() {
  itemsPropuesta.push({ rosterId: null, nombre: "", imagen: null, descripcion: "", fecha: "", ciclo: "", bi: null, comisionPct: 0, ivaPct: 21 });
  renderItemsPropuesta();
}

function eliminarItemPropuesta(i) {
  itemsPropuesta.splice(i, 1);
  renderItemsPropuesta();
}

function procesarFotoItemPropuesta(i, event) {
  const archivo = event.target.files[0];
  if (!archivo || !archivo.type.startsWith("image/")) return;

  const lector = new FileReader();
  lector.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 500;
      let w = img.width;
      let h = img.height;
      if (w > MAX || h > MAX) {
        const ratio = Math.min(MAX / w, MAX / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      itemsPropuesta[i].imagen = canvas.toDataURL("image/jpeg", 0.82);
      renderItemsPropuesta();
    };
    img.src = e.target.result;
  };
  lector.readAsDataURL(archivo);
}

function pvpItemPropuesta(it) {
  return (it.bi || 0) * (1 + (it.comisionPct || 0) / 100);
}

function totalItemPropuesta(it) {
  return pvpItemPropuesta(it) * (1 + (it.ivaPct || 0) / 100) + (it.costeProduccion || 0);
}

function actualizarPrecioItemPropuesta(i) {
  const it = itemsPropuesta[i];
  const pvpEl = document.getElementById(`item-pvp-${i}`);
  const totalEl = document.getElementById(`item-total-${i}`);
  if (pvpEl) pvpEl.textContent = formatoEuroPD(pvpItemPropuesta(it));
  if (totalEl) totalEl.textContent = formatoEuroPD(totalItemPropuesta(it));
}

function formatoEuroPD(n) {
  return Number(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function renderItemsPropuesta() {
  const cont = document.getElementById("lista-items-propuesta");
  const mostrarPrecios = document.getElementById("pd-mostrar-precios").value !== "no";

  if (itemsPropuesta.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay opciones añadidas a esta propuesta.</p>`;
    return;
  }

  cont.innerHTML = itemsPropuesta
    .map((it, i) => {
      const imgHtml = it.imagen
        ? `<img src="${it.imagen}" alt="" style="width:64px; height:64px; border-radius:8px; object-fit:cover; flex-shrink:0;" />`
        : `<div style="width:64px; height:64px; border-radius:8px; background:var(--color-bg-soft); flex-shrink:0;"></div>`;
      const cambiarFotoHtml = `
        <button type="button" class="btn-ghost" style="font-size:11px; padding:5px 8px; margin-top:4px;" onclick="document.getElementById('item-foto-input-${i}').click()">Cambiar foto</button>
        <input type="file" id="item-foto-input-${i}" accept="image/*" style="display:none;" onchange="procesarFotoItemPropuesta(${i}, event)" />
      `;

      const precioHtml = mostrarPrecios
        ? `
          <div class="form-grid" style="margin-top:8px;">
            <div class="field"><label style="font-size:11px;">Caché / coste (BI) €</label><input type="number" min="0" step="0.01" value="${it.bi != null ? it.bi : ""}" oninput="itemsPropuesta[${i}].bi=this.value===''?null:parseFloat(this.value); actualizarPrecioItemPropuesta(${i})" /></div>
            <div class="field"><label style="font-size:11px;">Comisión %</label><input type="number" min="0" max="100" step="0.1" value="${it.comisionPct != null ? it.comisionPct : ""}" oninput="itemsPropuesta[${i}].comisionPct=this.value===''?0:parseFloat(this.value); actualizarPrecioItemPropuesta(${i})" /></div>
            <div class="field"><label style="font-size:11px;">IVA %</label><input type="number" min="0" max="100" step="0.1" value="${it.ivaPct != null ? it.ivaPct : ""}" oninput="itemsPropuesta[${i}].ivaPct=this.value===''?0:parseFloat(this.value); actualizarPrecioItemPropuesta(${i})" /></div>
          </div>
          <div class="field" style="margin-top:8px;">
            <label style="font-size:11px;">Costes de producción para esta fecha (opcional) €</label>
            <input type="number" min="0" step="0.01" placeholder="Ej. desplazamiento, técnica, hospitalidad para este artista…" value="${it.costeProduccion != null ? it.costeProduccion : ""}" oninput="itemsPropuesta[${i}].costeProduccion=this.value===''?null:parseFloat(this.value); actualizarPrecioItemPropuesta(${i})" />
            <p style="font-size:11px; color:var(--color-text-muted); margin:4px 0 0;">Se suma directo al Total de este artista (sin comisión ni IVA aparte) — para repercutir al cliente costes reales de producir esa fecha en concreto.</p>
          </div>
          <div class="calc-box" style="margin-top:8px;">
            <div class="calc-item"><div class="calc-label">PVP (con comisión)</div><div class="calc-value" id="item-pvp-${i}">${formatoEuroPD(pvpItemPropuesta(it))}</div></div>
            <div class="calc-item calc-total"><div class="calc-label">Total con IVA</div><div class="calc-value" id="item-total-${i}">${formatoEuroPD(totalItemPropuesta(it))}</div></div>
          </div>
          <p style="font-size:11px; color:var(--color-text-muted); margin:4px 0 0;">Al cliente solo le aparece el PVP + IVA + Total — la comisión nunca se muestra por separado.</p>
        `
        : `<p style="font-size:12px; color:var(--color-text-muted); margin-top:6px;">Los precios no se muestran al cliente en esta propuesta (cambia "Mostrar precios" arriba si hace falta).</p>`;

      return `
        <div class="day-block">
          <div style="display:flex; gap:14px;">
          <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
            ${imgHtml}
            ${cambiarFotoHtml}
          </div>
            <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
              <div class="form-grid">
                <div class="field"><label style="font-size:11px;">Fecha</label><input type="date" value="${it.fecha || ""}" oninput="itemsPropuesta[${i}].fecha=this.value" /></div>
                <div class="field"><label style="font-size:11px;">Ciclo / Festival / Actuación</label><input placeholder="Ej. Festival Verano 2026" value="${escaparAttrPD(it.ciclo)}" oninput="itemsPropuesta[${i}].ciclo=this.value" /></div>
              </div>
              <input placeholder="Nombre" value="${escaparAttrPD(it.nombre)}" oninput="itemsPropuesta[${i}].nombre=this.value" />
              <input placeholder="Descripción" value="${escaparAttrPD(it.descripcion)}" oninput="itemsPropuesta[${i}].descripcion=this.value" />
              ${precioHtml}
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
    mostrarPrecios: document.getElementById("pd-mostrar-precios").value !== "no",
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
