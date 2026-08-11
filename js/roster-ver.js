// =========================================================
// STAGE SUPPORT — roster-ver.js
// =========================================================

let usuarioActualRV = null;
let docIdRV = null;

(async function () {
  const params = new URLSearchParams(window.location.search);
  docIdRV = params.get("id");
  if (!docIdRV) {
    window.location.href = "roster.html";
    return;
  }

  usuarioActualRV = await protegerPagina(["Comercial", "Admin"]);
  pintarNav(usuarioActualRV.rol, "roster");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualRV) || usuarioActualRV.email;
  document.getElementById("pass-role").textContent = usuarioActualRV.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualRV.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualRV.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualRV) || usuarioActualRV.email);
  }

  document.getElementById("rv-link-editar").href = `roster-detalle.html?id=${docIdRV}`;

  if (usuarioActualRV.rol === "Admin") {
    document.getElementById("rv-btn-tab-juridico").style.display = "block";
  }

  await cargarRV();
})();

function cambiarTabVer(tab) {
  document.querySelectorAll("#rv-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".rst-tab-panel").forEach((p) => p.classList.remove("active"));
  document.getElementById(`rv-panel-${tab}`).classList.add("active");

  if (tab === "juridico" && usuarioActualRV.rol === "Admin" && !juridicoCargadoRV) {
    cargarJuridicoRV();
  }
}

let juridicoCargadoRV = false;

function formatoEuroRV(n) {
  return Number(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function escaparHtmlRV(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

async function cargarRV() {
  try {
    const snap = await db.collection("roster").doc(docIdRV).get();
    if (!snap.exists) {
      mostrarToast("Este espectáculo no existe.");
      setTimeout(() => (window.location.href = "roster.html"), 1500);
      return;
    }
    const d = snap.data();

    document.getElementById("rv-titulo-cabecera").textContent = d.nombre || "Espectáculo";

    const poster = document.getElementById("rv-poster");
    poster.innerHTML = d.imagenCartel ? `<img src="${d.imagenCartel}" alt="" />` : "Sin imagen";

    document.getElementById("rv-categoria").textContent = d.categoria || "—";
    const etiquetas = Array.isArray(d.etiquetas) ? d.etiquetas : [];
    document.getElementById("rv-etiquetas").innerHTML = etiquetas.length
      ? etiquetas.map((e) => `<span class="permiso-tag" style="margin-right:4px;">${escaparHtmlRV(e)}</span>`).join("")
      : "—";
    document.getElementById("rv-oficina").textContent = d.oficinaRepresentacion || "—";
    document.getElementById("rv-descripcion").textContent = d.descripcionComercial || "—";
    document.getElementById("rv-notas").textContent = d.notas || "—";

    const contactos = Array.isArray(d.contactos) ? d.contactos : [];
    document.getElementById("rv-contactos").innerHTML = contactos.length
      ? contactos.map((c) => `<div class="ver-field-row"><div class="ver-label">${escaparHtmlRV(c.cargo || "Contacto")}</div><div>${escaparHtmlRV(c.nombre)} — ${escaparHtmlRV(c.telefono || "")} ${escaparHtmlRV(c.email || "")}</div></div>`).join("")
      : `<p style="color:var(--color-text-muted); font-size:13px;">Sin contactos.</p>`;

    const redes = Array.isArray(d.redesSociales) ? d.redesSociales : [];
    document.getElementById("rv-redes").innerHTML = redes.length
      ? redes.map((r) => `<div class="ver-field-row"><div class="ver-label">${escaparHtmlRV(r.plataforma)}</div><div><a href="${r.url}" target="_blank" rel="noopener">${escaparHtmlRV(r.url)}</a></div></div>`).join("")
      : `<p style="color:var(--color-text-muted); font-size:13px;">Sin redes sociales.</p>`;

    // Tarifas
    const cache = d.cache || 0;
    const comisionPct = d.comisionPorcentaje || 0;
    const ivaPct = d.ivaPorcentaje || 0;
    const comisionImporte = cache * (comisionPct / 100);
    const total = cache + comisionImporte;
    const totalConIva = total * (1 + ivaPct / 100);
    document.getElementById("rv-calc-cache").textContent = formatoEuroRV(cache);
    document.getElementById("rv-calc-comision").textContent = formatoEuroRV(comisionImporte);
    document.getElementById("rv-calc-total").textContent = formatoEuroRV(total);
    document.getElementById("rv-calc-total-iva").textContent = formatoEuroRV(totalConIva);

    const tarifas = Array.isArray(d.tarifas) ? d.tarifas : [];
    document.getElementById("rv-tarifas").innerHTML = tarifas.length
      ? tarifas
          .map((t) => {
            const pvp = (t.coste || 0) * (1 + (t.comisionPct || 0) / 100);
            return `<div class="ver-field-row"><div class="ver-label">${escaparHtmlRV(t.concepto || "—")}</div><div>Coste: ${formatoEuroRV(t.coste)} · PVP: ${formatoEuroRV(pvp)}</div></div>`;
          })
          .join("")
      : `<p style="color:var(--color-text-muted); font-size:13px;">Sin tarifas adicionales.</p>`;

    // Riders
    const riders = Array.isArray(d.ridersPdf) ? d.ridersPdf : [];
    document.getElementById("rv-riders").innerHTML = riders.length
      ? riders.map((r) => `<div class="press-item"><div class="press-thumb" style="display:flex; align-items:center; justify-content:center;">📄</div><div class="press-name">${escaparHtmlRV(r.etiqueta || r.nombre)}</div><a class="btn-ghost" style="text-decoration:none; padding:6px 12px; font-size:12px;" href="${r.data}" download="${r.nombre}">Descargar</a></div>`).join("")
      : `<p style="color:var(--color-text-muted); font-size:13px;">Sin riders subidos.</p>`;

    // Hospitalidad
    document.getElementById("rv-hosp-condiciones").textContent = d.hospitalidadCondiciones || "—";
    const hospPdfs = Array.isArray(d.hospitalidadPdf) ? d.hospitalidadPdf : [];
    document.getElementById("rv-hosp-pdfs").innerHTML = hospPdfs.length
      ? hospPdfs.map((r) => `<div class="press-item"><div class="press-thumb" style="display:flex; align-items:center; justify-content:center;">📄</div><div class="press-name">${escaparHtmlRV(r.etiqueta || r.nombre)}</div><a class="btn-ghost" style="text-decoration:none; padding:6px 12px; font-size:12px;" href="${r.data}" download="${r.nombre}">Descargar</a></div>`).join("")
      : `<p style="color:var(--color-text-muted); font-size:13px;">Sin PDF de hospitalidad.</p>`;

    // PressKit
    const pressKit = Array.isArray(d.pressKit) ? d.pressKit : [];
    document.getElementById("rv-presskit").innerHTML = pressKit.length
      ? pressKit
          .map((p) => {
            const thumb = p.tipo === "imagen" ? `<img class="press-thumb" src="${p.data}" alt="" />` : `<div class="press-thumb" style="display:flex; align-items:center; justify-content:center;">📄</div>`;
            return `<div class="press-item">${thumb}<div class="press-name">${escaparHtmlRV(p.nombre)}</div><a class="btn-ghost" style="text-decoration:none; padding:6px 12px; font-size:12px;" href="${p.data}" download="${p.nombre}">Descargar</a></div>`;
          })
          .join("")
      : `<p style="color:var(--color-text-muted); font-size:13px;">Sin archivos de prensa.</p>`;
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo cargar la ficha.");
  }
}

async function cargarJuridicoRV() {
  const cont = document.getElementById("rv-juridico");
  cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Cargando…</p>`;
  try {
    const snap = await db.collection("rosterJuridico").doc(docIdRV).get();
    const contratos = snap.exists && Array.isArray(snap.data().contratos) ? snap.data().contratos : [];
    juridicoCargadoRV = true;
    cont.innerHTML = contratos.length
      ? contratos.map((c) => `<div class="press-item"><div class="press-thumb" style="display:flex; align-items:center; justify-content:center;">📄</div><div class="press-name">${escaparHtmlRV(c.nombre)}</div><a class="btn-ghost" style="text-decoration:none; padding:6px 12px; font-size:12px;" href="${c.data}" download="${c.nombre}">Descargar</a></div>`).join("")
      : `<p style="color:var(--color-text-muted); font-size:13px;">Sin contratos subidos.</p>`;
  } catch (err) {
    console.error(err);
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">No se pudo cargar (¿eres Admin?).</p>`;
  }
}

// ---------- Toast ----------

let toastTimerRV;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerRV);
  toastTimerRV = setTimeout(() => t.classList.remove("show"), 3200);
}
