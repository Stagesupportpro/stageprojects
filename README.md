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

## Producción — Taquilla (Fourvenues)

Nueva pestaña que aparece solo cuando la producción tiene un
**Booking vinculado** (siempre "como promotora", ya que solo esos
bookings aparecen en ese selector). De momento es **entrada manual**:
entradas vendidas, % de comisión de la tiquetera (opcional) y notas.
Calcula ingreso bruto, comisión, ingreso neto, y lo compara contra el
**break even** ya calculado en Cifras (cuántas entradas faltan, o el
margen si ya está superado).

Solo cuenta el **precio de entrada general** definido en Cifras — si
una entrada lleva un servicio adicional (ej. "entrada + cena"), ese
extra no se incluye porque no corresponde a la producción.

> **Sobre conectar la API de verdad**: ya está investigada — Fourvenues
> tiene una API REST (`api.fourvenues.com/integrations`, cabecera
> `X-Api-Key`) donde `GET /tickets` devuelve, por cada entrada, el
> `price` (precio base) separado de `total_extras` (los suplementos
> tipo "cena") — encaja exactamente con lo que necesitáis. Pero está
> pensada para llamarse desde un servidor, no desde el navegador
> (riesgo de exponer la clave + posible bloqueo por CORS), así que
> conectarla de verdad requiere un pequeño intermediario (Cloud
> Function de Firebase, lo que implica pasar del plan gratuito Spark
> al de pago Blaze — tiene una capa gratuita amplia). Cuando queráis
> dar ese paso, ya tengo mapeados los endpoints exactos a usar.

## Información y Backup (Administración)

Nuevo submenú, solo Admin:

- **Contadores de numeración** — muestra el último número usado este
  año para cada prefijo (PRO, HR, PROV, BO, PR) y permite reiniciarlo
  a 0000. Úsalo con cuidado: reiniciar un contador con IDs ya usados
  puede hacer que se repitan.
- **Backup completo** — descarga un `.json` con todas las colecciones
  de la plataforma (usuarios, bookings, producciones, roster,
  propuestas, clientes, venues, etc.), por si hace falta restaurar
  algo o guardar una copia aparte de Firebase.

## Ajustes rápidos

- **Preparar Propuesta**: al añadir una opción desde el Roster, ahora
  también se trae la descripción comercial (antes solo el cartel).
  Además, cualquier opción (venga del Roster o sea manual) permite
  subir o cambiar su foto con el botón "Cambiar foto".
- **Producción**: al vincular un booking ya **no salta solo** a la
  pestaña Cifras — se queda donde estabas.

## Preparar Propuesta — precios opcionales, fecha y ciclo por opción

Cada propuesta tiene ahora un interruptor **"Mostrar precios al
cliente"** (Sí/No). Cada opción añadida (desde Roster o manual) tiene
también:

- **Fecha** y **Ciclo / Festival / Actuación** — para organizar
  propuestas con varias actuaciones (un festival con varias fechas,
  por ejemplo).
- **Caché (BI)**, **Comisión %** (autocompletada desde el Roster si
  la opción viene de ahí) e **IVA %** (21% por defecto).

Si "Mostrar precios" está en Sí, la vista pública (la que ve el
cliente) muestra **PVP** (BI + comisión ya incluida — la comisión en
sí nunca se ve por separado), el importe de **IVA** y el **Total**.
Si está en No, esa propuesta se enseña solo como programa, sin ningún
precio. El equipo interno siempre ve y edita BI/comisión/IVA,
independientemente del interruptor — este solo afecta a lo que ve el
cliente.

## Producción — Artista / Espectáculo

Nueva sección al principio de Cifras: nombre del artista, **Caché
(BI)** e **IVA** (21% por defecto, editable). Se importa solo al
vincular un booking (junto con el coste del venue), pero también se
puede rellenar a mano. El total con IVA se suma a los gastos
generales igual que Costes, Personal y Hospitalidad. La categoría
"Caché" se quitó de la lista de Costes sembrada por defecto para no
duplicarla — ahora vive aquí, con su propio IVA independiente. El
nombre del artista también aparece como columna en el listado de
Producciones.

## Bookings — Venue de una lista, no de texto libre

El campo de Recinto/Festival dejó de ser un buscador de texto libre
(aunque tuviera sugerencias): ahora es un desplegable real que solo
permite elegir un venue ya dado de alta — imposible escribir uno que
no exista.

## Bookings en Producción, y roles en Usuarios — arreglado

