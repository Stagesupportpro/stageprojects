// =========================================================
// STAGE SUPPORT — roster-detalle.js
// Colección: /roster/{id} → { nombre, oficinaRepresentacion,
//   descripcionComercial, imagenCartel, logo, contactos[], redesSociales[],
//   cache, comisionPorcentaje, ivaPorcentaje (tarifa estándar),
//   tarifas[] (otros formatos), ridersPdf[], hospitalidadCondiciones,
//   hospitalidadPdf[], pressKit[], notas }
// El contrato jurídico vive aparte, en /rosterJuridico/{id}, con
// permisos exclusivos de Admin (no solo ocultado en el UI).
// =========================================================

let usuarioActualRstD = null;
let docIdRoster = null;
let contactosRst = [];
let etiquetasRst = [];
let camposExtraRst = []; // [{ titulo, descripcion }]
let redesRst = [];
let posterDataUrl = null;
let logoRstDataUrl = null;
let comisionesCache = [];
let tarifasRst = [];
let ridersRst = [];
let hospPdfsRst = [];
let pressKitRst = [];
let galeriaRst = []; // hasta 6 dataURL de fotos
let videosYoutubeRst = []; // [{ titulo, url }]
let contratoRst = [];
let clausulasEspecialesRst = [];
let juridicoyaCargado = false;

const LIMITE_PDF_BYTES = 600 * 1024;

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

  if (usuarioActualRstD.rol === "Admin") {
    document.getElementById("btn-tab-juridico").style.display = "block";
  }

  cambiarTabRoster("general");
  await cargarComisionesPreset();
  await cargarRoster();
})();

// ---------- Pestañas ----------

function cambiarTabRoster(tab) {
  document.querySelectorAll("#rst-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".rst-tab-panel").forEach((p) => p.classList.remove("active"));
  document.getElementById(`panel-${tab}`).classList.add("active");

  if (tab === "juridico" && usuarioActualRstD.rol === "Admin" && !juridicoyaCargado) {
    cargarJuridico();
  }
}

// ---------- Comisiones preset ----------

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

// ---------- Cargar ficha ----------

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
    document.getElementById("rst-descripcion").value = d.descripcionComercial || "";
    document.getElementById("rst-notas").value = d.notas || "";
    document.getElementById("rst-cache").value = d.cache != null ? d.cache : "";
    document.getElementById("rst-comision-pct").value = d.comisionPorcentaje != null ? d.comisionPorcentaje : "";
    document.getElementById("rst-iva-pct").value = d.ivaPorcentaje != null ? d.ivaPorcentaje : 21;

    posterDataUrl = d.imagenCartel || null;
    mostrarPreviewPoster(posterDataUrl);

    logoRstDataUrl = d.logo || null;
    mostrarPreviewLogoRst(logoRstDataUrl);

    document.getElementById("rst-categoria").value = d.categoria || "";
    etiquetasRst = Array.isArray(d.etiquetas) ? d.etiquetas : [];
    renderEtiquetasRst();

    camposExtraRst = Array.isArray(d.camposExtra) ? d.camposExtra : [];
    renderCamposExtraRst();

    contactosRst = Array.isArray(d.contactos) ? d.contactos : [];
    renderContactosRst();

    redesRst = Array.isArray(d.redesSociales) ? d.redesSociales : [];
    renderRedes();

    tarifasRst = Array.isArray(d.tarifas) ? d.tarifas : [];
    renderTarifasRst();

    ridersRst = Array.isArray(d.ridersPdf) ? d.ridersPdf : [];
    renderRidersRst();

    document.getElementById("rst-hosp-condiciones").value = d.hospitalidadCondiciones || "";
    hospPdfsRst = Array.isArray(d.hospitalidadPdf) ? d.hospitalidadPdf : [];
    renderHospRst();

    pressKitRst = Array.isArray(d.pressKit) ? d.pressKit : [];
    renderPressKitRst();

    galeriaRst = Array.isArray(d.galeria) ? d.galeria : [];
    renderGaleriaRst();

    videosYoutubeRst = Array.isArray(d.videosYoutube) ? d.videosYoutube : [];
    renderVideosRst();

    recalcular();
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo cargar la ficha.");
  }
}

