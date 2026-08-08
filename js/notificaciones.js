// =========================================================
// STAGE SUPPORT — notificaciones.js
// Funciones compartidas para el sistema de notificaciones entre
// cuentas. Se usa desde Dashboard, Agenda y Notas.
// =========================================================

/**
 * Crea una notificación para otro usuario.
 * @param {string} paraUid - uid de quien la recibe
 * @param {string} tipo - 'agenda' | 'nota' | 'sistema'
 * @param {string} mensaje - texto a mostrar
 * @param {string} enlace - página a la que lleva al pulsarla
 */
async function crearNotificacion(paraUid, tipo, mensaje, enlace, deUsuario) {
  if (!paraUid || paraUid === deUsuario.uid) return; // no te notificas a ti mismo
  try {
    await db.collection("notificaciones").add({
      paraUid,
      deUid: deUsuario.uid,
      deNombre: nombreCompletoDe(deUsuario) || deUsuario.email,
      tipo,
      mensaje,
      enlace,
      leida: false,
      creadoEl: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("No se pudo crear la notificación:", err);
  }
}

/**
 * Notifica a una lista de UIDs a la vez (por ejemplo, al compartir
 * una nota o cita con varias personas).
 */
async function notificarAVarios(uids, tipo, mensaje, enlace, deUsuario) {
  await Promise.all((uids || []).map((uid) => crearNotificacion(uid, tipo, mensaje, enlace, deUsuario)));
}
