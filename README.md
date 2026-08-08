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

## Calendario y documentos

El Calendario marca automáticamente cada día en que se crea un contrato,
propuesta, rider, booking, promotor, hoja de ruta o evento. Todos viven en
una única colección de Firestore, **`documentos`**, con estos campos:

- `tipo` — uno de: `Contrato`, `Propuesta`, `Rider`, `Booking`, `Promotor`,
  `HojaDeRuta`, `Evento`
- `titulo` (string)
- `fecha` (string `YYYY-MM-DD`) — el día en que aparece marcado
- `enlace` (string, opcional)
- `notas` (string, opcional)
- `creadoPor` / `creadoPorUid` — quién lo creó
- `creadoEl` — timestamp del servidor

Cualquier empleado activo puede crear documentos y ver el calendario;
solo quien lo creó (o un Admin) puede editarlo o eliminarlo — así lo
protegen las reglas de `firestore.rules`.

Cuando construyas los módulos de Bookings, Producciones, etc., lo más
sencillo es que, al guardar su propio registro, también añadan un
documento a esta misma colección `documentos` — así aparecerán en el
calendario sin tocar nada más.

## Hojas de Ruta

El listado (`hojasderuta.html`) funciona igual que Producciones: ID
correlativo automático (`HR<año>-0001`, colección **`hojasDeRuta`**),
vínculo opcional a una producción, y marca automática en el Calendario
al crearse.

> Nota: el ID se genera con guión (`HR26-0002`); si tu plantilla previa
> usaba `HR260002` sin guión, es un cambio de una línea en `js/ids.js`
> si lo prefieres así — dilo y lo ajusto.

Desde el listado, el botón **Abrir** lleva al editor completo
(`hojaderuta-detalle.html?id=...`), con:

- **Datos de la actuación** — artista, fecha, ciudad, local, dirección
  + enlace de mapa, parking.
- **Contactos** — lista libre, añadir/quitar filas (tipo, nombre,
  teléfono, observaciones).
- **Planning** — uno o varios bloques por día, cada uno con su propia
  fecha y filas libres (tarea, hora, observaciones).
- **Alojamiento** y **Dietas** — bloques opcionales (checkbox
  "Incluir") con los mismos campos tipo ficha que Datos de la
  actuación, pero para el hotel/catering.
- **Logo del evento** — opcional, se guarda igual que el logo de la
  empresa (imagen comprimida en Firestore).
- **Previsión meteorológica** — botón "Consultar previsión" que llama
  a la API gratuita de Open-Meteo (sin clave) usando la Ciudad y Fecha
  ya escritas; solo funciona para fechas dentro de ~16 días. El
  resultado se guarda en el documento para no tener que consultarlo
  cada vez.
- **Imprimir** — genera una versión limpia tipo documento (con las
  cabeceras en amarillo, igual que la plantilla original) y abre el
  diálogo de impresión del navegador.
- **Descargar PDF** — genera el mismo documento como archivo PDF
  descargable (usa la librería html2pdf.js vía CDN, sin backend).

Todo el contenido (contactos, planning, alojamiento, dietas...) vive
dentro del propio documento en `hojasDeRuta/{id}`, como objetos y
listas anidadas — no hace falta tocar las reglas de Firestore para
esto, las que ya había cubren toda la colección.

## Producciones y numeración correlativa

Cada producción se guarda en **`producciones/{id}`** con un ID visible
correlativo con formato `PREFIJO<año 2 dígitos>-0001`, generado
automáticamente al crear (nunca se repite, incluso si dos personas
crean a la vez, gracias a una transacción de Firestore sobre
`contadores/{PREFIJO<año>}`). El generador (`js/ids.js`) ya tiene
preparados los prefijos para cuando construyamos el resto de módulos:

| Módulo | Prefijo | Ejemplo |
|---|---|---|
| Producciones | `PRO` | `PRO25-0001` |
| Hojas de Ruta | `HR` | `HR25-0001` |
| Propuestas a clientes | `PROV` | `PROV25-0001` |
| Booking | `BO` | `BO25-0001` |
| Presupuestos | `PR` | `PR25-0001` |

Al crear una producción, además de guardarse en `producciones`, se
añade automáticamente un registro en `documentos` (tipo `Evento`) para
que quede marcada en el Calendario el día de creación — así no hay que
apuntarlo dos veces.

Cada producción tiene un **Project Manager**, elegido de dos fuentes:
los empleados de la plataforma (`usuarios`) o la bolsa de personal
externo (`personal`). Se guarda como `pmTipo` (`usuario` o `personal`),
`pmId` y `pmNombre` (para no depender de una consulta extra al listar).

## Personal (bolsa de contactos externos)

En **Producción → Personal**, cualquier empleado activo puede mantener
una lista de contactos externos —técnicos, project managers, tour
managers, etc.— que no tienen cuenta de acceso a la plataforma. Viven
en **`personal/{id}`** con `nombre`, `apellidos`, `telefono`, `email`,
`rol` (reutiliza los roles creados en Administración → Roles),
`tarifa` (€), `situacion` (`ss` = alta en la Seguridad Social, o
`autonomo` — en cuyo caso se guardan también `retencion` e `iva`, ambos
en %) y `notas`. Esta lista alimenta el selector de Project Manager en
Producciones.

## Roles y permisos

En **Administración → Roles**, un Admin puede crear roles personalizados
además de los 3 que ya existían (Admin, Comercial, Producción, que se
siembran automáticamente la primera vez que se entra en esta sección).
Cada rol vive en Firestore en **`roles/{id}`**:

- `nombre` (string)
- `permisos` — mapa de booleanos por sección (`dashboard`, `calendario`,
  `bookings`, `producciones`, `clientes`, `usuarios`, `roles`,
  `comisiones`, `configuracion`)

> ⚠️ De momento estos permisos son **informativos**: se guardan y se
> muestran, pero el menú lateral (`js/nav.js`) todavía decide qué
> secciones ve cada persona según el nombre de rol fijo (Admin,
> Comercial, Producción), no según estos permisos. Conectar el menú y
> las reglas de Firestore a los permisos reales de cada rol es el
> siguiente paso natural cuando lo necesites.

Al eliminar un rol, la plataforma comprueba primero que ningún usuario
lo tenga asignado.

## Comisiones estándar

En **Administración → Comisiones**, un Admin puede mantener una lista
de comisiones predeterminadas (nombre, porcentaje, notas) en
**`comisiones/{id}`**, pensadas para reutilizarse más adelante al crear
bookings o propuestas.

## Configuración de la empresa

Los datos fiscales (nombre, CIF, dirección, teléfono, web, email) y el
logo se guardan en Firestore, en un único documento:
**`configuracion/empresa`**. Solo Admin puede editarlos (ruta
Configuración en el menú); cualquier empleado activo puede leerlos.
El logo se guarda igual que las fotos de perfil: como imagen PNG
comprimida directamente en el documento, sin necesitar Firebase
Storage.

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