async function cargarJuridico() {
  try {
    const snap = await db.collection("rosterJuridico").doc(docIdRoster).get();
    const datos = snap.exists ? snap.data() : {};
    contratoRst = Array.isArray(datos.contratos) ? datos.contratos : [];
    clausulasEspecialesRst = Array.isArray(datos.clausulasEspeciales) ? datos.clausulasEspeciales : [];
    juridicoyaCargado = true;
    renderContratoRst();
    renderClausulasEspecialesRst();

    const fiscal = datos.fiscal || {};
    document.getElementById("rj-razon-social").value = fiscal.razonSocial || "";
    document.getElementById("rj-nif").value = fiscal.nif || "";
    document.getElementById("rj-representante").value = fiscal.representante || "";
    document.getElementById("rj-direccion-fiscal").value = fiscal.direccion || "";
    document.getElementById("rj-email-fiscal").value = fiscal.email || "";
    document.getElementById("rj-telefono-fiscal").value = fiscal.telefono || "";
    document.getElementById("rj-iban").value = fiscal.iban || "";
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo cargar el apartado jurídico.");
  }
}

async function guardarDatosFiscalesRst() {
  try {
    await db
      .collection("rosterJuridico")
      .doc(docIdRoster)
      .set(
        {
          fiscal: {
            razonSocial: document.getElementById("rj-razon-social").value.trim(),
            nif: document.getElementById("rj-nif").value.trim(),
            representante: document.getElementById("rj-representante").value.trim(),
            direccion: document.getElementById("rj-direccion-fiscal").value.trim(),
            email: document.getElementById("rj-email-fiscal").value.trim(),
            telefono: document.getElementById("rj-telefono-fiscal").value.trim(),
            iban: document.getElementById("rj-iban").value.trim(),
          },
        },
        { merge: true }
      );
    mostrarToast("Datos fiscales guardados.");
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudieron guardar los datos fiscales.");
  }
}

function renderClausulasEspecialesRst() {
  const cont = document.getElementById("lista-clausulas-esp-rst");
  if (clausulasEspecialesRst.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay cláusulas especiales para este artista.</p>`;
    return;
  }
  cont.innerHTML = clausulasEspecialesRst
    .map(
      (c, i) => `
        <div class="clausula-card">
          <div class="clausula-top">
            <input placeholder="Título de la cláusula" value="${escaparAttrRst(c.titulo)}" oninput="clausulasEspecialesRst[${i}].titulo=this.value" />
            <button type="button" class="remove-row-btn" onclick="eliminarClausulaEspecialRst(${i})">✕</button>
          </div>
          <textarea placeholder="Texto de la cláusula…" oninput="clausulasEspecialesRst[${i}].texto=this.value">${escaparHtmlRstD(c.texto)}</textarea>
        </div>
      `
    )
    .join("");
}

async function anadirClausulaEspecialRst() {
  clausulasEspecialesRst.push({ titulo: "", texto: "" });
  renderClausulasEspecialesRst();
  await guardarClausulasEspecialesRst();
}

async function eliminarClausulaEspecialRst(i) {
  clausulasEspecialesRst.splice(i, 1);
  renderClausulasEspecialesRst();
  await guardarClausulasEspecialesRst();
}

async function guardarClausulasEspecialesRst() {
  try {
    await db.collection("rosterJuridico").doc(docIdRoster).set({ clausulasEspeciales: clausulasEspecialesRst }, { merge: true });
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudieron guardar las cláusulas especiales.");
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

// ---------- Etiquetas ----------

function renderEtiquetasRst() {
  const cont = document.getElementById("lista-etiquetas-rst");
  if (etiquetasRst.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px; margin:0;">Sin etiquetas todavía.</p>`;
    return;
  }
  cont.innerHTML = etiquetasRst
    .map(
      (e, i) => `
        <span class="tag-chip">${escaparHtmlRstD(e)}<button type="button" onclick="eliminarEtiquetaRst(${i})" title="Quitar">✕</button></span>
      `
    )
    .join("");
}

