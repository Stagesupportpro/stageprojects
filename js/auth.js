// =========================================================
// STAGE SUPPORT — auth.js
// Utilidades de autenticación compartidas por todas las páginas.
// El acceso a cada página ya NO depende de una lista fija de nombres
// de rol ("Admin", "Comercial"...) sino de los permisos reales del
// rol de cada usuario, definidos en Administración → Roles. Así,
// cualquier rol personalizado que se cree ahí funciona de verdad,
// tanto para lo que aparece en el menú como para lo que se puede
// abrir directamente por URL.
// =========================================================

// Permiso con el que se guarda cada página del "detalle" de una
// entidad (no están en el menú por sí mismas — comparten el permiso
// de su página de listado).
const PAGINA_A_PERMISO = {
  "roster-detalle.html": "roster",
  "roster-ver.html": "roster",
  "produccion-detalle.html": "producciones",
  "hojaderuta-detalle.html": "hojasderuta",
  "venue-detalle.html": "venues",
  "propuesta-detalle.html": "propuestas",
  "propuesta-ver.html": "propuestas",
  "booking-detalle.html": "bookings",
};

// El dashboard es la página de aterrizaje segura — siempre accesible
// para cualquier empleado activo, tenga los permisos que tenga, para
// que nunca se pueda quedar sin ningún sitio al que ir.
const PAGINAS_SIEMPRE_ACCESIBLES = ["dashboard.html", "index.html"];

let permisosActuales = null; // se rellena en protegerPagina()

function permisoDePaginaActual() {
  const archivo = window.location.pathname.split("/").pop() || "dashboard.html";
  if (archivo in PAGINA_A_PERMISO) return PAGINA_A_PERMISO[archivo];
  return archivo.replace(/\.html$/, "");
}

/**
 * Comprueba que el email pertenece al dominio corporativo.
 */
function esDominioValido(email) {
  return typeof email === "string" && email.toLowerCase().endsWith("@" + DOMINIO_PERMITIDO);
}

/**
 * Obtiene el documento del usuario (rol, nombre, activo...) en Firestore.
 * El documento vive en /usuarios/{uid}.
 */
async function obtenerPerfilUsuario(uid) {
  const snap = await db.collection("usuarios").doc(uid).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Carga los permisos del rol indicado desde Administración → Roles.
 * Devuelve {} (sin permisos) si el rol no existe todavía como
 * documento — pasa con instalaciones muy nuevas antes de entrar en
 * Roles por primera vez.
 */
async function cargarPermisosDeRol(nombreRol) {
  try {
    const snap = await db.collection("roles").where("nombre", "==", nombreRol).limit(1).get();
    if (snap.empty) return {};
    return snap.docs[0].data().permisos || {};
  } catch (err) {
    console.error("No se pudieron cargar los permisos del rol:", err);
    return {};
  }
}

/**
 * Protege una página: exige sesión iniciada, dominio corporativo,
 * usuario activo en Firestore, y que su rol tenga permiso para esta
 * página en concreto (según Administración → Roles).
 *
 * El parámetro rolesPermitidos ya no se usa para bloquear el acceso
 * (se ignora si se pasa) — se mantiene solo por compatibilidad con
 * páginas que todavía lo llaman así; el permiso real es el del árbol
 * de Roles.
 *
 * Devuelve una Promise con el perfil del usuario (incluyendo sus
 * permisos ya cargados en la variable global permisosActuales) si
 * todo es correcto; si no, redirige y no resuelve.
 */
function protegerPagina(rolesPermitidosLegacy) {
  return new Promise((resolve) => {
    auth.onAuthStateChanged(async (user) => {
      if (!user || !esDominioValido(user.email)) {
        if (user) await auth.signOut();
        window.location.href = "index.html";
        return;
      }

      const perfil = await obtenerPerfilUsuario(user.uid);

      if (!perfil || perfil.activo === false) {
        await auth.signOut();
        window.location.href = "index.html?error=sin-acceso";
        return;
      }

      permisosActuales = await cargarPermisosDeRol(perfil.rol);

      const archivo = window.location.pathname.split("/").pop() || "dashboard.html";
      const permisoRequerido = permisoDePaginaActual();
      const tieneAcceso = PAGINAS_SIEMPRE_ACCESIBLES.includes(archivo) || permisosActuales[permisoRequerido] === true;

      if (!tieneAcceso) {
        window.location.href = "dashboard.html";
        return;
      }

      resolve({ uid: user.uid, email: user.email, ...perfil });
    });
  });
}

function cerrarSesion() {
  auth.signOut().then(() => (window.location.href = "index.html"));
}

function inicialesDe(nombre) {
  if (!nombre) return "??";
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

/**
 * Nombre completo a partir del perfil (nombre + apellidos si existen).
 */
function nombreCompletoDe(perfil) {
  if (!perfil) return "";
  return [perfil.nombre, perfil.apellidos].filter(Boolean).join(" ");
}
