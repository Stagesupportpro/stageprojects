// =========================================================
// STAGE SUPPORT — venue-detalle.js
// Colección: /venues/{id} → { nombre, direccion, mapsUrl, contactos[],
//   ridersPdf[], condiciones, tarifas[] (modalidades), notas }
// Cada modalidad: { concepto, importe, taquillaCompartida, pctVenue, pctPromotor }
// =========================================================

let usuarioActualVenD = null;
let docIdVenue = null;
let contactosVen = [];
let ridersVen = []; // [{ etiqueta, nombre, tamano, data }]
let tarifasVen = []; // [{ concepto, importe, taquillaCompartida: bool, pctVenue, pctPromotor }]
let segmentosAforoVen = []; // [{ nombre, capacidad }]

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

    const aforo = d.aforo || { tipo: "total", total: null, segmentos: [] };
    document.querySelector(`input[name="v-aforo-tipo"][value="${aforo.tipo || "total"}"]`).checked = true;
    document.getElementById("v-aforo-total").value = aforo.total != null ? aforo.total : "";
    segmentosAforoVen = Array.isArray(aforo.segmentos) ? aforo.segmentos : [];
    alCambiarTipoAforoVen();
    renderSegmentosAforoVen();
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
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay modalidades añadidas.</p>`;
    return;
  }
  cont.innerHTML = tarifasVen
    .map((t, i) => {
      const activo = !!t.taquillaCompartida;
      return `
        <div class="modalidad-card">
          <div class="repeat-row modalidad-top">
            <input placeholder="Nombre de la modalidad (Ej. Modalidad 1)" value="${escaparAttrVen(t.concepto)}" oninput="tarifasVen[${i}].concepto=this.value" />
            <input type="number" min="0" step="0.01" placeholder="Importe alquiler €" value="${t.importe != null ? t.importe : ""}" oninput="tarifasVen[${i}].importe=this.value===''?null:parseFloat(this.value)" />
            <div></div>
            <button type="button" class="remove-row-btn" onclick="eliminarTarifaVen(${i})">✕</button>
          </div>
          <label class="taquilla-toggle">
            <input type="checkbox" ${activo ? "checked" : ""} onchange="tarifasVen[${i}].taquillaCompartida=this.checked; renderTarifasVen()" />
            Aplica taquilla compartida
          </label>
          ${
            activo
              ? `
                <div class="form-grid taquilla-pcts">
                  <div class="field"><label>% Promotor</label><input type="number" min="0" max="100" step="0.1" value="${t.pctPromotor != null ? t.pctPromotor : ""}" oninput="tarifasVen[${i}].pctPromotor=this.value===''?null:parseFloat(this.value)" /></div>
                  <div class="field"><label>% Venue</label><input type="number" min="0" max="100" step="0.1" value="${t.pctVenue != null ? t.pctVenue : ""}" oninput="tarifasVen[${i}].pctVenue=this.value===''?null:parseFloat(this.value)" /></div>
                </div>
              `
              : ""
          }
        </div>
      `;
    })
    .join("");
}

function anadirTarifaVen() {
  tarifasVen.push({ concepto: "", importe: null, taquillaCompartida: false, pctVenue: null, pctPromotor: null });
  renderTarifasVen();
}

function eliminarTarifaVen(i) {
  tarifasVen.splice(i, 1);
  renderTarifasVen();
}

// ---------- Aforo ----------

function alCambiarTipoAforoVen() {
  const tipo = document.querySelector('input[name="v-aforo-tipo"]:checked').value;
  document.getElementById("campo-aforo-total").style.display = tipo === "total" ? "block" : "none";
  document.getElementById("bloque-aforo-segmentado").style.display = tipo === "segmentado" ? "block" : "none";
}

function renderSegmentosAforoVen() {
  const cont = document.getElementById("lista-aforo-segmentos");
  if (segmentosAforoVen.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay segmentos añadidos.</p>`;
  } else {
    cont.innerHTML = segmentosAforoVen
      .map(
        (s, i) => `
          <div class="repeat-row segmento-row">
            <input placeholder="Nombre del segmento (Ej. Platea, Grada, VIP…)" value="${escaparAttrVen(s.nombre)}" oninput="segmentosAforoVen[${i}].nombre=this.value" />
            <input type="number" min="0" step="1" placeholder="Capacidad" value="${s.capacidad != null ? s.capacidad : ""}" oninput="segmentosAforoVen[${i}].capacidad=this.value===''?null:parseInt(this.value,10); actualizarTotalSegmentosVen()" />
            <button type="button" class="remove-row-btn" onclick="eliminarSegmentoAforoVen(${i})">✕</button>
          </div>
        `
      )
      .join("");
  }
  actualizarTotalSegmentosVen();
}

function actualizarTotalSegmentosVen() {
  const total = segmentosAforoVen.reduce((sum, s) => sum + (s.capacidad || 0), 0);
  document.getElementById("v-aforo-total-segmentado").textContent = total;
}

function anadirSegmentoAforoVen() {
  segmentosAforoVen.push({ nombre: "", capacidad: null });
  renderSegmentosAforoVen();
}

function eliminarSegmentoAforoVen(i) {
  segmentosAforoVen.splice(i, 1);
  renderSegmentosAforoVen();
}

// ---------- Guardar ----------

async function guardarVenue() {
  const btn = document.getElementById("btn-guardar-ven");
  btn.disabled = true;

  const tipoAforo = document.querySelector('input[name="v-aforo-tipo"]:checked').value;

  const datos = {
    nombre: document.getElementById("v-nombre").value.trim(),
    direccion: document.getElementById("v-direccion").value.trim(),
    mapsUrl: document.getElementById("v-maps").value.trim(),
    condiciones: document.getElementById("v-condiciones").value.trim(),
    notas: document.getElementById("v-notas").value.trim(),
    contactos: contactosVen,
    ridersPdf: ridersVen,
    tarifas: tarifasVen,
    aforo: {
      tipo: tipoAforo,
      total: tipoAforo === "total" ? parseInt(document.getElementById("v-aforo-total").value, 10) || null : null,
      segmentos: tipoAforo === "segmentado" ? segmentosAforoVen : [],
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