Mismo patrón de índice compuesto que Notas/Agenda, esta vez en la
consulta de bookings de Producción — arreglado igual (sin `orderBy`,
ordenado en el navegador). Además, ahora **al elegir un booking se
importan solos** coste, sala, reparto y aforo — ya no hace falta
pulsar un botón aparte (se puede volver a forzar con "Actualizar
desde el booking", y ya no duplica la línea de coste si se reimporta).

El desplegable de rol en Usuarios estaba fijo con las 3 opciones
originales — ahora tira en vivo de Administración → Roles.

## Etiquetas en Roster y Catálogo

Cada ficha del Roster tiene ahora **Categoría** (Artistas, Espectáculos,
Tributos, Teatro) y **Etiquetas** libres (con sugerencias: Música de
Raíz, Emergentes, Electrónica/DJ, Rock...). El Catálogo tiene una
barra de filtros que combina categorías y etiquetas de todo lo que
haya en el Roster.

## Tipo de venue

Cada venue tiene ahora un **Tipo** (Auditorio, Teatro, Sala de
conciertos, Aire libre, Otros), visible también en el listado.

## Personal asignado en Producción (Cifras)

Nueva sección en Cifras: se puede asignar personal (de Usuarios o de
la bolsa de Personal externo) con su **BI (€/jornada)** y el número
de jornadas — **1** (BI), **1,5** (BI + 50% BI) o **2** (BI + BI). El
total se suma automáticamente a los gastos generales (Costes,
Simulación, break even y Taquilla ya lo tienen en cuenta).

## Notas y Agenda vacías — arreglado

Las consultas combinaban un filtro (`where`) con un orden (`orderBy`)
en campos distintos, lo que exige un índice compuesto que no existía
en Firestore — por eso no se veía nada, sin ningún aviso claro. Se
quitó el `orderBy` de las consultas y ahora se ordena directamente en
el navegador. No hace falta crear ningún índice ni tocar las reglas.

## Venues — Aforo (total o segmentado)

En la ficha del venue, antes de Contactos: **Aforo total** (un solo
número) o **Aforo segmentado** (varias zonas con nombre y capacidad —
Platea, Grada, VIP...), con el total sumado automáticamente. Se
guarda en `venues/{id}.aforo` (`{ tipo, total, segmentos[] }`).

El listado de Venues muestra ya la columna Aforo. Y en Producción, al
pulsar "Importar coste de alquiler del booking" en Cifras, el aforo
del venue vinculado se trae solo (sea total o la suma de segmentos).

## Venues — Aforo (total o segmentado)

Cada venue tiene un campo `aforo`: o bien **total** (una sola
capacidad), o bien **segmentado** (por zonas — platea, grada, VIP...
cada una con su propio nombre y capacidad, sumadas automáticamente).
Se ve en el listado de Venues, y **Producción** lo importa solo al
pulsar "Importar coste de alquiler del booking" en Cifras — así el
campo Aforo de la simulación no hay que rellenarlo dos veces.

## Venues — modalidades por porcentaje

Cada modalidad de un venue (`venues/{id}.tarifas[]`) ahora es:
`concepto`, `importe` (alquiler), `taquillaCompartida` (booleano) y,
si aplica, `pctPromotor` / `pctVenue` — dos porcentajes explícitos en
vez de asumir que se reparten al 100%. Sustituye al antiguo sistema
de tramos por rango de recaudación. El cambio se propaga a Bookings
(al elegir modalidad) y a Producción → Cifras (la tabla de simulación
usa ambos porcentajes directamente).

## Menú responsive

- Las tablas (`users-table`) ahora tienen scroll horizontal propio en
  pantallas estrechas, en vez de desbordar o romper el diseño.
- El menú lateral en móvil/tablet (por debajo de 900px) ahora **flota
  sobre el contenido** en vez de empujarlo hacia abajo, y se cierra
  solo al tocar fuera de él.
- Modales, selectores de tipo (Booking), la cuadrícula de permisos
  (Roles) y las fichas de solo lectura se ajustan a una sola columna
  en pantallas muy estrechas (< 420-480px).

## Número de versión

Debajo del usuario logueado, en el menú lateral, aparece la versión
de la plataforma (`VERSION_PLATAFORMA` en `js/nav.js`) — súbela a
mano cada vez que publiquéis una ronda de cambios importante.

## Gestión Contratos, Bookings como página completa, y contratos generados

Todo esto ya estaba construido de un paso oculto anterior — lo audité
a fondo (ver más abajo) antes de darlo por bueno.

**Administración → Gestión Contratos**: dos pestañas — Contratos
Booking y Contratos Colaboración. En cada una, una lista de
cláusulas (título + texto), editables y eliminables, guardadas en
`contratosConfig/booking` y `contratosConfig/colaboracion`.

**Bookings ya no es un modal** — pasó a ser una ficha completa
(`booking-detalle.html`) con 3 pestañas, igual que Producción:
- **Información general** — lo mismo que antes (tipo, artistas,
  venue/modalidad, cliente/propuesta, fecha).
- **Cifras** — la calculadora, ahora en su propia pestaña.
- **Contratos** (nueva) — botón "Generar contrato" que recopila las
  cláusulas de Contratos Booking, los datos del cliente (o del venue,
  si es "como promotora"), y por cada artista: su caché ya calculado,
  sus **Cláusulas Especiales** (ver más abajo) y sus riders técnicos
  como anexo. Genera un documento con Reconocimientos, Objeto del
  contrato, Condiciones básicas, Condiciones especiales por artista,
  Anexos y casillas de firma — con el logo de documentos de la
  empresa (el mismo de Hojas de Ruta) — listo para **Imprimir** o
  **Exportar PDF**.

El listado (`bookings.html`) ahora solo crea un registro mínimo y
redirige a la ficha completa, igual que Producciones y Hojas de Ruta.

**Roster → Jurídico**: además del contrato de colaboración, cada
ficha tiene ahora **Cláusulas Especiales** propias (título + texto,
editables/eliminables) que se usan automáticamente al generar el
contrato de cualquier booking en el que participe ese artista. Vive
en la misma colección `rosterJuridico` (protegida solo para Admin) —
si alguien sin ese permiso genera un contrato, esa parte se omite sin
romper el resto del documento.

## Auditoría de este bloque — cómo se verificó

Como en Producción encontramos errores reales de sintaxis
(`await` fuera de función `async`), audité este bloque más a fondo:

- **`node --check`** en los 33 archivos JS del proyecto — es una
  verificación real del intérprete, no una heurística; confirma sin
  ambigüedad si hay errores de sintaxis (incluido `await` mal usado,
  que sí lo detecta). Cero errores en todo el proyecto.
- Comparación automática de cada `onclick`/`onchange`/`oninput` del
  HTML contra las funciones definidas en su JS — cero llamadas a
  funciones inexistentes.
- Comparación de cada `getElementById(...)` del JS contra los `id`
  reales del HTML — cero IDs que no existen.
- Todas las colecciones de Firestore que usa el código, comparadas
  una a una contra las reglas — todas cubiertas (incluida
  `contratosConfig`, que ya estaba).
- Encontrado y arreglado un hueco real aparte: faltaba
  `booking-detalle.html` en el mapa de permisos de `js/auth.js` — sin
  eso, nadie habría podido abrir la ficha completa de un booking por
  mucho acceso que tuviera a Bookings.

## Roles — Admin ya no necesita sincronizarse a mano

Cada vez que añadimos una sección nueva, los roles que ya existían en
tu Firestore no la recibían solos (el "Sincronizar páginas nuevas" de
Roles lo arreglaba, pero solo si te acordabas de pulsarlo). Ahora el
rol **Admin se autosincroniza solo en cada login** (`js/auth.js`): si
detecta una página que no tenía marcada, se la añade y la guarda sin
que tengas que hacer nada — así Admin siempre tiene acceso completo
desde el primer momento tras añadir algo nuevo a la plataforma.

Para el resto de roles (Comercial, Producción, o cualquiera
personalizado que crees), sigue sin ser automático **a propósito** —
darle acceso a una sección nueva es una decisión tuya, no algo que
deba pasar solo. El botón "🔄 Sincronizar páginas nuevas" en Roles
sigue ahí para esos casos: añade la página que falte sin marcar, para
que la actives cuando quieras.

## Marketing — nueva sección para el Community Manager

Nuevo grupo "Marketing" en el menú, con dos páginas:

- **Calendario CM** — cuadrícula mensual como la del Calendario
  general, pero mostrando las **campañas activas cada día por rango
  de fechas** (inicio–fin), no un único día por evento — un punto de
  color por plataforma (Meta, Instagram, Facebook, TikTok, Google
  Ads, LinkedIn). Arriba, una fila de **herramientas rápidas**: Meta
  Business Suite, Ads Manager, Instagram, TikTok Ads, Google Ads,
  Canva, Analytics y acceso directo a la Agenda personal.
- **Campañas** — listado y ficha de cada campaña: nombre, plataforma,
  estado (Planificada/Activa/Pausada/Finalizada), fechas de
  inicio/fin, presupuesto, enlace al gestor de anuncios, objetivo y
  notas.

Nueva colección `campanas`, con reglas para cualquier empleado activo
(igual que Roster o Venues).

## Enviar a evaluar — mejor diagnóstico

Revisado el código por tercera vez — sigue sin encontrarse ningún
fallo real ahí ni en las reglas. Como ya van dos avisos de que sigue
fallando, mejoré el manejo de errores: ahora, si vuelve a fallar, el
aviso muestra el **código y mensaje real de Firebase** (y se queda
en pantalla más tiempo, 12 segundos) en vez de un mensaje genérico —
así, si pasa otra vez, se puede diagnosticar la causa exacta de
verdad en vez de descartar posibilidades a ciegas.

## Logo de la Propuesta — mucho más grande

De 48px a 130px.

## Datos huérfanos al eliminar — encontrados dos huecos más y ampliada la limpieza

Auditados todos los botones de eliminar del sistema. Encontrados dos
huecos reales, además de los que ya arreglamos con Bookings/
Producciones/Hojas de Ruta:

- **Eliminar una Propuesta** no borraba su **Evaluación** (si se había
  mandado a valorar) — se quedaba huérfana, visible en el panel de
  Evaluaciones pendientes del Dashboard.
- **Eliminar del Roster** no limpiaba ni sus fechas del **Calendario
  del Roster**, ni su ficha **Jurídica** — se quedaban ambas
  apuntando a un artista que ya no existe.

Ambos arreglados de raíz — de aquí en adelante, cada eliminación
limpia detrás de sí misma sola.

La herramienta de limpieza puntual de **Administración → Información
y Backup** ahora cubre las tres cosas de una vez (antes solo cubría
el Calendario general): entradas del Calendario general, Evaluaciones
de propuestas ya borradas, y entradas del Calendario del Roster —
comprobando en cada caso si lo que referencian todavía existe de
verdad. Es un botón de un solo uso para limpiar lo que se quedó
suelto de las pruebas anteriores a estos arreglos; no hace falta
repetirlo después de una eliminación normal a partir de ahora.

## Calendario anual — formato de la referencia (apaisado, con fines de semana marcados)

Vuelto a apaisado (6 meses por fila, 2 filas), tal como el PDF de
referencia que mandaste — la versión vertical de la ronda anterior
quedaba muy apretada, y este formato encaja mejor y es el que
querías. Añadido también el detalle que le faltaba: los **fines de
semana se marcan con el número del día en gris**, igual que en la
referencia; si ese día tiene una fecha del artista, el color del
evento (verde/ámbar) manda por encima de la marca de fin de semana,
igual que en el PDF original.

## Registro de Servicios — "Crear registro" no hacía nada

Confirmado: si todavía no hay ningún cliente creado (normal estando
en pruebas), el desplegable de Cliente se quedaba solo con el
placeholder, y como el campo es obligatorio, el navegador bloqueaba
el envío con un aviso nativo diminuto — parecía que el botón no hacía
nada. Ahora, si intentas crear un registro sin cliente disponible, te
lo dice claramente ("todavía no hay ningún cliente creado — da de
alta uno primero"), en vez de depender de ese aviso casi invisible
del navegador.

## Calendario general — ya se mantiene actualizado al borrar

Confirmado el fallo: Bookings, Producciones y Hojas de Ruta creaban
su marca en el Calendario general al guardarse, pero **ninguno la
borraba** al eliminar el registro — de hecho, el propio aviso de
confirmación de Producción y Hoja de Ruta ya admitía la limitación
("esto no borra su marca en el calendario"), sin haberse llegado a
arreglar. Ahora sí: al eliminar cualquiera de los tres, su entrada
del Calendario general desaparece con él (y la del Calendario del
Roster también, en el caso de Producción, que se había quedado sin
esa limpieza).

Para las entradas que **ya** se quedaron huérfanas de cosas que
borraste durante las pruebas (antes de este arreglo), añadí una
herramienta puntual en **Administración → Información y Backup**:
"🧹 Buscar y limpiar entradas huérfanas" — revisa cada entrada
relacionada con Bookings/Producciones/Hojas de Ruta y borra solo las
que apuntan a algo que ya no existe. Es un clic único, no hace falta
repetirlo — de aquí en adelante se mantiene solo.

## Tu flujo de trabajo

Gracias por detallarlo — así puedo tenerlo en cuenta de aquí en
adelante. Encaja bien con lo que hay construido: Catálogo → Propuesta
(con "Enviar a evaluar" para los costes de producción antes de
mandarla al cliente) → Booking (con Contratos y Estado
Pendiente/Aceptado/Rechazado) → Producción (vinculando el booking, o
actualizando la que ya existiera desde la evaluación) → Hoja de Ruta.
El único tramo que todavía no existe es el **Cierre del evento**
(adjuntar tickets/facturas, expediente de cierre, resumen para pasar
a Holded) — dijiste que lo dejamos para más adelante, así que no lo
he tocado; avísame cuando quieras que lo construyamos.

## Booking — fecha por artista (arreglado el fallo de sincronización)

Confirmado: un booking puede tener varios artistas, cada uno con
fechas distintas, pero la sincronización con el Calendario del Roster
metía a todos bajo la misma fecha del booking. Cada artista tiene
ahora un campo **Fecha propia (opcional)** en su fila — si se deja
vacío, sigue usando la fecha general del booking (compatible con
todos los bookings ya creados, que no cambian de comportamiento). Si
el booking viene de una Propuesta con fechas distintas por ítem,
también se importa la fecha de cada uno automáticamente. El aviso de
conflicto también se corrigió para comprobar y mostrar la fecha
correcta de cada artista, no una única para todos.

## Calendario anual — ajustado a una sola A4

El logo (140px, pensado para otros documentos) y los márgenes se
comían demasiado espacio vertical aquí. Reducido específicamente para
este documento (sin tocar el tamaño en Hoja de Ruta/Contratos/
Propuesta), y quitada una regla de "pantalla estrecha" que podía
colar 2-3 columnas por error en vez de las 12 meses en 6+6 siempre.
El botón "Imprimir" ahora también fuerza apaisado (A4 horizontal)
solo mientras se imprime este documento en concreto.

## Registro de Servicios — un registro = un cliente

El listado y la ficha completa ya tenían el cliente a nivel de todo
el registro (no por línea) — eso ya estaba bien de un paso anterior.
La que se había quedado desactualizada era la ficha **"Ver"** (la
que exportas en PDF): seguía mostrando "Cliente" como columna de
cada línea, un dato que ya no existe ahí. Corregido — ahora el
cliente aparece una sola vez, bajo el título del registro (en
pantalla y en el PDF/impresión), y las líneas solo llevan lo que les
corresponde: Servicio, Actuación, Localización, Fecha, Importe y
Forma de pago. De paso, la búsqueda del listado ahora también
encuentra por nombre de cliente, no solo por nombre del registro.

## Tipos de Servicio / Registro de Servicios — permisos

Ambos errores ("permission-denied") venían de la misma causa de
siempre: las reglas de Firestore, en tu Firebase, todavía no
reflejaban lo último. Las reglas de nuestro archivo ya eran
correctas (revisadas línea a línea, sin colecciones duplicadas ni
desbalances) — solo hacía falta volver a publicarlas enteras.

## Catálogo — cada producto con su propia página

Antes cada espectáculo se abría en un modal encima del listado.
Ahora cada uno tiene su **página propia** (`catalogo-producto.html`),
con toda su información: descripción, campos adicionales, galería,
vídeos y redes sociales.

- **Fotos** (cartel y galería): al pulsarlas se abren en un **visor
  ampliado** a pantalla completa, con botón de cerrar (✕) — también
  se cierra con la tecla Escape o pulsando fuera de la imagen.
- **Vídeos de YouTube**: al pulsar la miniatura se abren en ese mismo
  visor ampliado, pero **incrustados** (no se sale de la plataforma
  hacia YouTube) — al cerrar, el vídeo se para solo.

## Calendario de disponibilidad del Roster (sistema completo)

Gran parte de esto ya estaba construido de un paso oculto anterior
(la lógica de sincronización, conflictos y el motor del calendario
anual imprimible, en `js/calendario-roster.js`) — lo audité a fondo,
estaba muy bien hecho, y completé las dos piezas que le faltaban de
verdad: la pestaña Calendario en Roster y la página maestra de
Booking & Management (ninguna de las dos existía todavía).

**Cómo funciona, de punta a punta:**

- **Bookings y Producciones** tienen un campo **Estado**: Pendiente
  Confirmación / Aceptado / Rechazado. Al guardar, cada artista del
  booking (o el de la producción) sincroniza sola una entrada en el
  calendario del Roster — un documento por (origen, artista), así que
  guardar el mismo booking dos veces nunca duplica nada, y si quitas
  un artista, su entrada desaparece sola.
- **Aviso de conflicto** (lo más importante, tal como dijiste): al
  elegir un artista o cambiar la fecha/estado en un Booking o
  Producción, si ese artista ya tiene algo Pendiente o Aceptado ese
  mismo día en **otro** booking/producción, salta un modal avisando
  y diciendo en qué registro está ocupado — sin bloquear del todo,
  puedes decidir seguir igualmente si hace falta.
- **Roster → pestaña Calendario** (nueva): todas las fechas de ese
  artista — las que vienen de Bookings/Producciones se ven de solo
  lectura (con enlace para abrir el origen), y además se pueden
  añadir **fechas manuales** directamente ahí (fecha, ciudad, estado),
  editables y eliminables sin pasar por ningún booking.
- **Calendario Roster** (nuevo, en Booking & Management): vista
  general en cuadrícula mensual de **todo** el Roster a la vez, con
  un punto verde (Aceptado) o ámbar (Pendiente) por cada fecha, y
  **filtro por texto** (artista/espectáculo). Lo Rechazado nunca
  aparece en ningún calendario.
- **Exportar PDF / Imprimir**, tanto desde Roster (por artista) como
  desde el Calendario Roster maestro — genera exactamente el mismo
  formato que tu PDF de referencia: 12 meses en cuadrícula, un día
  por fila, coloreado por estado, con el nombre de la ciudad (y del
  artista si son varios a la vez), logo de Stage Support **+ logo del
  propio artista** en la cabecera, y fecha/hora de impresión en el
  pie. Si filtras el maestro a un único artista, el PDF usa
  automáticamente su logo, igual que si lo exportaras desde su propia
  ficha.

Nueva colección `calendarioArtistas` (las reglas ya estaban
correctas). De paso, añadí "Medios" y "Calendario" al árbol de
permisos de Roles (a Medios se le había olvidado en su momento).

## Registro de Servicios — reestructurado a informes mensuales

Cambiado el modelo, tal como pediste: los reportes al cliente son
mensuales, así que ahora un "registro" agrupa varias **líneas** de
servicio, en vez de ser una fila suelta por cada servicio.

- **Listado** (`registro-servicios.html`) — uno por informe, con
  Nombre (ej. "Diciembre 2026"), número de líneas e Importe a pagar
  ya calculado. Búsqueda por texto, y las mismas acciones que
  Producciones/Bookings: **Abrir** (ficha completa), **Ver**
  (imprimir/PDF), **Crear nueva versión** (⎘), Eliminar.
- **ID correlativo**: `R<año>-0001` (prefijo `R`), igual que
  PRO/HR/PROV/BO/PR.
- **Ficha completa** (`registro-servicio-detalle.html`, se abre con
  "Abrir") — Nombre del registro arriba, y debajo tantas **líneas de
  servicio** como haga falta, cada una con Cliente (conectado a
  Clientes), Servicio (conectado a Tipos de Servicio — autocompleta
  la tarifa), Actuación, Localización, Fecha, Importe (BI) y Forma de
  pago (Pendiente / Factura — con Núm. de factura / Efectivo). Todo
  editable línea a línea, con su propio Total calculado al momento.
- **Totales dentro de cada registro** (ya no son globales de toda la
  plataforma): Total Efectivo, Total Factura (BI), **IVA 21% solo
  sobre Factura**, Total Pendiente, e **Importe a pagar** — se
  recalculan solos según las líneas que tenga ese informe en
  concreto.
- **Ficha "Ver"** (`registro-servicio-ver.html`) — tabla con todas
  las líneas del informe + los totales, lista para **Exportar PDF**
  o **Imprimir**, con el logo de documentos y la fecha/hora de
  generación en el pie — el documento que le mandarías al cliente.

De paso, revisé el backup completo y encontré que faltaban tres
colecciones que ya existían pero nunca se habían añadido a la lista
de exportación: `contratosConfig`, `campanas` y ahora
`registroServicios` — ya están las tres incluidas.

## Roster — "Añadir campo" no funcionaba (fallo real encontrado)

La causa: al construir tanto los **Campos adicionales** como los
**vídeos de YouTube**, el código llamaba a una función
`escaparAttrRstD` que **nunca llegó a existir** en el archivo (un
error de nombre desde que se construyeron ambas funciones) — el clic
sí añadía el campo por dentro, pero al intentar pintarlo en pantalla
fallaba en silencio (solo visible en la consola del navegador), así
que parecía que el botón no hacía nada. Esto también explica que los
vídeos de YouTube probablemente seguían sin funcionar del todo pese
al arreglo anterior del foco — corregidas las 5 apariciones, usando
la función correcta que sí existe (`escaparAttrRst`).

## Servicios — mejor diagnóstico si vuelve a fallar

Revisado el código de guardado de Tipos de Servicio — correcto, y las
reglas de Firestore para `tiposServicio` también están bien en
nuestro archivo. Como no lo puedo reproducir yo mismo, apliqué la
misma mejora que en "Enviar a evaluar": si vuelve a fallar, el aviso
mostrará el **código y mensaje real de Firebase** en vez de uno
genérico.

## Roster/Medios — YouTube no dejaba escribir enlaces (arreglado)

Fallo real: cada letra que se escribía en el campo del enlace volvía
a pintar toda la lista de vídeos entera (para actualizar la
miniatura), lo que destruía y recreaba el propio campo de texto —
perdías el foco a cada letra, casi imposible escribir un enlace
completo de un tirón. Ahora la miniatura se actualiza aparte (al salir
del campo), sin tocar el campo de texto mientras escribes.

## Búsqueda y filtros en los listados

Añadido a **Roster, Catálogo, Venues, Clientes, Producciones y Hojas
de Ruta**:

- **Roster** — búsqueda por texto (nombre, oficina) + chips de
  Categoría.
- **Catálogo** — búsqueda por texto añadida sobre los chips de
  categoría/etiqueta que ya tenía.
- **Venues** — búsqueda por texto (nombre, dirección) + chips de
  Tipo de venue.
- **Clientes** — búsqueda por texto (nombre, contacto, email) + chips
  de Categoría.
- **Producciones** — búsqueda por texto (nombre, artista, ID).
- **Hojas de Ruta** — búsqueda por texto (nombre, producción, ID).

Los chips de categoría/tipo se generan solos a partir de lo que haya
realmente dado de alta — si no hay ningún valor de ese tipo todavía,
no aparece ninguna fila de chips (no se sembraron categorías fijas a
la fuerza).

## Roster — foto solapada en "Ver" (arreglado) y campos adicionales

**El solape de la foto con el texto**: el estilo de la miniatura
(`.poster-preview`) solo se aplicaba cuando estaba dentro de un
contenedor `.poster-picker` — en la ficha "Ver" se usa suelta, así
que no recibía ningún tamaño ni recorte, y la imagen se expandía a su
tamaño real por encima del texto. Ahora el estilo funciona igual
tanto suelta como dentro de ese contenedor.

**Campos adicionales en Descripción comercial**: botón "+ Añadir
campo" que añade pares de **Título + Descripción** (para datos tipo
ficha técnica: fecha de estreno, duración, edad recomendada...). El
título aparece en negrita, como una lista, tanto en la ficha del
Roster ("Ver") como en el Catálogo — separado de la descripción
principal, así ya no hay que meterlo todo apretado en un único bloque
de texto.

## Ronda de arreglos y funciones nuevas (7 puntos)

**1. Roster/Jurídico — Datos fiscales.** Nueva sección (razón
social, NIF/CIF, representante, dirección fiscal, email, teléfono,
IBAN) por artista, conectada al generador de contratos de Bookings —
aparece sola en las condiciones especiales de cada artista al generar
un contrato.

**2. Dashboard — notificaciones que no se podían eliminar.** No
existía ninguna función para borrarlas — solo se podían marcar como
leídas (y ni siquiera eso confirmaba nada, por el siguiente punto).
Añadido botón de eliminar por notificación y "Eliminar todas". De
paso, encontrado y arreglado otro fallo real: `decidirEvaluacion()`
llamaba a una función `mostrarToast` que **nunca había existido** en
`dashboard.js` — por eso no se veía confirmación al aceptar/rechazar
una evaluación de propuesta. Ya está definida, con su elemento en el
HTML.

**3. Calendario de Marketing sin cuadrícula.** Mismo patrón de
siempre: si la consulta a Firestore fallaba (reglas no publicadas,
por ejemplo), la función que pinta los días del mes nunca llegaba a
ejecutarse. Ahora la cuadrícula se pinta siempre, independientemente
de si los datos de campañas llegan o no — apliqué la misma protección
al Calendario general por si acaso.

**4. Propuestas — coste de producción opcional por artista.** Nuevo
campo en cada opción: "Costes de producción para esta fecha" — suma
directo al Total de ese artista (sin comisión ni IVA aparte, es un
traspaso de coste real), con su propia línea en el desglose que ve el
cliente.

**5. Nueva sección "Servicios".** Dos submenús: **Tipos de Servicio**
(funcional — nombre, descripción, tarifa, unidad de cobro) y
**Registro de servicios** (en stand by, tal como pediste — no se ha
construido el formulario todavía). Nueva colección `tiposServicio`.

**6. Logo de la vista de Propuesta — mucho más grande.** De 130px a
220px.

**7. Auditoría responsive.** Revisé específicamente todo lo añadido
en las últimas rondas (Marketing, Servicios, Contratos, Bookings como
página completa): sin bloques `flex` sueltos sin `flex-wrap`, todo
reutiliza las clases ya responsive del proyecto (`.form-grid`,
`.herramientas-cm-grid`, etc.). Encontré y arreglé dos casos menores
sin cubrir del todo: la galería de fotos del Roster/Catálogo pasa a 2
columnas en pantallas muy estrechas (antes 3, algo apretado), y las
cajas de firma de los contratos se apilan en una columna por debajo
de 500px si se previsualizan en el navegador antes de exportar a PDF.

## Producción — pestaña Técnica

Nueva pestaña "Técnica" con el presupuesto de proveedores técnicos:
**Núm. presupuesto, Proveedor, Concepto, BI, IVA, Total** (calculado
solo). El total se suma a Cifras igual que Personal — ambos tienen
ahora su propia línea visible en el Resumen ("Personal" y "Técnica"),
además de entrar en el break even de Taquilla.

## Dashboard — en vivo de verdad, con paneles nuevos

**La causa de que no se mantuviera actualizado**: los indicadores y
los accesos directos se cargaban con una sola lectura (`.get()`) al
abrir la página — si algo cambiaba mientras la tenías abierta, no se
enteraba. Ahora usan escucha en vivo (`onSnapshot`), igual que
Notificaciones y Evaluaciones (que ya eran en vivo desde el
principio).

Tres paneles nuevos, todos en vivo y solo visibles si el rol tiene
el permiso correspondiente:
- **Activo ahora** — lo que hay en el Calendario en los próximos 14
  días.
- **Propuestas pendientes** — las que están en Borrador o Enviada,
  con un clic directo a cada una.
- **Próximas citas** — de tu Agenda (propias + compartidas), también
  a 14 días vista.

## Producción — bookings y artista, arreglados

- El desplegable **"Booking vinculado"** solo mostraba bookings "como
  promotora" — si solo tenías bookings "a caché", no aparecía
  ninguno. Ahora muestra todos, con una etiqueta indicando el tipo.
- El campo **Artista / Grupo** era un simple texto sin ninguna
  conexión real — ahora es un desplegable conectado de verdad al
  Roster (autocompleta el caché sugerido en Costes si aún no tenía
  importe). Al vincular un booking con un único artista, se
  selecciona solo; con varios, se muestran todos los nombres juntos.
- De paso until: al importar un booking "a caché" se creaba una fila
  fantasma de "Alquiler venue" a 0,00 € (ese tipo de booking no tiene
  coste de venue) — ya no se crea esa fila en ese caso.

## Hojas de Ruta — revisado

Auditoría completa (sintaxis, referencias, conexión con Roster) —
todo correcto, sin cambios necesarios. Ya conectaba bien con el
Roster desde el principio (es el mismo patrón que acabamos de aplicar
a Producción).

## Logo más grande en documentos imprimibles

Aumentado en los tres sitios donde aparece: Hoja de Ruta y Contratos
(102px → 140px) y la vista/PDF de Propuesta (32px → 48px).

## Notas — eliminar compartidas, marcar leída/no leída

Las notas que otra persona te comparte ahora se pueden **quitar de tu
lista** (no borra el original para quien la compartió ni para el
resto), y cualquier nota (tuya o compartida) se puede marcar como
**leída / no leída** — las no leídas llevan un punto de color y un
borde lateral para distinguirlas de un vistazo. Al crear una nota,
queda marcada como ya leída para quien la crea.

Para esto hizo falta ampliar un poco las reglas de Firestore de
`notas` y `agenda`: antes solo el propietario podía actualizar el
documento — ahora también puede quien la recibe compartida (para
poder marcarla leída o quitarse de la lista), pero **borrarla del
todo sigue siendo solo cosa del propietario**.

## Auditoría de vinculación de datos (todas las páginas)

Comparación automática, en cada página con ficha completa, entre lo
que se **guarda** y lo que se **carga de vuelta** — para encontrar
campos que se pierden al recargar. Resultado: **sin fallos reales**.
Los dos casos que salieron en la primera pasada eran falsos
positivos (campos usados legítimamente desde el listado, no desde la
propia ficha). También until comprobé que no quedara ningún rastro
del modelo antiguo de Bookings (artista único) tras el cambio a
varios artistas — limpio.

## Roster y Catálogo — Medios (galería + vídeos de YouTube)

Nueva pestaña **Medios** en cada ficha del Roster:
- **Galería**: hasta 6 fotos, cada hueco se rellena pulsando encima
  (se comprimen automáticamente).
- **Vídeos de YouTube**: pega el enlace y se muestra la miniatura
  real del vídeo automáticamente (a partir del ID que se extrae del
  propio enlace).

Ambas cosas se ven también en el **Catálogo**, dentro de la ficha de
cada espectáculo al pulsarla.

## Auditoría — errores graves en Producción (arreglados)

Barrido completo del archivo (funciones definidas vs. llamadas,
IDs del HTML vs. los que busca el JS) y encontrados dos fallos reales
introducidos en un refactor anterior:

- `alVincularBookingProd()` usaba `await` sin ser `async function` —
  un error de sintaxis real que podía impedir que se cargara el
  script entero de la página.
- `nombresArtistasBookingProd()` estaba mal marcada como `async` y se
  usaba de forma síncrona — el desplegable de "Booking vinculado"
  mostraba literalmente `[object Promise]` en vez de los nombres.

Ambos arreglados. Repetí el mismo barrido en **todos** los demás
archivos JS del proyecto por si el mismo patrón se había colado en
otro sitio — no encontré ningún caso más.

## Auditoría — cuentas de usuario "en el limbo"

Encontrada la causa: crear un usuario son **dos pasos separados**
(cuenta en Firebase Authentication, luego perfil en Firestore). Si el
segundo paso falla por lo que sea, la cuenta de acceso queda creada
pero sin perfil — no puede entrar y no aparece en el listado de
Usuarios. Es lo que le pasó a `cgarcia@stagesupport.com`.

- **Para recuperar una cuenta así**: copia su UID desde Firebase
  Console → Authentication → Users, y crea a mano el documento que
  falta en Firestore → `usuarios` con ese mismo ID como nombre de
  documento (o, más simple, bórrala en Authentication y créala de
  nuevo normal desde la plataforma).
- **De cara a que no pase en silencio**: si el segundo paso falla
  ahora, el formulario te avisa explícitamente con el UID exacto de
  la cuenta a medio crear, en vez de fallar sin más explicación.

## Auditoría — permisos reales por rol (arreglo de raíz)

**El fallo que reportaste** ("creé un rol y no aparecen menús") tenía
una causa de fondo: desde el principio, el menú lateral y el acceso a
cada página comprobaban el **nombre literal** del rol
(`"Admin"`/`"Comercial"`/`"Producción"`), no los permisos que
marcabas en Administración → Roles. Un rol personalizado nunca podía
coincidir con esos tres nombres, así que no veía nada — daba igual lo
que marcaras en el árbol de permisos, porque nada lo estaba leyendo
de verdad. Quedó anotado como pendiente hace unas rondas y ahora es
justo lo que estabas notando.

**La solución**, en `js/auth.js` (se carga en todas las páginas):
- `protegerPagina()` ya no compara nombres de rol. Ahora carga los
  permisos reales del rol del usuario desde `roles/{id}` y decide el
  acceso según si esa página en concreto está marcada — funciona
  igual de bien para Admin/Comercial/Producción que para cualquier
  rol nuevo que crees.
- El **Dashboard** ("Personalizado para cada rol") ya no tiene
  ramas fijas por nombre de rol — muestra hasta 3 indicadores y hasta
  4 accesos directos según qué secciones ve realmente ese rol.
- El menú lateral (`js/nav.js`) se filtra igual, por permisos reales.

**Qué tienes que hacer para el rol que ya creaste**: entra en
Administración → Roles → edítalo → marca las secciones a las que
debería tener acceso → Guardar. No hace falta que nadie cierre sesión
— los permisos se recargan solos en cada página.

> **Límite conocido, por ahora**: esto controla el acceso a nivel de
> página completa (ej. "puede entrar en Roster o no"). Los checkboxes
> de pestañas internas (Roster → Jurídico, Producción → Cifras...) se
> guardan pero **todavía no se aplican** dentro de esas páginas — es
> el siguiente paso natural si hace falta ese nivel de detalle.

## Auditoría — importar backup

Antes solo se podía **exportar**. Ahora, en Información y Backup, hay
una segunda tarjeta "Restaurar desde backup": subes el `.json`
generado antes, y sobrescribe (por lotes de 400, dentro del límite de
Firestore) los documentos cuyo ID coincida con los del archivo — no
borra nada que no esté en el archivo. Pide confirmación explícita
antes de tocar nada, porque no tiene deshacer.

## Flujo completo: de Propuesta a Booking

Con todo lo construido hasta ahora, así queda encadenado el trabajo
de punta a punta:

1. **Preparar Propuesta** (Comercial) — se crea la propuesta, se
   añaden opciones desde el Roster (con fecha, ciclo, cartel,
   descripción y precio), y se decide si se muestran precios al
   cliente. Empieza en estado **Borrador**.
2. **Ver Propuestas** (nuevo submenú en Comercial) — listado de solo
   consulta con el estado de cada una. El botón **Ver** abre la
   propuesta en modo cliente (`propuesta-ver.html`), pensada para
   enseñarla desde un dispositivo delante del cliente.
3. Dentro de esa vista, dos acciones para el equipo:
   - **Exportar PDF** — descarga la propuesta tal cual la ve el
     cliente (usa html2pdf.js, igual que en Hojas de Ruta).
   - **Enviar a evaluar** — crea un registro en `evaluaciones`, pasa
     la propuesta a estado **Enviada**, y copia al portapapeles un
     enlace directo a esa propuesta para compartir por donde
     prefiráis (Slack, WhatsApp...).
     > No hay envío de correo real (ni automático ni con `mailto:`) —
     > sin servidor propio (plan gratuito de Firebase) no es fiable
     > hacerlo bien; lo descartamos explícitamente. El enlace
     > copiado cumple la misma función a mano.
4. **Dashboard → Evaluaciones pendientes** (Admin) — cada propuesta
   enviada aparece aquí con botones **Aceptar** / **Rechazar**. Al
   decidir, se actualiza el estado de la propuesta y **se notifica
   automáticamente** (con el sistema de notificaciones que ya
   teníamos) a quien la envió a evaluar.
5. Si se acepta, desde **Bookings** se puede crear un booking "a
   caché" con origen **"Desde propuesta"**, que ya trae el cliente
   vinculado — cerrando el círculo hasta la Producción.

## Bookings y Producción — varios artistas por booking

Un booking ya no está limitado a un solo artista: la sección
"Artistas" es una lista repetible (como Costes), cada uno con su
Roster, Caché (BI), Comisión % (oculta "como promotora", igual que
antes) e IVA %, con su Total calculado. El coste del venue (alquiler,
en bookings "como promotora") vive ahora en su propio bloque
independiente, separado del caché de los artistas — antes compartían
el mismo campo y se pisaban entre sí.

En Producción, al importar desde un booking, se crea una fila de
**Caché — &lt;nombre&gt;** en Costes por cada artista del booking
(además de la de "Alquiler venue"), y el campo "Artista / Grupo"
muestra todos los nombres separados por comas.

## Bookings — Venue obligatorio en los dos tipos

El selector de Venue (búsqueda + modalidad) ya no es exclusivo del
tipo "Como promotora": ahora es un campo común y obligatorio también
para "Fecha contratada (a caché)". La comisión sigue apareciendo solo
en el tipo a caché.

## Versiones (V1, V2...)

Bookings, Producciones y **Propuestas** tienen un botón "Crear nueva
versión" (icono ⎘) en el listado. Duplica el documento completo con
`version` +1, guardando `grupoVersionId` (apunta al id de la V1) y
`versionAnteriorId` (apunta a la versión de la que viene). La versión
original **no se borra ni se bloquea** — queda como histórico visible
en el listado, con su propio badge "V1", "V2"... Es una base sencilla
pensada para cuando un cliente pide cambios tras aceptar algo. En
Propuestas, además, la nueva versión siempre empieza en estado
"Borrador" (aunque la anterior estuviera Aceptada/Rechazada), y el
listado tiene también un botón **"Ver"** que abre directamente la
vista de cliente (`propuesta-ver.html`) en una pestaña nueva.

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