function anadirEtiquetaRst() {
  const input = document.getElementById("rst-etiqueta-input");
  const valor = input.value.trim();
  if (!valor) return;
  if (!etiquetasRst.includes(valor)) etiquetasRst.push(valor);
  input.value = "";
  renderEtiquetasRst();
}

function eliminarEtiquetaRst(i) {
  etiquetasRst.splice(i, 1);
  renderEtiquetasRst();
}

// ---------- Campos adicionales (título + descripción) ----------

function renderCamposExtraRst() {
  const cont = document.getElementById("lista-campos-extra-rst");
  if (camposExtraRst.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay campos adicionales.</p>`;
    return;
  }
  cont.innerHTML = camposExtraRst
    .map(
      (c, i) => `
        <div class="repeat-row campo-extra-row">
          <input placeholder="Título (Ej. Fecha de estreno)" value="${escaparAttrRstD(c.titulo)}" oninput="camposExtraRst[${i}].titulo=this.value" />
          <input placeholder="Descripción (Ej. 29-10-2023)" value="${escaparAttrRstD(c.descripcion)}" oninput="camposExtraRst[${i}].descripcion=this.value" />
          <button type="button" class="remove-row-btn" onclick="eliminarCampoExtraRst(${i})">✕</button>
        </div>
      `
    )
    .join("");
}

function anadirCampoExtraRst() {
  camposExtraRst.push({ titulo: "", descripcion: "" });
  renderCamposExtraRst();
}

function eliminarCampoExtraRst(i) {
  camposExtraRst.splice(i, 1);
  renderCamposExtraRst();
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
        <div class="repeat-row rider-row">
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

// ---------- Calculadora (tarifa estándar) ----------

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

// ---------- Otras tarifas / formatos ----------

function renderTarifasRst() {
  const cont = document.getElementById("lista-tarifas-rst");
  if (tarifasRst.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay tarifas adicionales.</p>`;
    return;
  }
  cont.innerHTML = tarifasRst
    .map((t, i) => {
      const pvp = (t.coste || 0) * (1 + (t.comisionPct || 0) / 100);
      return `
        <div class="repeat-row tarifa-row">
          <input placeholder="Concepto (Ej. Showcase acústico)" value="${escaparAttrRst(t.concepto)}" oninput="tarifasRst[${i}].concepto=this.value" />
          <input type="number" min="0" step="0.01" placeholder="Coste €" value="${t.coste != null ? t.coste : ""}" oninput="tarifasRst[${i}].coste=this.value===''?null:parseFloat(this.value); actualizarPvpTarifa(${i})" />
          <input type="number" min="0" max="100" step="0.1" placeholder="Comisión %" value="${t.comisionPct != null ? t.comisionPct : ""}" oninput="tarifasRst[${i}].comisionPct=this.value===''?null:parseFloat(this.value); actualizarPvpTarifa(${i})" />
          <button type="button" class="remove-row-btn" onclick="eliminarTarifaRst(${i})">✕</button>
        </div>
        <div style="font-size:12px; color:var(--color-text-muted); margin:-4px 0 10px 2px;" id="pvp-tarifa-${i}">PVP: ${formatoEuro(pvp)}</div>
      `;
    })
    .join("");
}

function actualizarPvpTarifa(i) {
  const t = tarifasRst[i];
  const pvp = (t.coste || 0) * (1 + (t.comisionPct || 0) / 100);
  const el = document.getElementById(`pvp-tarifa-${i}`);
  if (el) el.textContent = `PVP: ${formatoEuro(pvp)}`;
}

function anadirTarifaRst() {
  tarifasRst.push({ concepto: "", coste: null, comisionPct: null });
  renderTarifasRst();
}

