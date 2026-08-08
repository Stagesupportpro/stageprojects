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

## Bookings — Venue obligatorio en los dos tipos

El selector de Venue (búsqueda + modalidad) ya no es exclusivo del
tipo "Como promotora": ahora es un campo común y obligatorio también
para "Fecha contratada (a caché)". La comisión sigue apareciendo solo
en el tipo a caché.

## Versiones (V1, V2...)

Bookings y Producciones tienen un botón "Crear nueva versión" (icono
⎘) en el listado. Duplica el documento completo con
`version` +1, guardando `grupoVersionId` (apunta al id de la V1) y
`versionAnteriorId` (apunta a la versión de la que viene). La versión
original **no se borra ni se bloquea** — queda como histórico visible
en el listado, con su propio badge "V1", "V2"... Es una base sencilla
pensada para cuando un cliente pide cambios tras aceptar algo.

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

## Venues

Ficha de cada sala/recinto con la que se trabaja, en **`venues/{id}`**:
nombre, dirección + enlace de mapa, **Contactos** (lista libre),
**Riders** (varios PDF, cada uno con su etiqueta — sonido, luces...),
**Condiciones** (texto libre), **Tarifas** (lista de conceptos con
importe y si incluyen impuestos o no), y **Taquilla compartida**
(bloque opcional con tramos: desde/hasta € y qué % le corresponde al
venue en cada tramo).

Sigue el mismo patrón que Roster/Propuestas: listado con alta rápida
(`venues.html`) que redirige a una ficha completa
(`venue-detalle.html?id=...`) para todo lo demás.

> De cara al futuro: sería natural que, al elegir "Como promotora" en
> Bookings, el campo Espacio tirara de este listado de Venues en vez
> de ser texto libre — dilo cuando quieras y lo conecto.

## Bookings

Enlaza todo lo demás: **Roster** (artista, con caché/comisión/IVA
autocompletados desde su ficha), **Clientes** o **Propuestas**
(según el tipo), y **Comisiones estándar** (como preset opcional).
Vive en **`bookings/{id}`** con ID correlativo `BO<año>-0001`.

Dos tipos, elegidos con un selector al principio del formulario:

- **Fecha contratada (a caché)** — actuamos como agencia de booking.
  Se elige el **Cliente** directamente, o bien una **Propuesta** ya
  creada (en cuyo caso el cliente se autocompleta desde esa propuesta).
- **Como promotora** — organizamos nosotros el espectáculo; en vez de
  cliente se rellena el **Espacio/Recinto** (y su dirección).

En ambos casos se elige el **Artista** del Roster, lo que autocompleta
caché/comisión/IVA con lo guardado en su ficha (editable por booking).
La misma calculadora de Roster (Caché (BI) + Comisión = Total, Total +
IVA) se repite aquí.

Al crear un booking, también se marca en el Calendario (tipo `Booking`)
el día de creación — igual que Producciones y Hojas de Ruta.

## Bookings — modo "Como promotora"

Cuando el tipo es "Como promotora": no se muestra comisión (Stage
Support no se cobra a sí misma). El campo Recinto/Festival es un
buscador (escribe o elige de la lista) contra **Venues**; al
seleccionar uno, si tiene tarifas guardadas aparece un desplegable de
**modalidad** con cada tarifa del venue — al elegirla, el coste se
autocompleta.

## Producción — Cifras (modelo verificado)

Reconstruido a partir de vuestra plantilla real (Roger'S Temple —
Vilajoyosa), con las fórmulas comprobadas al céntimo:

- **Costes**: lista libre (concepto + importe + nota), sembrada la
  primera vez con las categorías típicas — Caché, Comisión/Agente,
  Técnica, Alojamiento, Logística, Dietas, Promoción, Otros — todas
  editables o eliminables.
- **Sala**: nombre, provincia, aforo, venta de entradas prevista (+
  nota, ej. "+10 invitaciones banda"), precio de entrada, y un
  **% de reparto de taquilla para la Sala** (opcional — si el venue
  no reparte taquilla, se deja en blanco).
