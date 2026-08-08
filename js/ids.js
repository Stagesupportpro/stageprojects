// =========================================================
// STAGE SUPPORT — ids.js
// Generador de IDs correlativos por tipo y año: PREFIJO + AÑO(2) + -0001
// Ej: PRO25-0001, HR25-0001, PROV25-0001, BO25-0001, PR25-0001
// Usa una transacción de Firestore para que dos altas simultáneas
// nunca puedan repetir el mismo número.
// =========================================================

const PREFIJOS_ID = {
  produccion: "PRO",
  hojaDeRuta: "HR",
  propuestaCliente: "PROV",
  booking: "BO",
  presupuesto: "PR",
};

async function generarSiguienteId(prefijo) {
  const anio2 = String(new Date().getFullYear()).slice(-2);
  const contadorId = `${prefijo}${anio2}`;
  const ref = db.collection("contadores").doc(contadorId);

  const siguiente = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const actual = snap.exists ? snap.data().ultimo || 0 : 0;
    const nuevo = actual + 1;
    tx.set(ref, { ultimo: nuevo }, { merge: true });
    return nuevo;
  });

  return `${contadorId}-${String(siguiente).padStart(4, "0")}`;
}