function eliminarTarifaRst(i) {
  tarifasRst.splice(i, 1);
  renderTarifasRst();
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

// ---------- Riders (varios PDF) ----------

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
    ridersRst.push({ etiqueta: archivo.name.replace(/\.pdf$/i, ""), nombre: archivo.name, tamano: archivo.size, data: e.target.result });
    renderRidersRst();
    event.target.value = "";
  };
  lector.readAsDataURL(archivo);
}

function renderRidersRst() {
  const cont = document.getElementById("lista-riders-rst");
  if (ridersRst.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay riders subidos.</p>`;
    return;
  }
  cont.innerHTML = ridersRst
    .map(
      (r, i) => `
        <div class="repeat-row rider-row">
          <input placeholder="Etiqueta (Ej. Sonido, Luces…)" value="${escaparAttrRst(r.etiqueta)}" oninput="ridersRst[${i}].etiqueta=this.value" />
          <div class="pdf-chip">📄 ${escaparHtmlRstD(r.nombre)} (${(r.tamano / 1024).toFixed(0)} KB) — <a href="${r.data}" download="${escaparAttrRst(r.nombre)}" style="color:var(--color-text);">Descargar</a></div>
          <button type="button" class="remove-row-btn" onclick="eliminarRiderRst(${i})">✕</button>
        </div>
      `
    )
    .join("");
}

function eliminarRiderRst(i) {
  ridersRst.splice(i, 1);
  renderRidersRst();
}

// ---------- Hospitalidad ----------

function procesarHospPdf(event) {
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
    hospPdfsRst.push({ etiqueta: archivo.name.replace(/\.pdf$/i, ""), nombre: archivo.name, tamano: archivo.size, data: e.target.result });
    renderHospRst();
    event.target.value = "";
  };
  lector.readAsDataURL(archivo);
}

function renderHospRst() {
  const cont = document.getElementById("lista-hosp-rst");
  if (hospPdfsRst.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay PDF de hospitalidad.</p>`;
    return;
  }
  cont.innerHTML = hospPdfsRst
    .map(
      (r, i) => `
        <div class="repeat-row rider-row">
          <input placeholder="Etiqueta" value="${escaparAttrRst(r.etiqueta)}" oninput="hospPdfsRst[${i}].etiqueta=this.value" />
          <div class="pdf-chip">📄 ${escaparHtmlRstD(r.nombre)} (${(r.tamano / 1024).toFixed(0)} KB) — <a href="${r.data}" download="${escaparAttrRst(r.nombre)}" style="color:var(--color-text);">Descargar</a></div>
          <button type="button" class="remove-row-btn" onclick="eliminarHospRst(${i})">✕</button>
        </div>
      `
    )
    .join("");
}

function eliminarHospRst(i) {
  hospPdfsRst.splice(i, 1);
  renderHospRst();
}

// ---------- PressKit (imágenes o PDF) ----------

function procesarPressKit(event) {
  const archivo = event.target.files[0];
  if (!archivo) return;
  const esImagen = archivo.type.startsWith("image/");
  const esPdf = archivo.type === "application/pdf";
  if (!esImagen && !esPdf) {
    mostrarToast("Solo se admiten imágenes o PDF.");
    return;
  }

  if (esImagen) {
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
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        pressKitRst.push({ tipo: "imagen", nombre: archivo.name, tamano: dataUrl.length, data: dataUrl });
        renderPressKitRst();
        event.target.value = "";
      };
      img.src = e.target.result;
    };
    lector.readAsDataURL(archivo);
  } else {
    if (archivo.size > LIMITE_PDF_BYTES) {
      mostrarToast(`El PDF pesa ${(archivo.size / 1024).toFixed(0)} KB — intenta comprimirlo por debajo de 600 KB.`);
      return;
    }
    const lector = new FileReader();
    lector.onload = (e) => {
      pressKitRst.push({ tipo: "pdf", nombre: archivo.name, tamano: archivo.size, data: e.target.result });
      renderPressKitRst();
      event.target.value = "";
    };
    lector.readAsDataURL(archivo);
  }
}