- **Simulación por % de aforo** (10% a 100%): para cada tramo,
  Entradas, Venta, Beneficio (venta − gastos) y, si hay reparto,
  Sala y Artista/Promotor.
- **Fórmulas de reparto** (verificadas contra la plantilla real):
  - `Sala = % Sala × Venta bruta del tramo` — la sala cobra su
    porcentaje de la venta, independientemente de los gastos.
  - `Artista/Promotor = (100% − % Sala) × Beneficio neto del tramo`
    — el resto se calcula sobre lo que queda tras los gastos.
- **Break even real** = gastos totales ÷ precio de entrada
  (redondeado), mostrado también como % sobre el aforo previsto.

El **% de reparto de taquilla** se define por modalidad en la ficha
de cada **Venue** (pestaña Tarifas: además de importe e impuestos,
ahora hay un campo "% venue taquilla"). Al elegir esa modalidad en un
Booking "como promotora", el % viaja con el booking; y al vincular
ese booking a una Producción e importar el coste, el % se
autocompleta también en Cifras.

## Producción — ficha por pestañas

Cada producción tiene ahora su propia ficha (`produccion-detalle.html`,
se llega con "Abrir" desde el listado):

- **Información general** — lo de siempre + un **Booking vinculado**
  opcional (solo bookings "como promotora"): con un clic se importa su
  coste de venue a Cifras.
- **Cifras** — ver sección detallada arriba ("Producción — Cifras").
  El total del checklist de Hospitalidad se suma automáticamente a
  los costes.
- **Documentos** — varios PDF (contratos, contrarriders...), cada uno
  con su etiqueta.
- **Hospitalidad** — checklist de ítems con precio y casilla de
  "comprado"; el total se traslada solo a Cifras.

## Dashboard y notificaciones

El Dashboard ahora muestra cifras reales (consultadas a Firestore al
cargar) según el rol: bookings/clientes/propuestas para Comercial,
producciones/hojas de ruta/próximo evento para Producción, y
usuarios activos/bookings/producciones para Admin.

Hay un sistema de notificaciones entre cuentas (`notificaciones/{id}`):
cualquier empleado puede notificar a otro (se usa, de momento, al
compartir una cita de Agenda o una Nota). Cada usuario solo puede leer
sus propias notificaciones — están así protegidas también a nivel de
Firestore, no solo en pantalla. Aparecen en una tarjeta en el
Dashboard; al tocarlas, se marcan como leídas y llevan a la página
correspondiente.

## Agenda y Notas (personales, con opción de compartir)

Dos secciones nuevas en General:

- **Agenda** (`agenda/{id}`) — citas personales: nombre, fecha, hora,
  ubicación, descripción. Se puede compartir con compañeros
  (selección de la lista de usuarios); a quien se la compartas recibe
  una notificación.
- **Notas** (`notas/{id}`) — nombre, descripción, mismo sistema de
  compartir. Al crearla hay una casilla "También añadir a mi Agenda"
  que crea a la vez una cita en Agenda con la fecha de hoy.

Cada persona ve las suyas propias y las que le hayan compartido
(nunca las de los demás sin compartir).

## Roles en árbol

El modal de permisos de un rol ya no es una lista plana: es un árbol
que sigue exactamente la estructura del menú real (**Sección → Página
→ Pestañas**, para las páginas que las tienen — de momento Roster y
Producción). Se construye directamente desde `NAV_ESTRUCTURA`
(`js/nav.js`), así que nunca se desincroniza de lo que existe de
verdad. Al desmarcar una página, sus pestañas se desmarcan solas.

## Menú lateral (acordeón) y secciones

El menú lateral funciona por acordeón: al pulsar el nombre de una
sección se abre y se cierran las demás. La sección que contiene la
página en la que estás se abre sola al cargar. Se define entero en
`js/nav.js` (`NAV_ESTRUCTURA`) — para añadir una página nueva, es el
único sitio que hay que tocar.

Secciones actuales: **General**, **Comercial** (Catálogo, Preparar
Propuesta), **Booking & Management** (antes "Booking & Comercial":
Bookings, Roster, Venues, Clientes), **Producción** y
**Administración**.

## Catálogo

