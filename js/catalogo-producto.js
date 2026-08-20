// =========================================================
// STAGE SUPPORT — catalogo-producto.js
// Ficha propia de cada producto del Catálogo (lee /roster/{id} pero
// solo pinta los campos de venta — nunca cache/comisión/IVA/tarifas).
// Fotos y vídeos se abren en un visor ampliado (lightbox), no
// navegan fuera de la plataforma.
// =========================================================

let usuarioActualCP = null;
let docIdCP = null;

(async function () {
  usuarioActualCP = await protegerPagina(["Comercial", "Admin"]);
  pintarNav(usuarioActualCP.rol, "catalogo");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualCP) || usuarioActualCP.email;
  document.getElementById("pass-role").textContent = usuarioActualCP.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualCP.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualCP.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualCP) || usuarioActualCP.email);
  }

  const params = new URLSearchParams(window.location.search);
  docIdCP = params.get("id");
  if (!docIdCP) {
    window.location.href = "catalogo.html";
    return;
  }

  await cargarProductoCP();

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    cerrarLightboxImagen();
    cerrarLightboxVideo();
  });
})();

async function cargarProductoCP() {
  try {
    const snap = await db.collection("roster").doc(docIdCP).get();
    if (!snap.exists) {
      mostrarToast("Este espectáculo ya no existe.");
      setTimeout(() => (window.location.href = "catalogo.html"), 1500);
      return;
    }
    const d = snap.data();

    document.getElementById("cp-titulo-cabecera").textContent = d.nombre || "Espectáculo";

    document.getElementById("cp-categoria").innerHTML = d.categoria ? `<span class="categoria-badge">${escaparHtmlCP(d.categoria)}</span>` : "";
    document.getElementById("cp-oficina").textContent = d.oficinaRepresentacion || "";
    document.getElementById("cp-descripcion").textContent = d.descripcionComercial || "Sin descripción todavía.";

    const camposExtra = Array.isArray(d.camposExtra) ? d.camposExtra.filter((c) => c.titulo || c.descripcion) : [];
    document.getElementById("cp-campos-extra").innerHTML = camposExtra.length
      ? `<ul class="campos-extra-lista">${camposExtra.map((c) => `<li><strong>${escaparHtmlCP(c.titulo)}:</strong> ${escaparHtmlCP(c.descripcion)}</li>`).join("")}</ul>`
      : "";

    const poster = document.getElementById("cp-poster");
    if (d.imagenCartel) {
      poster.src = d.imagenCartel;
      poster.style.display = "block";
    } else {
      poster.style.display = "none";
    }

    const galeria = Array.isArray(d.galeria) ? d.galeria.filter((f) => f) : [];
    if (galeria.length > 0) {
      document.getElementById("cp-card-galeria").style.display = "block";
      document.getElementById("cp-galeria").innerHTML = galeria.map((foto) => `<img src="${foto}" alt="" onclick="abrirLightboxImagen('${foto}')" />`).join("");
    }

    const videos = Array.isArray(d.videosYoutube) ? d.videosYoutube.filter((v) => v.url) : [];
    if (videos.length > 0) {
      document.getElementById("cp-card-videos").style.display = "block";
      document.getElementById("cp-videos").innerHTML = videos
        .map((v) => {
          const idYt = extraerIdYoutubeCP(v.url);
          return idYt
            ? `<div class="video-thumb-link" onclick="abrirLightboxVideo('${idYt}')"><img src="https://img.youtube.com/vi/${idYt}/hqdefault.jpg" alt="" /><span class="play-badge">▶</span></div>`
            : `<a href="${v.url}" target="_blank" rel="noopener">${escaparHtmlCP(v.titulo || "Ver vídeo")}</a>`;
        })
        .join("");
    }

    const redes = Array.isArray(d.redesSociales) ? d.redesSociales.filter((x) => x.url) : [];
    if (redes.length > 0) {
      document.getElementById("cp-card-redes").style.display = "block";
      document.getElementById("cp-redes").innerHTML = redes
        .map((x) => `<a href="${x.url}" target="_blank" rel="noopener">${escaparHtmlCP(x.plataforma || "Enlace")}</a>`)
        .join("");
    }
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo cargar este espectáculo.");
  }
}

function extraerIdYoutubeCP(url) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// ---------- Visor ampliado: foto ----------

function abrirLightboxImagen(url) {
  if (!url) return;
  document.getElementById("lightbox-imagen-img").src = url;
  document.getElementById("lightbox-imagen-overlay").classList.add("show");
}

function cerrarLightboxImagen() {
  document.getElementById("lightbox-imagen-overlay").classList.remove("show");
  document.getElementById("lightbox-imagen-img").src = "";
}

// ---------- Visor ampliado: vídeo (se incrusta, no navega a YouTube) ----------

function abrirLightboxVideo(idYoutube) {
  document.getElementById("lightbox-video-iframe").src = `https://www.youtube.com/embed/${idYoutube}?autoplay=1`;
  document.getElementById("lightbox-video-overlay").classList.add("show");
}

function cerrarLightboxVideo() {
  document.getElementById("lightbox-video-overlay").classList.remove("show");
  // Se vacía el src para que el vídeo deje de sonar/reproducirse al cerrar.
  document.getElementById("lightbox-video-iframe").src = "";
}

function escaparHtmlCP(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// ---------- Toast ----------

let toastTimerCP;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerCP);
  toastTimerCP = setTimeout(() => t.classList.remove("show"), 3200);
}