function renderPressKitRst() {
  const cont = document.getElementById("lista-presskit-rst");
  if (pressKitRst.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay archivos de prensa.</p>`;
    return;
  }
  cont.innerHTML = pressKitRst
    .map((p, i) => {
      const thumb = p.tipo === "imagen" ? `<img class="press-thumb" src="${p.data}" alt="" />` : `<div class="press-thumb" style="display:flex; align-items:center; justify-content:center;">📄</div>`;
      return `
        <div class="press-item">
          ${thumb}
          <div class="press-name">${escaparHtmlRstD(p.nombre)}</div>
          <a href="${p.data}" download="${escaparAttrRst(p.nombre)}" class="btn-ghost" style="text-decoration:none; padding:6px 12px; font-size:12px;">Descargar</a>
          <button type="button" class="icon-btn danger" onclick="eliminarPressKit(${i})" title="Quitar">✕</button>
        </div>
      `;
    })
    .join("");
}

function eliminarPressKit(i) {
  pressKitRst.splice(i, 1);
  renderPressKitRst();
}

// ---------- Medios: galería (hasta 6 fotos) ----------

function renderGaleriaRst() {
  const cont = document.getElementById("galeria-rst");
  const huecos = [];
  for (let i = 0; i < 6; i++) {
    const foto = galeriaRst[i];
    huecos.push(`
      <div class="galeria-slot" onclick="${foto ? "" : `document.getElementById('galeria-input-${i}').click()`}">
        ${
          foto
            ? `<img src="${foto}" alt="" /><button type="button" class="galeria-quitar" onclick="event.stopPropagation(); eliminarFotoGaleriaRst(${i})" title="Quitar">✕</button>`
            : `<span class="galeria-vacio">+ Añadir foto</span>`
        }
        <input type="file" id="galeria-input-${i}" accept="image/*" style="display:none;" onchange="procesarFotoGaleriaRst(${i}, event)" />
      </div>
    `);
  }
  cont.innerHTML = huecos.join("");
}

function procesarFotoGaleriaRst(i, event) {
  const archivo = event.target.files[0];
  if (!archivo || !archivo.type.startsWith("image/")) return;

  const lector = new FileReader();
  lector.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 700;
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
      galeriaRst[i] = canvas.toDataURL("image/jpeg", 0.82);
      renderGaleriaRst();
    };
    img.src = e.target.result;
  };
  lector.readAsDataURL(archivo);
}

function eliminarFotoGaleriaRst(i) {
  galeriaRst[i] = null;
  galeriaRst = galeriaRst.filter((f) => f); // compacta el array, sin huecos sueltos
  renderGaleriaRst();
}

// ---------- Medios: vídeos de YouTube ----------

function extraerIdYoutube(url) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function renderVideosRst() {
  const cont = document.getElementById("lista-videos-rst");
  if (videosYoutubeRst.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay vídeos añadidos.</p>`;
    return;
  }
  cont.innerHTML = videosYoutubeRst
    .map(
      (v, i) => `
        <div class="repeat-row video-row">
          <input placeholder="Título (opcional)" value="${escaparAttrRstD(v.titulo)}" oninput="videosYoutubeRst[${i}].titulo=this.value" />
          <input placeholder="Enlace de YouTube" value="${escaparAttrRstD(v.url)}" oninput="videosYoutubeRst[${i}].url=this.value" onblur="actualizarMiniaturaVideoRst(${i})" />
          <button type="button" class="remove-row-btn" onclick="eliminarVideoRst(${i})">✕</button>
        </div>
        <div id="video-thumb-${i}" style="margin:6px 0 12px;">${miniaturaVideoRstHtml(videosYoutubeRst[i])}</div>
      `
    )
    .join("");
}

function miniaturaVideoRstHtml(v) {
  const idYt = extraerIdYoutube(v.url);
  return idYt
    ? `<a class="video-thumb-link" href="${escaparAttrRstD(v.url)}" target="_blank" style="max-width:220px;"><img src="https://img.youtube.com/vi/${idYt}/hqdefault.jpg" alt="" /><span class="play-badge">▶</span></a>`
    : "";
}

