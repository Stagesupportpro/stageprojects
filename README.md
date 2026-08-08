# Stage Support — Plataforma interna

Plataforma web para el equipo de Stage Support (booking & management de
artistas, producción y promotora). Acceso por email corporativo, con un
dashboard que cambia según el rol de cada empleado.

## Estructura del proyecto

```
stage-support/
├── index.html          → Login (acceso empleados)
├── dashboard.html       → Dashboard con menú según rol
├── usuarios.html        → Gestión de usuarios (solo Admin)
├── firestore.rules      → Reglas de seguridad de Firestore
├── css/styles.css       → Sistema de diseño (amarillo EAF400, negro, blanco)
├── js/
│   ├── firebase-config.js  → Claves del proyecto Firebase
│   ├── auth.js              → Login, protección de páginas por rol
│   ├── nav.js                → Menú lateral dinámico según rol
│   ├── dashboard.js          → Lógica del dashboard
│   └── usuarios.js           → Alta / edición / baja de usuarios
└── assets/
    └── logo_stagesupport.png  → (añade aquí el logo)
```

## 1. Crear el proyecto en Firebase

1. Ve a [console.firebase.google.com](https://console.firebase.google.com) →
   **Crear proyecto** → nómbralo, por ejemplo, `stage-support`.
2. **Authentication** → pestaña *Sign-in method* → activa **Email/contraseña**.
3. **Firestore Database** → **Crear base de datos** → modo producción.
4. **Configuración del proyecto** (⚙️) → *Tus apps* → añade una app **Web** (`</>`).
   Copia el objeto `firebaseConfig` que te da y pégalo en
   `js/firebase-config.js`.
5. En Firestore → pestaña **Reglas**, pega el contenido de
   `firestore.rules` y publica.

## 2. Crear tu primer usuario (Admin)

Como las reglas exigen que un Admin exista para poder crear más usuarios
desde el panel, el primero se crea a mano una vez:

1. **Authentication** → **Users** → **Add user** → introduce
   `gerard@stagesupport.com` y una contraseña.
2. Copia el **UID** que se genera para ese usuario.
3. **Firestore Database** → **Iniciar colección** → nombre `usuarios`.
4. ID del documento: pega el UID copiado. Añade estos campos:
   - `nombre` (string) → `Gerard`
   - `email` (string) → `gerard@stagesupport.com`
   - `rol` (string) → `Admin`
   - `activo` (boolean) → `true`

Con eso ya puedes entrar en `index.html` y, desde **Usuarios**, dar de
alta al resto del equipo (Comercial y Producción) directamente desde
la plataforma.

## 3. Añadir el logo

Sustituye `assets/logo_stagesupport.png` por vuestro archivo real (mismo
nombre) y aparecerá automáticamente en el login y en el menú lateral.

## 4. Subir a GitHub y publicar

```bash
cd stage-support
git init
git add .
git commit -m "Primera versión de la plataforma"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/stage-support.git
git push -u origin main
```

Para publicarlo gratis con **GitHub Pages**:
`Settings` → `Pages` → *Deploy from a branch* → rama `main`, carpeta `/root`.

> ⚠️ Como es un sitio estático, la `apiKey` de Firebase quedará visible en
> el código — esto es normal y seguro en Firebase **siempre que las
> reglas de Firestore estén bien configuradas** (ya lo están en
> `firestore.rules`): la clave solo identifica el proyecto, no da acceso
> por sí sola.

## Roles actuales

- **Comercial** — pensado para bookings, clientes y propuestas.
- **Producción** — pensado para producciones, calendario técnico y riders.
- **Admin** — todo lo anterior + gestión de usuarios y configuración.

Los módulos de Bookings, Producciones, Clientes, etc. aparecen ya en el
menú marcados como "pronto": son la siguiente fase, se irán activando
según se vayan construyendo.

## Notas técnicas importantes

- **Alta de usuarios**: se crea desde el panel de Admin usando una
  segunda instancia de Firebase (`secondaryApp` en `firebase-config.js`)
  para no cerrar la sesión del admin al crear la cuenta nueva.
- **Eliminar usuarios**: el botón "eliminar" borra el perfil en Firestore,
  lo que revoca el acceso a la plataforma al instante. La cuenta de
  Firebase Authentication en sí **no se borra** desde el navegador por
  seguridad (Firebase no lo permite desde el cliente). Para un borrado
  completo de la cuenta de Auth, más adelante conviene añadir una
  **Cloud Function** con el Admin SDK — se puede hacer cuando el
  proyecto lo requiera.
- **Dominio corporativo**: el login y las reglas de Firestore solo
  permiten cuentas `@stagesupport.com`. Si cambiáis de dominio, actualiza
  `DOMINIO_PERMITIDO` en `js/firebase-config.js` y la expresión en
  `firestore.rules`.
