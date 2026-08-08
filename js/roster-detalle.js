// =========================================================
// STAGE SUPPORT — roster-detalle.js
// =========================================================

let usuarioActualRstD = null;
let docIdRoster = null;
let contactosRst = [];
let redesRst = [];
let posterDataUrl = null;
let logoRstDataUrl = null;
let riderPdf = null; // { nombre, tamano, data }
let comisionesCache = [];

(async function () {
  const params = new URLSearchParams(window.location.search);
  docIdRoster = params.get("id");
  if (!docIdRoster) {
    window.location.href = "roster.html";
    return;
  }

  usuarioActualRstD = await protegerPagina(["Comercial", "Admin"]);
  pintarNav(usuarioActualRstD.rol, "roster");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualRstD) || usuarioActualRstD.email;
  document.getElementById("pass-role").textContent = usuarioActualRstD.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualRstD.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualRstD.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualRstD) || usuarioActualRstD.email);
  }

  await cargarComisionesPreset();
  await cargarRoster();
})();

async function cargarComisionesPreset() {
  const sel = document.getElementById("rst-comision-preset");
  try {
    const snap = await db.collection("comisiones").orderBy("nombre").get();
    comisionesCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const opciones = comisionesCache.map((c) => `<option value="${c.id}">${escaparHtmlRstD(c.nombre)} (${c.porcentaje}%)</option>`).join("");
    sel.innerHTML = `<option value="">— Manual —</option>${opciones}`;
  } catch (err) {
    console.error(err);
  }
}

function aplicarComisionPreset() {
  const id = document.getElementById("rst-comision-preset").value;
  const preset = comisionesCache.find((c) => c.id === id);
  if (preset) {
    document.getElementById("rst-comision-pct").value = preset.porcentaje;
    recalcular();
  }
}

async function cargarRoster() {
  try {
    const snap = await db.collection("roster").doc(docIdRoster).get();
    if (!snap.exists) {
      mostrarToast("Este espectáculo no existe.");
      setTimeout(() => (window.location.href = "roster.html"), 1500);
      return;
    }
    const d = snap.data();

    document.getElementById("rst-titulo-cabecera").textContent = d.nombre || "Espectáculo";
    document.getElementById("rst-nombre").value = d.nombre || "";
    document.getElementById("rst-oficina").value = d.oficinaRepresentacion || "";
    document.getElementById("rst-notas").value = d.notas || "";
    document.getElementById("rst-cache").value = d.cache != null ? d.cache : "";
    document.getElementById("rst-comision-pct").value = d.comisionPorcentaje != null ? d.comisionPorcentaje : "";
    document.getElementById("rst-iva-pct").value = d.ivaPorcentaje != null ? d.ivaPorcentaje : 21;

    posterDataUrl = d.imagenCartel || null;
    mostrarPreviewPoster(posterDataUrl);

    logoRstDataUrl = d.logo || null;
    mostrarPreviewLogoRst(logoRstDataUrl);

    riderPdf = d.riderPdf || null;
    pintarRiderChip();

    contactosRst = Array.isArray(d.contactos) ? d.contactos : [];
    renderContactosRst();

    redesRst = Array.isArray(d.redesSociales) ? d.redesSociales : [];
    renderRedes();

    recalcular();
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo cargar la ficha.");
  }
}

// ---------- Contactos ----------

function renderContactosRst() {
  const cont = document.getElementById("lista-contactos-rst");
  if (contactosRst.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay contactos añadidos.</p>`;
    return;
  }
  cont.innerHTML = contactosRst
    .map(
      (c, i) => `
        <div class="repeat-row contactos-row">
          <input placeholder="Nombre" value="${escaparAttrRst(c.nombre)}" oninput="contactosRst[${i}].nombre=this.value" />
          <input placeholder="Cargo" value="${escaparAttrRst(c.cargo)}" oninput="contactosRst[${i}].cargo=this.value" />
          <input placeholder="Teléfono" value="${escaparAttrRst(c.telefono)}" oninput="contactosRst[${i}].telefono=this.value" />
          <input placeholder="Email" value="${escaparAttrRst(c.email)}" oninput="contactosRst[${i}].email=this.value" />
          <button type="button" class="remove-row-btn" onclick="eliminarContactoRst(${i})">✕</button>
        </div>
      `
    )
    .join("");
}

function anadirContactoRst() {
  contactosRst.push({ nombre: "", cargo: "", telefono: "", email: "" });
  renderContactosRst();
}

function eliminarContactoRst(i) {
  contactosRst.splice(i, 1);
  renderContactosRst();
}

// ---------- Redes sociales ----------

function renderRedes() {
  const cont = document.getElementById("lista-redes");
  if (redesRst.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay redes añadidas.</p>`;
    return;
  }
  cont.innerHTML = redesRst
    .map(
      (r, i) => `
        <div class="repeat-row" style="grid-template-columns: 1fr 2fr auto;">
          <input placeholder="Plataforma (Instagram, Web…)" value="${escaparAttrRst(r.plataforma)}" oninput="redesRst[${i}].plataforma=this.value" />
          <input placeholder="URL" value="${escaparAttrRst(r.url)}" oninput="redesRst[${i}].url=this.value" />
          <button type="button" class="remove-row-btn" onclick="eliminarRed(${i})">✕</button>
        </div>
      `
    )
    .join("");
}

function anadirRed() {
  redesRst.push({ plataforma: "", url: "" });
  renderRedes();
}

function eliminarRed(i) {
  redesRst.splice(i, 1);
  renderRedes();
}

// ---------- Calculadora ----------