function actualizarMiniaturaVideoRst(i) {
  const el = document.getElementById(`video-thumb-${i}`);
  if (el) el.innerHTML = miniaturaVideoRstHtml(videosYoutubeRst[i]);
}

function anadirVideoRst() {
  videosYoutubeRst.push({ titulo: "", url: "" });
  renderVideosRst();
}

function eliminarVideoRst(i) {
  videosYoutubeRst.splice(i, 1);
  renderVideosRst();
}

// ---------- Jurídico (Admin, colección aparte) ----------

function procesarContratoPdf(event) {
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
  lector.onload = async (e) => {
    contratoRst.push({ nombre: archivo.name, tamano: archivo.size, data: e.target.result, subidoEl: new Date().toISOString() });
    renderContratoRst();
    event.target.value = "";
    try {
      await db.collection("rosterJuridico").doc(docIdRoster).set({ contratos: contratoRst }, { merge: true });
      mostrarToast("Contrato guardado (solo visible para Admin).");
    } catch (err) {
      console.error(err);
      mostrarToast("No se pudo guardar el contrato.");
    }
  };
  lector.readAsDataURL(archivo);
}

function renderContratoRst() {
  const cont = document.getElementById("lista-contrato-rst");
  if (contratoRst.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay contratos subidos.</p>`;
    return;
  }
  cont.innerHTML = contratoRst
    .map(
      (c, i) => `
        <div class="repeat-row rider-row">
          <div class="pdf-chip">📄 ${escaparHtmlRstD(c.nombre)} (${(c.tamano / 1024).toFixed(0)} KB) — <a href="${c.data}" download="${escaparAttrRst(c.nombre)}" style="color:var(--color-text);">Descargar</a></div>
          <div></div>
          <button type="button" class="remove-row-btn" onclick="eliminarContratoRst(${i})">✕</button>
        </div>
      `
    )
    .join("");
}

async function eliminarContratoRst(i) {
  contratoRst.splice(i, 1);
  renderContratoRst();
  try {
    await db.collection("rosterJuridico").doc(docIdRoster).set({ contratos: contratoRst }, { merge: true });
  } catch (err) {
    console.error(err);
  }
}

// ---------- Guardar (ficha general — no incluye Jurídico) ----------

async function guardarRoster() {
  const btn = document.getElementById("btn-guardar-rst");
  btn.disabled = true;

  const datos = {
    nombre: document.getElementById("rst-nombre").value.trim(),
    oficinaRepresentacion: document.getElementById("rst-oficina").value.trim(),
    descripcionComercial: document.getElementById("rst-descripcion").value.trim(),
    notas: document.getElementById("rst-notas").value.trim(),
    cache: parseFloat(document.getElementById("rst-cache").value) || 0,
    comisionPorcentaje: parseFloat(document.getElementById("rst-comision-pct").value) || 0,
    ivaPorcentaje: parseFloat(document.getElementById("rst-iva-pct").value) || 0,
    imagenCartel: posterDataUrl,
    logo: logoRstDataUrl,
    categoria: document.getElementById("rst-categoria").value,
    etiquetas: etiquetasRst,
    camposExtra: camposExtraRst.filter((c) => c.titulo || c.descripcion),
    contactos: contactosRst,
    redesSociales: redesRst,
    tarifas: tarifasRst,
    ridersPdf: ridersRst,
    hospitalidadCondiciones: document.getElementById("rst-hosp-condiciones").value.trim(),
    hospitalidadPdf: hospPdfsRst,
    pressKit: pressKitRst,
    galeria: galeriaRst.filter((f) => f),
    videosYoutube: videosYoutubeRst.filter((v) => v.url),
  };

  try {
    await db.collection("roster").doc(docIdRoster).update(datos);
    document.getElementById("rst-titulo-cabecera").textContent = datos.nombre || "Espectáculo";
    mostrarToast("Ficha guardada.");
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo guardar. Puede que algún archivo sea demasiado grande.");
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