En **Comercial → Catálogo**: una galería del Roster pensada para
enseñar a clientes desde un dispositivo — mismo origen de datos que
Roster (`roster/{id}`), pero **deliberadamente sin caché, comisión,
IVA ni tarifas**; solo nombre, cartel, descripción comercial y redes
sociales. Al tocar una ficha se abre un modal de detalle. Es de solo
lectura — para editar el contenido se sigue usando Roster.

## Roster — ficha por pestañas

La ficha de cada espectáculo (`roster-detalle.html`) ahora tiene
pestañas: **Información general**, **Tarifas**, **Riders**,
**Hospitalidad**, **PressKit** y **Jurídico** (esta última solo
visible para Admin). Desde el listado, cada fila tiene **Ver**
(`roster-ver.html`, solo lectura, con las mismas pestañas y botones de
descarga) y **Editar** (la ficha completa).

- **Tarifas**: la "tarifa estándar" (Caché/Comisión/IVA) sigue siendo
  la que se autocompleta en Bookings y Hojas de Ruta. Además, ahora
  hay una lista de **otras tarifas** (para formatos distintos:
  showcase, DJ set...), cada una con su coste y PVP (coste + comisión)
  calculado al vuelo.
- **Riders**: ahora admite varios PDF, cada uno con su etiqueta.
- **Hospitalidad**: condiciones en texto libre + PDF de rider de
  hospitalidad.
- **PressKit**: logos, dossiers e imágenes varias (mezcla de imágenes
  y PDF en una sola lista).
- **Jurídico**: el contrato de colaboración **no vive en el mismo
  documento** que el resto de la ficha — se guarda en una colección
  aparte, `rosterJuridico/{id}`, con reglas de Firestore que solo
  permiten leerla o escribirla a Admin. Esto es una restricción real
  a nivel de base de datos, no solo una pestaña oculta en la
  pantalla — así, aunque alguien inspeccionara las peticiones de red,
  seguiría sin poder acceder a esos contratos si no es Admin.

## Roster, Propuestas y Clientes

**Clientes** (`clientes.html`) — listado simple con categoría
(`privado`, `admin_publica`, `otros`), CIF, persona de contacto,
teléfono, email, dirección. Colección **`clientes/{id}`**.

**Roster** (`roster.html` + editor `roster-detalle.html`) — ficha por
cada espectáculo/artista, colección **`roster/{id}`**:
- Nombre, oficina de representación, notas.
- Cartel/imagen (comprimida y guardada en Firestore, igual que el
  logo de la empresa).
- Contactos en lista libre (nombre, cargo, teléfono, email).
- Redes sociales en lista libre (plataforma + URL).
- Rider técnico en PDF — se guarda directamente en Firestore como
  base64; por eso hay un límite práctico de ~600 KB por archivo (sin
  Firebase Storage, que en el plan Spark actual requiere activar
  facturación). Si algún rider pesa más, habría que comprimirlo o, más
  adelante, pasar a Blaze + Storage.
- **Calculadora**: Caché (BI) + Comisión (elegida de Administración →
  Comisiones, o manual) = Total; Total + IVA (% manual) = Total con
  IVA. Se recalcula en vivo al escribir.

**Propuestas** (`propuestas.html` + editor `propuesta-detalle.html` +
vista `propuesta-ver.html`) — colección **`propuestas/{id}`**, ID
correlativo `PROV<año>-0001`:
- Nombre, cliente vinculado (opcional), estado (Borrador / Enviada /
  Aceptada / Rechazada), notas internas.
- Opciones (`items`): se añaden desde el Roster (copian imagen y
  nombre automáticamente) o a mano, cada una con descripción y precio
  opcional.
- Botón **"Ver como cliente"** abre `propuesta-ver.html?id=...` en una
  pestaña nueva: una vista limpia, sin menú lateral, pensada para
  enseñar en una tablet u otro dispositivo delante del cliente.
  Sigue requiriendo sesión iniciada (la abre el propio empleado ya
  logueado) — no es un enlace público para compartir por WhatsApp o
  email; eso sería un paso más (habría que abrir permisos de lectura
  pública para esa propuesta concreta).

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
