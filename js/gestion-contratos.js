// =========================================================
// STAGE SUPPORT — gestion-contratos.js
// Colección: /contratosConfig/{tipo} → { clausulas: [{titulo, texto}] }
// tipo: "booking" | "colaboracion"
// =========================================================

let usuarioActualGC = null;
let clausulasGC = { booking: [], colaboracion: [] };

(async function () {
  usuarioActualGC = await protegerPagina(["Admin"]);
  pintarNav(usuarioActualGC.rol, "gestion-contratos");
  document.getElementById("pass-name").textContent = nombreCompletoDe(usuarioActualGC) || usuarioActualGC.email;
  document.getElementById("pass-role").textContent = usuarioActualGC.rol;
  const avatarEl = document.getElementById("pass-avatar");
  if (usuarioActualGC.foto) {
    avatarEl.innerHTML = `<img src="${usuarioActualGC.foto}" alt="" />`;
  } else {
    avatarEl.textContent = inicialesDe(nombreCompletoDe(usuarioActualGC) || usuarioActualGC.email);
  }

  await cargarClausulas();
})();

function cambiarTabGC(tab) {
  document.querySelectorAll("#gc-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".rst-tab-panel").forEach((p) => p.classList.remove("active"));
  document.getElementById(`gc-panel-${tab}`).classList.add("active");
}

async function cargarClausulas() {
  try {
    const [snapBooking, snapColab] = await Promise.all([
      db.collection("contratosConfig").doc("booking").get(),
      db.collection("contratosConfig").doc("colaboracion").get(),
    ]);
    clausulasGC.booking = snapBooking.exists && Array.isArray(snapBooking.data().clausulas) ? snapBooking.data().clausulas : [];
    clausulasGC.colaboracion = snapColab.exists && Array.isArray(snapColab.data().clausulas) ? snapColab.data().clausulas : [];
    renderClausulas("booking");
    renderClausulas("colaboracion");
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudieron cargar las cláusulas.");
  }
}

function renderClausulas(tipo) {
  const cont = document.getElementById(`lista-clausulas-${tipo}`);
  const lista = clausulasGC[tipo];

  if (lista.length === 0) {
    cont.innerHTML = `<p style="color:var(--color-text-muted); font-size:13px;">Todavía no hay cláusulas añadidas.</p>`;
    return;
  }

  cont.innerHTML = lista
    .map(
      (c, i) => `
        <div class="clausula-card">
          <div class="clausula-top">
            <input placeholder="Título de la cláusula" value="${escaparAttrGC(c.titulo)}" oninput="clausulasGC['${tipo}'][${i}].titulo=this.value" />
            <button type="button" class="remove-row-btn" onclick="eliminarClausula('${tipo}', ${i})">✕</button>
          </div>
          <textarea placeholder="Texto de la cláusula…" oninput="clausulasGC['${tipo}'][${i}].texto=this.value">${escaparHtmlGC(c.texto)}</textarea>
        </div>
      `
    )
    .join("");
}

function anadirClausula(tipo) {
  clausulasGC[tipo].push({ titulo: "", texto: "" });
  renderClausulas(tipo);
}

function eliminarClausula(tipo, i) {
  clausulasGC[tipo].splice(i, 1);
  renderClausulas(tipo);
}

async function guardarClausulas() {
  const btn = document.getElementById("btn-guardar-gc");
  btn.disabled = true;
  try {
    await Promise.all([
      db.collection("contratosConfig").doc("booking").set({ clausulas: clausulasGC.booking }, { merge: true }),
      db.collection("contratosConfig").doc("colaboracion").set({ clausulas: clausulasGC.colaboracion }, { merge: true }),
    ]);
    mostrarToast("Cláusulas guardadas.");
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudieron guardar los cambios.");
  } finally {
    btn.disabled = false;
  }
}

function escaparHtmlGC(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function escaparAttrGC(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// ---------- Toast ----------

let toastTimerGC;
function mostrarToast(texto) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = texto;
  t.classList.add("show");
  clearTimeout(toastTimerGC);
  toastTimerGC = setTimeout(() => t.classList.remove("show"), 3200);
}