function formatoEuro(n) {
  return Number(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function recalcular() {
  const cache = parseFloat(document.getElementById("rst-cache").value) || 0;
  const comisionPct = parseFloat(document.getElementById("rst-comision-pct").value) || 0;
  const ivaPct = parseFloat(document.getElementById("rst-iva-pct").value) || 0;

  const comisionImporte = cache * (comisionPct / 100);
  const total = cache + comisionImporte;
  const ivaImporte = total * (ivaPct / 100);
  const totalConIva = total + ivaImporte;

  document.getElementById("calc-cache").textContent = formatoEuro(cache);
  document.getElementById("calc-comision").textContent = formatoEuro(comisionImporte);
  document.getElementById("calc-total").textContent = formatoEuro(total);
  document.getElementById("calc-total-iva").textContent = formatoEuro(totalConIva);
}

// ---------- Cartel ----------

function procesarPoster(event) {
  const archivo = event.target.files[0];
  if (!archivo || !archivo.type.startsWith("image/")) return;

  const lector = new FileReader();
  lector.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 600;
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
      posterDataUrl = canvas.toDataURL("image/jpeg", 0.8);
      mostrarPreviewPoster(posterDataUrl);
    };
    img.src = e.target.result;
  };
  lector.readAsDataURL(archivo);
}

function mostrarPreviewPoster(dataUrl) {
  const preview = document.getElementById("poster-preview");
  const btnQuitar = document.getElementById("btn-quitar-poster");
  if (dataUrl) {
    preview.innerHTML = `<img src="${dataUrl}" alt="" />`;
    btnQuitar.style.display = "inline-flex";
  } else {
    preview.textContent = "Sin imagen";
    btnQuitar.style.display = "none";
  }
}

function quitarPoster() {
  posterDataUrl = null;
  document.getElementById("poster-input").value = "";
  mostrarPreviewPoster(null);
}

// ---------- Logo ----------

function procesarLogoRst(event) {
  const archivo = event.target.files[0];
  if (!archivo || !archivo.type.startsWith("image/")) return;

  const lector = new FileReader();
  lector.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 260;
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
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      // PNG para conservar la transparencia
      logoRstDataUrl = canvas.toDataURL("image/png");
      mostrarPreviewLogoRst(logoRstDataUrl);
    };
    img.src = e.target.result;
  };
  lector.readAsDataURL(archivo);
}

function mostrarPreviewLogoRst(dataUrl) {
  const preview = document.getElementById("logo-rst-preview");
  const btnQuitar = document.getElementById("btn-quitar-logo-rst");
  if (dataUrl) {
    preview.innerHTML = `<img src="${dataUrl}" alt="" />`;
    btnQuitar.style.display = "inline-flex";
  } else {
    preview.textContent = "Sin logo";
    btnQuitar.style.display = "none";
  }
}

function quitarLogoRst() {
  logoRstDataUrl = null;
  document.getElementById("logo-rst-input").value = "";
  mostrarPreviewLogoRst(null);
}

// ---------- Rider PDF ----------

const LIMITE_PDF_BYTES = 600 * 1024;

function procesarRiderPdf(event) {
  const archivo = event.target.files[0];
  if (!archivo) return;
  if (archivo.type !== "application/pdf") {
    mostrarToast("Solo se admiten archivos PDF.");
    return;
  }
  if (archivo.size > LIMITE_PDF_BYTES) {
    mostrarToast(`El PDF pesa ${(archivo.size / 1024).toFixed(0)} KB — intenta comprimirlo por debajo de 600 KB.`);
    return;
  }

  const lector = new FileReader();
  lector.onload = (e) => {
    riderPdf = { nombre: archivo.name, tamano: archivo.size, data: e.target.result };
    pintarRiderChip();
  };
  lector.readAsDataURL(archivo);
}

function pintarRiderChip() {
  const cont = document.getElementById("rider-chip");
  if (!riderPdf) {
    cont.innerHTML = "";
    return;
  }
  cont.innerHTML = `
    <div class="pdf-chip">
      📄 ${escaparHtmlRstD(riderPdf.nombre)} (${(riderPdf.tamano / 1024).toFixed(0)} KB)
      <a href="${riderPdf.data}" download="${escaparAttrRst(riderPdf.nombre)}" style="color:var(--color-text);">Descargar</a>
      <button type="button" class="icon-btn danger" onclick="quitarRiderPdf()" title="Quitar">✕</button>
    </div>
  `;
}

function quitarRiderPdf() {
  riderPdf = null;
  document.getElementById("rider-input").value = "";
  pintarRiderChip();
}

// ---------- Guardar ----------

async function guardarRoster() {
  const btn = document.getElementById("btn-guardar-rst");
  btn.disabled = true;

  const datos = {
    nombre: document.getElementById("rst-nombre").value.trim(),
    oficinaRepresentacion: document.getElementById("rst-oficina").value.trim(),
    notas: document.getElementById("rst-notas").value.trim(),
    cache: parseFloat(document.getElementById("rst-cache").value) || 0,
    comisionPorcentaje: parseFloat(document.getElementById("rst-comision-pct").value) || 0,
    ivaPorcentaje: parseFloat(document.getElementById("rst-iva-pct").value) || 0,
    imagenCartel: posterDataUrl,
    logo: logoRstDataUrl,
    riderPdf: riderPdf,
    contactos: contactosRst,
    redesSociales: redesRst,
  };

  try {
    await db.collection("roster").doc(docIdRoster).update(datos);
    document.getElementById("rst-titulo-cabecera").textContent = datos.nombre || "Espectáculo";
    mostrarToast("Ficha guardada.");
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo guardar. Puede que el PDF o la imagen sean demasiado grandes.");
  } finally {
    btn.disabled = false;
  }
}

function escaparHtmlRstD(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function escaparAttrRst(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// ---------- Toast ----------

let toastTimerRstD;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerRstD);
  toastTimerRstD = setTimeout(() => t.classList.remove("show"), 3200);
}
