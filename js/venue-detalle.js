// =========================================================
// STAGE SUPPORT — venue-detalle.js
// Colección: /venues/{id} → { nombre, direccion, mapsUrl, contactos[],
//   ridersPdf[], condiciones, tarifas[], tramosTaquilla{activo,filas[]}, notas }
// =========================================================

let usuarioActualVenD = null;
let docIdVenue = null;
let contactosVen = [];
let ridersVen = []; // [{ etiqueta, nombre, tamano, data }]
let tarifasVen = []; // [{ concepto, importe, impuestos: 'con'|'sin' }]
let tramosVen = []; // [{ desde, hasta, porcentaje }]

const LIMITE_PDF_BYTES_VEN = 600 * 1024;

(async function () {
  const params = new URLSearchParams(window.location.search);
  docIdVenue = params.get("id");
  if (!docIdVenue) {
    window.location.href = "venues.html";
    return;
  }

  usuarioActualVenD = await protegerPagina(["Comercial", "Admin"]);
  pintarNav(usuarioActualVenD.rol, "venues");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualVenD) || usuarioActualVenD.email;
  document.getElementById("pass-role").textContent = usuarioActualVenD.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualVenD.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualVenD.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualVenD) || usuarioActualVenD.email);
  }

  await cargarVenue();
})();

async function cargarVenue() {
  try {
    const snap = await db.collection("venues").doc(docIdVenue).get();
    if (!snap.exists) {
      mostrarToast("Este venue no existe.");
      setTimeout(() => (window.location.href = "venues.html"), 1500);
      return;
    }
    const d = snap.data();

    document.getElementById("ven-titulo-cabecera").textContent = d.nombre || "Venue";
    document.getElementById("v-nombre").value = d.nombre || "";
    document.getElementById("v-direccion").value = d.direccion || "";
    document.getElementById("v-maps").value = d.mapsUrl || "";
    document.getElementById("v-condiciones").value = d.condiciones || "";
    document.getElementById("v-notas").value = d.notas || "";

    contactosVen = Array.isArray(d.contactos) ? d.contactos : [];
    renderContactosVen();

    ridersVen = Array.isArray(d.ridersPdf) ? d.ridersPdf : [];
    renderRidersVen();

    tarifasVen = Array.isArray(d.tarifas) ? d.tarifas : [];
    renderTarifasVen();

    const taquilla = d.tramosTaquilla || { activo: false, filas: [] };
    document.getElementById("v-taquilla-activo").checked = !!taquilla.activo;
    tramosVen = Array.isArray(taquilla.filas) ? taquilla.filas : [];
    toggleTaquillaVen();
    renderTramosVen();
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo cargar la ficha.");
  }
}

// ---------- Contactos ----------

function renderContactosVen() {
  const cont = document.getElementById("lista-contactos-ven");
  if (contactosVen.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay contactos añadidos.</p>`;
    return;
  }
  cont.innerHTML = contactosVen
    .map(
      (c, i) => `
        <div class="repeat-row contactos-row">
          <input placeholder="Nombre" value="${escaparAttrVen(c.nombre)}" oninput="contactosVen[${i}].nombre=this.value" />
          <input placeholder="Cargo" value="${escaparAttrVen(c.cargo)}" oninput="contactosVen[${i}].cargo=this.value" />
          <input placeholder="Teléfono" value="${escaparAttrVen(c.telefono)}" oninput="contactosVen[${i}].telefono=this.value" />
          <input placeholder="Email" value="${escaparAttrVen(c.email)}" oninput="contactosVen[${i}].email=this.value" />
          <button type="button" class="remove-row-btn" onclick="eliminarContactoVen(${i})">✕</button>
        </div>
      `
    )
    .join("");
}

function anadirContactoVen() {
  contactosVen.push({ nombre: "", cargo: "", telefono: "", email: "" });
  renderContactosVen();
}

function eliminarContactoVen(i) {
  contactosVen.splice(i, 1);
  renderContactosVen();
}

// ---------- Riders (varios PDF) ----------

function procesarRiderVen(event) {
  const archivo = event.target.files[0];
  if (!archivo) return;
  if (archivo.type !== "application/pdf") {
    mostrarToast("Solo se admiten archivos PDF.");
    return;
  }
  if (archivo.size > LIMITE_PDF_BYTES_VEN) {
    mostrarToast(`El PDF pesa ${(archivo.size / 1024).toFixed(0)} KB — intenta comprimirlo por debajo de 600 KB.`);
    return;
  }

  const lector = new FileReader();
  lector.onload = (e) => {
    ridersVen.push({ etiqueta: archivo.name.replace(/\.pdf$/i, ""), nombre: archivo.name, tamano: archivo.size, data: e.target.result });
    renderRidersVen();
    event.target.value = "";
  };
  lector.readAsDataURL(archivo);
}

function renderRidersVen() {
  const cont = document.getElementById("lista-riders-ven");
  if (ridersVen.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay riders subidos.</p>`;
    return;
  }
  cont.innerHTML = ridersVen
    .map(
      (r, i) => `
        <div class="repeat-row rider-row">
          <input placeholder="Etiqueta (Ej. Sonido, Luces…)" value="${escaparAttrVen(r.etiqueta)}" oninput="ridersVen[${i}].etiqueta=this.value" />
          <div class="pdf-chip">📄 ${escaparHtmlVenD(r.nombre)} (${(r.tamano / 1024).toFixed(0)} KB) — <a href="${r.data}" download="${escaparAttrVen(r.nombre)}" style="color:var(--color-text);">Descargar</a></div>
          <button type="button" class="remove-row-btn" onclick="eliminarRiderVen(${i})">✕</button>
        </div>
      `
    )
    .join("");
}

