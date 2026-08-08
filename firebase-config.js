// =========================================================
// STAGE SUPPORT — Configuración de Firebase
// =========================================================
// 1. Ve a https://console.firebase.google.com → crea un proyecto
//    (ej. "stage-support").
// 2. Activa Authentication → Email/contraseña.
// 3. Activa Firestore Database (modo producción).
// 4. En "Configuración del proyecto" > "Tus apps" > Web (</>),
//    copia el objeto firebaseConfig y pégalo aquí abajo.
// =========================================================

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "stage-support.firebaseapp.com",
  projectId: "stage-support",
  storageBucket: "stage-support.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

// Dominio corporativo permitido para iniciar sesión
const DOMINIO_PERMITIDO = "stagesupport.com";

// App principal (sesión del usuario que navega la plataforma)
firebase.initializeApp(firebaseConfig);

// App secundaria — se usa solo para dar de alta nuevos usuarios
// desde el panel de Admin sin cerrar la sesión del admin actual.
const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");

const auth = firebase.auth();
const db = firebase.firestore();
const secondaryAuth = secondaryApp.auth();
