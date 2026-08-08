// =========================================================
// STAGE SUPPORT — auth.js
// Utilidades de autenticación compartidas por todas las páginas
// =========================================================

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
 * Protege una página: exige sesión iniciada, dominio corporativo,
 * usuario activo en Firestore y, opcionalmente, uno de los roles indicados.
 * Devuelve una Promise con el perfil del usuario si todo es correcto;
 * si no, redirige a index.html y no resuelve.
 *
 * Uso:
 *   const perfil = await protegerPagina();               // cualquier rol
 *   const perfil = await protegerPagina(["Admin"]);       // solo Admin
 */
function protegerPagina(rolesPermitidos) {
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

      if (rolesPermitidos && !rolesPermitidos.includes(perfil.rol)) {
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