function eliminarRiderVen(i) {
  ridersVen.splice(i, 1);
  renderRidersVen();
}

// ---------- Tarifas ----------

function renderTarifasVen() {
  const cont = document.getElementById("lista-tarifas-ven");
  if (tarifasVen.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay tarifas añadidas.</p>`;
    return;
  }
  cont.innerHTML = tarifasVen
    .map(
      (t, i) => `
        <div class="repeat-row tarifa-row" style="grid-template-columns: 1.3fr 0.8fr 0.8fr 0.7fr auto;">
          <input placeholder="Concepto (Ej. Alquiler de sala)" value="${escaparAttrVen(t.concepto)}" oninput="tarifasVen[${i}].concepto=this.value" />
          <input type="number" min="0" step="0.01" placeholder="Importe €" value="${t.importe != null ? t.importe : ""}" oninput="tarifasVen[${i}].importe=this.value===''?null:parseFloat(this.value)" />
          <select onchange="tarifasVen[${i}].impuestos=this.value">
            <option value="sin" ${t.impuestos !== "con" ? "selected" : ""}>Sin impuestos</option>
            <option value="con" ${t.impuestos === "con" ? "selected" : ""}>Con impuestos</option>
          </select>
          <input type="number" min="0" max="100" step="0.1" placeholder="% venue taquilla" value="${t.repartoSalaPct != null ? t.repartoSalaPct : ""}" oninput="tarifasVen[${i}].repartoSalaPct=this.value===''?null:parseFloat(this.value)" title="Deja en blanco si es solo alquiler fijo, sin reparto de taquilla" />
          <button type="button" class="remove-row-btn" onclick="eliminarTarifaVen(${i})">✕</button>
        </div>
      `
    )
    .join("");
}

function anadirTarifaVen() {
  tarifasVen.push({ concepto: "", importe: null, impuestos: "sin", repartoSalaPct: null });
  renderTarifasVen();
}

function eliminarTarifaVen(i) {
  tarifasVen.splice(i, 1);
  renderTarifasVen();
}

// ---------- Taquilla compartida ----------

function toggleTaquillaVen() {
  const activo = document.getElementById("v-taquilla-activo").checked;
  document.getElementById("bloque-taquilla-ven").style.display = activo ? "block" : "none";
}

function renderTramosVen() {
  const cont = document.getElementById("lista-tramos-ven");
  if (tramosVen.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay tramos añadidos.</p>`;
    return;
  }
  cont.innerHTML = tramosVen
    .map(
      (t, i) => `
        <div class="repeat-row tramo-row">
          <input type="number" min="0" step="0.01" placeholder="Desde €" value="${t.desde != null ? t.desde : ""}" oninput="tramosVen[${i}].desde=this.value===''?null:parseFloat(this.value)" />
          <input type="number" min="0" step="0.01" placeholder="Hasta €" value="${t.hasta != null ? t.hasta : ""}" oninput="tramosVen[${i}].hasta=this.value===''?null:parseFloat(this.value)" />
          <input type="number" min="0" max="100" step="0.1" placeholder="% venue" value="${t.porcentaje != null ? t.porcentaje : ""}" oninput="tramosVen[${i}].porcentaje=this.value===''?null:parseFloat(this.value)" />
          <button type="button" class="remove-row-btn" onclick="eliminarTramoVen(${i})">✕</button>
        </div>
      `
    )
    .join("");
}

function anadirTramoVen() {
  tramosVen.push({ desde: null, hasta: null, porcentaje: null });
  renderTramosVen();
}

function eliminarTramoVen(i) {
  tramosVen.splice(i, 1);
  renderTramosVen();
}

// ---------- Guardar ----------

async function guardarVenue() {
  const btn = document.getElementById("btn-guardar-ven");
  btn.disabled = true;

  const datos = {
    nombre: document.getElementById("v-nombre").value.trim(),
    direccion: document.getElementById("v-direccion").value.trim(),
    mapsUrl: document.getElementById("v-maps").value.trim(),
    condiciones: document.getElementById("v-condiciones").value.trim(),
    notas: document.getElementById("v-notas").value.trim(),
    contactos: contactosVen,
    ridersPdf: ridersVen,
    tarifas: tarifasVen,
    tramosTaquilla: {
      activo: document.getElementById("v-taquilla-activo").checked,
      filas: tramosVen,
    },
  };

  try {
    await db.collection("venues").doc(docIdVenue).update(datos);
    document.getElementById("ven-titulo-cabecera").textContent = datos.nombre || "Venue";
    mostrarToast("Venue guardado.");
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo guardar. Puede que algún PDF sea demasiado grande.");
  } finally {
    btn.disabled = false;
  }
}

function escaparHtmlVenD(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function escaparAttrVen(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// ---------- Toast ----------

let toastTimerVenD;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerVenD);
  toastTimerVenD = setTimeout(() => t.classList.remove("show"), 3200);
}
