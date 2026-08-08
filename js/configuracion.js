// =========================================================
// STAGE SUPPORT — configuracion.js
// Datos fiscales de la empresa + logo, guardados en Firestore
// en /configuracion/empresa (solo Admin puede editarlos).
// =========================================================

let logoDataUrl = null;
let logoDocDataUrl = null;
const REF_EMPRESA = () => db.collection("configuracion").doc("empresa");

(async function () {
  const perfil = await protegerPagina(["Admin"]);
  pintarNav(perfil.rol, "configuracion");
  document.getElementById("pass-name").textContent = nombreCompletoDe(perfil) || perfil.email;
  document.getElementById("pass-role").textContent = perfil.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (perfil.foto) {
    avatarEl.innerHTML = `<img src="${perfil.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(perfil) || perfil.email);
  }

  cargarDatosEmpresa();
})();

async function cargarDatosEmpresa() {
  try {
    const snap = await REF_EMPRESA().get();
    if (!snap.exists) return;
    const d = snap.data();

    document.getElementById("e-nombre").value = d.nombre || "";
    document.getElementById("e-cif").value = d.cif || "";
    document.getElementById("e-telefono").value = d.telefono || "";
    document.getElementById("e-direccion").value = d.direccion || "";
    document.getElementById("e-web").value = d.web || "";
    document.getElementById("e-email").value = d.email || "";

    if (d.logo) {
      logoDataUrl = d.logo;
      mostrarPreviewLogo(d.logo);
    }
    if (d.logoDocumentos) {
      logoDocDataUrl = d.logoDocumentos;
      mostrarPreviewLogoDoc(d.logoDocumentos);
    }
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudieron cargar los datos de la empresa.");
  }
}

// ---------- Logo ----------

function procesarLogo(event) {
  const archivo = event.target.files[0];
  if (!archivo) return;

  if (!archivo.type.startsWith("image/")) {
    mostrarToast("Elige un archivo de imagen.");
    return;
  }

  const lector = new FileReader();
  lector.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 320;
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

      // PNG para conservar la transparencia del logo
      const dataUrl = canvas.toDataURL("image/png");
      logoDataUrl = dataUrl;
      mostrarPreviewLogo(dataUrl);
    };
    img.src = e.target.result;
  };
  lector.readAsDataURL(archivo);
}

function mostrarPreviewLogo(dataUrl) {
  const preview = document.getElementById("logo-preview");
  const btnQuitar = document.getElementById("btn-quitar-logo");
  if (dataUrl) {
    preview.innerHTML = `<img src="${dataUrl}" alt="" />`;
    btnQuitar.style.display = "inline-flex";
  } else {
    preview.textContent = "Sin logo";
    btnQuitar.style.display = "none";
  }
}

function quitarLogo() {
  logoDataUrl = null;
  document.getElementById("logo-input").value = "";
  mostrarPreviewLogo(null);
}

// ---------- Logo para documentos ----------

function procesarLogoDoc(event) {
  const archivo = event.target.files[0];
  if (!archivo || !archivo.type.startsWith("image/")) return;

  const lector = new FileReader();
  lector.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 320;
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
      logoDocDataUrl = canvas.toDataURL("image/png");
      mostrarPreviewLogoDoc(logoDocDataUrl);
    };
    img.src = e.target.result;
  };
  lector.readAsDataURL(archivo);
}

function mostrarPreviewLogoDoc(dataUrl) {
  const preview = document.getElementById("logo-doc-preview");
  const btnQuitar = document.getElementById("btn-quitar-logo-doc");
  if (dataUrl) {
    preview.innerHTML = `<img src="${dataUrl}" alt="" />`;
    btnQuitar.style.display = "inline-flex";
  } else {
    preview.textContent = "Sin logo";
    btnQuitar.style.display = "none";
  }
}

function quitarLogoDoc() {
  logoDocDataUrl = null;
  document.getElementById("logo-doc-input").value = "";
  mostrarPreviewLogoDoc(null);
}

// ---------- Guardar ----------

document.getElementById("form-empresa").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btn-guardar-empresa");
  btn.disabled = true;
  ocultarMsgEmpresa();

  try {
    await REF_EMPRESA().set(
      {
        nombre: document.getElementById("e-nombre").value.trim(),
        cif: document.getElementById("e-cif").value.trim(),
        telefono: document.getElementById("e-telefono").value.trim(),
        direccion: document.getElementById("e-direccion").value.trim(),
        web: document.getElementById("e-web").value.trim(),
        email: document.getElementById("e-email").value.trim(),
        logo: logoDataUrl || null,
        logoDocumentos: logoDocDataUrl || null,
        actualizadoEl: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    mostrarToast("Datos de la empresa guardados.");
  } catch (err) {
    console.error(err);
    mostrarMsgEmpresa("No se pudo guardar. Inténtalo de nuevo.");
  } finally {
    btn.disabled = false;
  }
});

function ocultarMsgEmpresa() {
  const m = document.getElementById("form-empresa-msg");
  m.className = "form-msg";
  m.textContent = "";
}

function mostrarMsgEmpresa(texto) {
  const m = document.getElementById("form-empresa-msg");
  m.textContent = texto;
  m.className = "form-msg show error";
}

// ---------- Toast ----------

let toastTimerCfg;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerCfg);
  toastTimerCfg = setTimeout(() => t.classList.remove("show"), 3200);
}
