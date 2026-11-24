# Roadmap de Cronota

Última revisión: 19 de noviembre de 2026 · Publicada: 2.13.0 (Microsoft Store); 2.14.7 publicada (envío 14); 2.14.8 enviada a certificación (envío 15). Solo se publica en la Store.

Las peticiones nuevas que vayan saliendo se apuntan en la fase que toque (las pequeñas, en la siguiente actualización pendiente) para no publicar cambios sueltos.

## Cómo se trabaja cada cambio

Todo cambio sigue siempre estos cuatro pasos, sin saltarse ninguno:

1. **Planificar**: antes de tocar código se escribe qué se va a hacer, cómo se va a probar y qué puede romperse. Álvaro lo revisa y da el visto bueno.
2. **Implementar y comprobar**: `npm run check` en verde, capturas en segundo plano (`tools/snap.js`) y, cuando haga falta usar la app de verdad, prueba acordada con Álvaro (nunca moviéndole el ratón sin avisar).
3. **Probar**: en modo pruebas (`tools/modo-pruebas.vbs`, ver `docs/notas-tecnicas.md`), con una copia de los datos y sin tocar la Cronota de verdad.
4. **Publicar, solo en la Microsoft Store** (desde el 16-11-2026, decisión de Álvaro: ya no se sacan versiones en GitHub). Paquete compilado en GitHub Actions («Paquete para la Microsoft Store») → en Partner Center, actualizar el envío, subir `cronota-store.appx`, poner las novedades y enviar a certificación.

## Fases

### Fase 0 · Paso a la Microsoft Store (2.9.1 – 2.9.6) — CERRADA

Desde el 16-11-2026 Cronota **solo se publica en la Microsoft Store**. Hecho:

- [x] Nombre Cronota en todo lo que se ve, repositorio `roblesgg/cronota`, logo nuevo y ficha de la Store con fotos y logos.
- [x] Paso de los usuarios del instalador a la Store (`migracion-store.js`, `src/migrar.html`), con arranque con Windows en la Store y copia diaria en `Documentos\Cronota\Copias automáticas`.
- [x] 2.9.4 y 2.9.5 publicadas en la Store (la 2.9.5 trae la copia de seguridad completa y quita las entradas repetidas del inicio de Windows).
- [x] 2.9.6 (sin publicar): sin ventana de bienvenida tras el traspaso.
- Descartado (17-11-2026): fotos nuevas con ChatGPT, más versiones o arreglos para la versión del instalador, limpieza automática de la versión vieja desde la de la Store. Quien aún la tenga, que la desinstale desde Configuración → Aplicaciones.

Pendiente que no es código:

- [ ] **Vídeo de la ficha** (ChatGPT con ESL) y cambiar en la ficha la URL de privacidad por `https://github.com/roblesgg/cronota/blob/main/PRIVACIDAD.md`.
- [ ] **Portátiles de la empresa**: comprobar con un compañero que se instala bien desde la Store.

Lo aprendido:


- **2.9.2 estable en GitHub** (12-11-2026, decisión de Álvaro): sin beta previa y antes que la 2.9.2 de la Store, para que todos pasen ya a la Store. Quien pulse el botón instala la 2.9.1 de la Store, que no arranca sola con Windows hasta que llegue la 2.9.2 allí. La versión de GitHub lleva también `imputame-setup.exe` e `imputame-portable.exe` (copias) para que la web y los enlaces antiguos sigan descargando; se pueden quitar cuando la web apunte a la Store.
- **2.9.2 retirada a los pocos minutos** (12-11-2026): en el portátil de Álvaro, la app guardaba, se cerraba y no pasaba nada más. El antivirus de la empresa (SentinelOne) no deja correr el PowerShell suelto que desinstalaba la versión vieja, y las dos versiones comparten el bloqueo de instancia única. Se pasó a borrador y se quitó la etiqueta `v2.9.2`; GitHub vuelve a servir la 2.9.0. **2.9.3**: nada en segundo plano. La vieja abre la de la Store y se cierra, sin desinstalarse, y comprueba si está con `reg.exe` en vez de PowerShell. Probada en el portátil de Álvaro por la vía normal: publicada primero solo para «Betatester», se actualizó desde la app, guardó, abrió sola la de la Store y se cerró. **2.9.3 publicada como estable para todos el 12-11-2026 hacia las 16:30.** Una instalación lanzada a mano en silencio y con la app abierta falló (`cronota-setup.exe`, error en `System.dll`); la actualización normal desde la app no.
- **Cambiar solo la ficha** (12-11-2026, envío 2): Información general → «Iniciar actualización» → Descripciones de Store → Español (España). Cada recuadro de imagen admite un solo archivo. El de una captura que ya existe la sustituye; las nuevas van por el «+». Después, «Guardar» y «Enviar para certificación». Mientras se certifica no se puede abrir otro envío. **Tiempos reales**: el envío 3 (paquete 2.9.4.0) estaba publicado en el catálogo el 16-11-2026 a las 09:03 (hora de España), el mismo día que se mandó. Para comprobar qué versión está publicada sin entrar en Partner Center: `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=9NXSJVW6BXQF&market=ES&languages=es-es` (busca `PackageFullName`). A cada equipo le llega después, cuando la Store busca actualizaciones.
- **2.9.5, solo en la Store** (16-11-2026): copia de seguridad completa (tareas, historial y todos los ajustes) y arreglo de las entradas repetidas de inicio con Windows. Sin versión en GitHub. Envío 4 mandado a certificación el 16-11-2026 hacia las 12:30. Partner Center se abre en el Chrome con el perfil donde está la cuenta personal (en Claude in Chrome sale como el segundo navegador conectado).
- **2.11.0, Fases 1 y 2** (18-11-2026): barra entre pantallas, animaciones y sin bienvenida. Envío 5 mandado a certificación el 18-11-2026 por la mañana.
- **2.11.0 publicada** en la Store el 18-11-2026 (el mismo día que se mandó). **2.12.0, Fase 3** (Outlook por ICS y sin avisos en llamadas): envío 6, mandado y publicado el 18-11-2026 (ya en el catálogo de la Store a la media hora más o menos).
- **2.12.1** (18-11-2026): al descartar una sugerencia se va al momento y Ctrl+Z la devuelve en el acto. Envío 7.
- **2.13.0** (18-11-2026): botón «Añadir» discreto en azul de Outlook; en Ajustes, logo de Outlook y «Sacar el vínculo en Outlook»; en cada entrada, «Crear en Outlook» (abre un evento ya relleno en Outlook web con `deeplink/compose`; se guarda allí, sin registrar ninguna app). La 2.12.2 se compiló pero no se subió. Envío 8.
- **2.14.0** (19-11-2026): sincronizar con OneDrive o Google Drive, parar la tarea al apagar o suspender, más temas, Ajustes al momento, iconito de Outlook que abre el día, tutoriales arreglados y limpieza. Envío 9 mandado a certificación el 19-11-2026 hacia las 11:45.
- **2.14.1** (19-11-2026, envío 10 mandado a certificación hacia las 12:20; la 2.14.0 ya estaba publicada a esa hora): sincronizar lleva también los ajustes (menos los de cada pantalla) y las sugerencias de Outlook descartadas, y los que llegan de otro PC se aplican al momento; las copias diarias llevan ajustes; al restaurar una copia no se trae la nube elegida en el otro PC. Probado simulando dos PC.
- **2.14.2** (19-11-2026, envío 11 mandado a certificación hacia las 13:00; la 2.14.1 se publicó en menos de una hora): la versión instalada se ve en Ajustes → General, debajo de «Ayuda y copias».
- **2.14.3** (19-11-2026, envío 12 mandado a certificación por la tarde, cuando la 2.14.2 ya estaba publicada): Cronota avisa cuando la Store tiene una versión nueva y ofrece «Cerrar y actualizar» (aviso, bandeja y Ajustes → General), sin parar la tarea en marcha si vuelves en media hora; lo pidió Ramiro porque la Store da error si actualizas con la app abierta. Y la barra recalcula si acepta clics tras atascarse (el botón de esconder se quedaba sin responder). Probado sin abrir ventanas.
- **2.14.4** (19-11-2026, salió dentro de la 2.14.5): en el calendario, una tarjeta tapada por una sugerencia de Outlook (p. ej. del mismo tamaño) se puede arrastrar: al pinchar en la gota se coge la tarjeta de debajo; los botones de la gota («Añadir», ×, Outlook) siguen siendo suyos.
- **2.14.5** (19-11-2026, envío 13 mandado a certificación con la 2.14.4 dentro): en Ajustes → General → Sincronizar, «Cambiar carpeta…» elige en qué carpeta de OneDrive o Google Drive se guarda (por defecto «Cronota»; tiene que estar dentro del servicio). Se guarda relativa a la raíz (settings.nubeCarpeta), así vale en otro PC aunque su OneDrive esté en otra ruta. Probado simulando OneDrive.
- **2.14.6** (19-11-2026, salió dentro de la 2.14.7): arreglado que una tarea no se pudiera parar. Pausar solo cerraba la última entrada de la tarea; si detrás de la que corría había otra (una reunión de Outlook añadida para más tarde, una pegada o duplicada), la que corría seguía abierta y la rueda ya la daba por parada. Ahora se busca la entrada sin fin (entradaEnCurso), pausar cierra cualquier entrada abierta, y una entrada colgada tiene «Parar» en la rueda del calendario. Probado sin abrir ventanas.
- **2.14.7** (19-11-2026, envío 14 mandado a certificación con la 2.14.6 dentro; el paquete se subió dos veces y hubo que quitar el repetido antes de guardar): en Tareas → Nueva, botón «Crear» para crear la tarea sin ponerla en marcha (el de siempre pasa a llamarse «▶ Crear y empezar»).
- **2.14.8** (20-11-2026, envío 15 mandado a certificación; ojo: arrastrar el .appx con la zona gris a la vista y solo cuando ya esté en Descargas): en el calendario, en «Nueva entrada», «+ Nueva tarea» sale de la lista y pasa a un botón abajo a la izquierda (en la fila de Cancelar y Guardar). Cambia la ventana a crear tarea con lo escrito en el buscador ya puesto como nombre; «← Elegir una tarea» vuelve. Si la búsqueda no encuentra nada, «Crear «…»» o Enter la crean.
- **2.14.9** (20-11-2026, sin enviar): «Cerrar y actualizar» daba error en la Store y había que reintentar: abría la Store y la app se cerraba con calma (unos segundos), así que al darle a «Actualizar» seguía viva. Ahora guarda todo, quita bandeja y ventanas y sale en ~0,4 s. Probado sin abrir ventanas.
- **2.15.0** (20-11-2026, no se envía: decidido con Álvaro esperar y que salga dentro de la 2.16 con las Notas, cuando las haya probado): paletas personalizadas para cada cliente (Tareas → colores de la sección → «+ Paleta personalizada»: nombre y hasta 12 colores; se editan con el lápiz y se borran; viajan con la sincronización en settings.paletasPropias). 11 paletas de serie nuevas (Océano, Bosque, Atardecer, Tierra, Vino, Pastel, Vivos, Noche, Arcoíris, Sobrios…) y 48 colores de tarea (antes 24), con 16 en la rueda automática. Novedades de la 2.15 en el recorrido. Probado sin abrir ventanas y con capturas.
- **Desinstalar la versión vieja** (17-11-2026): la de la Store no puede borrar nada fuera de su paquete (Windows le da su propia copia del registro y de AppData). Abriendo el desinstalador viejo con el Explorador se ejecuta de verdad, pero sin `/currentuser` deja los accesos directos y la entrada de «Aplicaciones instaladas». Además cierra también la de la Store, que se llama igual (`imputa.me.exe`).

### Fase 1 · La píldora entre pantallas (2.10)

**Estado (17-11-2026):** hecha y probada por Álvaro en modo pruebas con 3 pantallas (`dock-bar-cruza` en `main.js`, `quizaCambiaDePantalla` en `src/dock.html`). Sale en la próxima versión de la Store.

Hoy la píldora de la barra lateral solo se arrastra dentro de la pantalla en la que está, porque su ventana ocupa exactamente esa pantalla. Para llevarla a otra hay que ir a Ajustes → Barra → Pantalla.

- Arrastrarla también **de una pantalla a otra**: mientras se arrastra, el proceso principal sigue el cursor (`screen.getCursorScreenPoint`) y, al cruzar a otra pantalla, mueve la ventana de la barra a esa pantalla y la píldora sigue bajo el dedo sin saltos.
- Al soltar se guarda la pantalla elegida (`dockDisplayId` y su huella), el borde y la posición, igual que hoy desde Ajustes.
- Casos que probar: pantallas con distinta escala (100 % y 150 %), una pantalla encima de otra, desconectar la pantalla elegida y volver a conectarla.

### Fase 2 · Animar toda la app de punta a punta (2.11)

**Estado (18-11-2026): hecha, vista por Álvaro en modo pruebas.** `src/movimiento.js` (común, con «reducir movimiento» y nada infinito). Panel: las recientes se deslizan a su sitio al reordenarse y la tarjeta de la tarea en marcha da un toque de muelle al cambiar. Tareas: las secciones se abren y pliegan animando el alto, y al mover una tarea de sección, crearla o borrarla las demás se deslizan a su sitio. Calendario: la semana entra deslizándose. Ajustes: la categoría entra desde el lado de su pestaña. Ventanas: ya tenían su entrada (recordatorio, novedades, ojos); no se tocan. CPU: no se añade nada que corra solo (ni bucles ni animaciones infinitas), todo arranca con una acción y dura menos de 0,4 s; sin medición en vivo.

Objetivo: que cada acción tenga una respuesta visual clara y agradable, sin hacer la app más lenta.

- **Sistema de movimiento común**: duraciones, curvas y rebotes compartidos en `mac.css` (ya hay `--spring` y `--ease`), para que todo se mueva igual.
- **Panel**: entrada de la tarjeta de la tarea en marcha, el contador al empezar y pausar, las tareas al reordenarse y al aparecer o desaparecer de «Recientes».
- **Tareas**: abrir y cerrar secciones, arrastrar tareas entre secciones, crear y borrar.
- **Calendario**: cambio de semana deslizando, los bloques al crearse, moverse y pegarse.
- **Ajustes**: cambio de categoría deslizando entre pestañas.
- **Ventanas**: recordatorio, novedades y actualización con una entrada y salida coherentes.
- Respetar «reducir movimiento» de Windows y no tener animaciones infinitas (ya se quitaron por consumo de CPU).
- Medir antes y después: que no suba el uso de CPU con el panel abierto ni plegado.

### Fase 3 · Outlook y llamadas, sin registrar ninguna app (2.12)

Decidido el 18-11-2026: nada de Microsoft Graph ni apps registradas en Azure (habría que pedir permiso a sistemas). Se hace con lo estándar:

- **Reuniones de Outlook por enlace ICS** (`outlook-ics.js`): en Outlook, Configuración → Calendario → Calendarios compartidos → **Publicar un calendario** (permiso «Puede ver títulos y ubicaciones») y se pega el vínculo ICS en Ajustes → Calendario. Cronota lo descarga cada 15 min; las reuniones salen en el calendario a rayas y un clic abre «Nueva entrada» con sus horas y su título como nota. Entiende reuniones periódicas, excepciones y movidas. Solo lectura.
- **Sin avisos en llamadas** (`en-llamada.js`): si alguna app tiene el micrófono abierto (Teams, Meet, Zoom...), Windows lo apunta en el registro; Cronota lo lee con `reg.exe` cada 20 s y no saca avisos (como No molestar). Ajustes → Avisos dice qué app está en llamada.
- **Sugerencias y al añadir una reunión** (decidido con Álvaro el 18-11-2026, `anadirReunion` y `vigilarReunionesPlaneadas` en `main.js`, `recortar-solapes.js`): las reuniones salen a rayas POR ENCIMA de las entradas; clic = «Añadir desde Outlook», la × = descartar (va en el estado: Ctrl+Z la recupera; Ajustes → Calendario → «Volver a ver las descartadas»). Al añadir, la reunión manda: se recorta lo que se solape (si una entrada la cubre entera, se parte en dos). Si está pasando ahora, la tarea en marcha se corta al empezar la reunión y la de la reunión queda en marcha. Las futuras se pueden añadir: cuando llegan, la tarea en marcha se corta al empezar la reunión y vuelve a ponerse en marcha sola al acabar. Las añadidas ya no salen como sugerencia. La que cruza la medianoche se corta a las 23:59.
- Política de privacidad actualizada.
- **Estado (18-11-2026):** las reuniones ya salen en modo pruebas con el vínculo de Álvaro; los casos al añadirlas, probados sin ventanas con datos inventados. Falta probar «Sin avisos en llamadas» en una llamada de Teams.

### Fase 4 · Descartada por ahora

Cambiar el estado de Teams o crear eventos en Outlook desde Cronota necesita una app registrada en Azure (Microsoft Graph). Solo si algún día sistemas lo aprueba.

### Fase 5 · Notas y caja fuerte (idea de Álvaro, 20-11-2026) — HECHA en la 2.16.0, probada por Álvaro y enviada a la Store (envío 15, 20-11-2026)

Un sitio para apuntar cosas y ver de un vistazo qué tienes pendiente y qué es lo siguiente. Muy sencillo, nada de gestor de proyectos: un planner de notas con la estética de la app (cristal líquido, animaciones, letras de siempre).

**Pantalla «Notas»** (una pestaña más en la píldora, junto a Panel, Calendario, Tareas y Ajustes):
- Tablero de tarjetas de cristal, todas a la vista. Se escribe directamente arriba («Apunta algo…» + Enter) y la tarjeta cae al tablero con animación.
- Tres carriles fijos que hacen de planner: **Ahora**, **Siguiente** y **Más tarde**. Se arrastran tarjetas entre ellos. Así siempre se ve qué toca.
- **Secciones** propias (por cliente o tema, con su color, como las paletas): un filtro arriba, sin esconder lo demás.
- Cada nota: texto (con lista de casillas opcional), color, sección y **recordatorio con fecha y hora** → aviso de Windows (el mismo de la app; respeta «No molestar» y las llamadas). Las de hoy y las vencidas salen marcadas.
- Hecho = se tacha y se va a «Hechas» (plegado). Borrar con Ctrl+Z, como en el calendario.
- Buscador y atajo global para apuntar rápido sin abrir nada (p. ej. desde la barra flotante).
- Se guardan en el fichero de datos y viajan con la sincronización de OneDrive / Google Drive y con las copias.

**Caja fuerte** (un apartado aparte dentro de Notas):
- No se ve nada de lo que hay dentro (ni títulos ni cuántas) hasta desbloquearla con **PIN o contraseña**, a elegir la primera vez.
- Cifrado de verdad en el disco: AES-256-GCM con una clave sacada del PIN con scrypt (módulo `crypto` de Node, sin dependencias). Sin el PIN no se puede leer, ni siquiera abriendo el fichero.
- Se vuelve a cerrar sola a los pocos minutos sin usarla, al bloquear Windows y al cerrar la app.
- A la sincronización y a las copias solo va cifrada.
- Aviso claro: si se olvida el PIN no hay forma de recuperar esas notas (no hay cuenta ni servidor). Opción de exportarlas cifradas.
- Opcional más adelante: desbloquear con Windows Hello.

**Por fases**: 1) tablero con carriles, secciones y borrar/deshacer; 2) recordatorios; 3) caja fuerte; 4) apuntar rápido desde la barra y pulido de animaciones.

**Hecho (2.16.0, 20-11-2026)**: pestaña Notas en la píldora (y ventana suelta y en la bandeja; `src/notas.html`). Primero se hizo con carriles Ahora/Siguiente/Más tarde y Álvaro pidió otra cosa: **notas sueltas en un mapa flotante** (cada una con su x, y; se arrastran, el fondo se mueve arrastrando o con la rueda, Ctrl+rueda acerca/aleja, doble clic en el fondo = nota ahí, botón de ver todas) con **propiedades** en una ventanita: urgencia (baja/media/alta, la alta con halo), recordatorio, sección y color. Casillas propias (círculo de cristal con check que se dibuja; nada de las del sistema). **Secciones = las de Tareas** (color de su paleta; «+ Sección» crea una en Tareas; los filtros apagan, no esconden). **Siete maneras de verlas**, con transición animada y recordada en cada equipo: sueltas, cuadrícula, mosaico, filas, por sección, por urgencia y por fecha. **Menú redondo** con clic derecho: en el mapa (nota, lista, urgente aquí, pegar, ordenar, ver todas) y en cada nota (propiedades, hecha, urgencia, recordar, vence, sección, color, más: fijar, duplicar, copiar, casilla; borrar). **Vencimiento** (fecha límite, aparte del recordatorio) y **fijar encima**. **Recordar** rápido: 1 h, 2 h, 1 día, 2 días, 1 semana y «Otro…» con selector propio de minutos, horas, días, semanas o meses. **Markdown** en las notas (títulos, negrita, cursiva, tachado, resaltado, listas, casillas, citas, código, enlaces, separador) con barra de botones y modo lápiz / ojo. **Cristal líquido con deformación** en notas y botones: filtro SVG (feDisplacementMap) como backdrop-filter, sin WebGL (con WebGL serían demasiados contextos). Después, pedido por Álvaro: **editor en vivo como Obsidian** (cada línea formateada; la que editas enseña sus marcas; las listas siguen con Enter y los números cuentan; Enter en un punto vacío acaba la lista), **todo recogido**: propiedades en píldoras (Urgencia · Recordar · Vence · Sección · Color) con selectores propios de cristal (nada de los del sistema: calendario, hora con − / +, listas), **rueda de color propia** y **colores recientes** con su ×, **animación de «hecha»** (check que se dibuja, destello, chispas y sale flotando), **rendimiento**: la deformación solo en la nota bajo el ratón y nada de cristal mientras el mapa se mueve; las listas se pueden arrastrar (solo el circulito marca); un solo botón «Cerrar caja» que la cierra y vuelve al mapa. Lo básico de una pizarra: seleccionar (clic, Ctrl/Mayús, recuadro arrastrando en un hueco), Ctrl+C/X/V/D/A, Supr, Enter, Esc, flechas (Mayús = más), mover varias a la vez, y **botón derecho arrastrando = mover la pizarra** aunque sea encima de una nota (si no se arrastra, sale el menú). La deformación del cristal va solo en las notas y siempre (también al moverlas), más fuerte; los botones, solo desenfoque. El menú circular, con más refracción (glass.js admite refThickness/refDistance/refFactor por uso). En las vistas ordenadas también se mueven: las demás se apartan con animación para hacer hueco y al soltar se guarda el orden (nota.orden, acción notas-editar); en las de columnas, soltar en otra cambia su sección, urgencia o fecha límite (en «Vencidas» no). **Cuadrícula libre**: cada nota en la celda donde la sueltes (huecos incluidos; si está ocupada se cambian el sitio; nota.celda). **Archivos**: arrastrar archivos de fuera al mapa crea notas-archivo; se copian a «notas-archivos» en la carpeta de datos (hasta 300 MB, 20 a la vez; las carpetas no), con la miniatura de Windows (fotos, PDF, Office…) o su icono, guardada en la nota (viaja por la nube; el archivo no). Doble clic = visor dentro (imágenes, PDF con el visor de Chromium, texto) o abrir con su programa; también «En la carpeta» y «Guardar copia». Al arrancar se borran los que ya no están en ninguna nota. Deformación del cristal solo en los bordes, más fuerte. **Rendimiento (medido con 30 notas, ventana fuera de pantalla)**: con la deformación en todas y el halo animado de las urgentes iba a 18 fps quieto y 29 moviendo el mapa (la app entera lenta); ahora la deformación solo en la nota bajo el ratón o la que se arrastra, las demás con desenfoque y brillos de canto, y el halo fijo: 61 y 61 fps. **Vistas ordenadas, probado a fondo** (72 arrastres al azar en las 6 vistas con las notas de ejemplo y 10 cambios de vista seguidos, comprobando solapes, huecos, que la nota acabe donde se suelta, que las demás no cambien y que nada salte): se arreglaron el orden repetido (al soltar se renumeran todas, también las ocultas), las fijadas que se ponían siempre primero, la altura medida a mitad de animación (solapes y huecos), las celdas de la cuadrícula guardadas para todas (salían en una o dos columnas; ahora solo la que mueves y la que se intercambia, y las viejas se limpian una vez) y las columnas que se movían al empezar a arrastrar. Editor: la línea que editas se ve formateada con las marcas tenues; B/I/S/resaltado como en Word (sin seleccionar empiezas a escribir con ese estilo; otra vez, sales). **Copias**: los archivos de las notas van en exportar (carpeta «… (archivos de notas)» al lado del .json) e importar, en las copias diarias («archivos de notas») y en la sincronización (carpeta «archivos» junto a cronota-sync.json; se suben y se bajan los que falten). Notas, caja fuerte (cifrada), paletas y preferencias de pantalla ya iban. buscador, Hechas aparte, Ctrl+Z, recordatorios cada 20 s con aviso que respeta No molestar y llamadas, caja fuerte AES-256-GCM + scrypt (PIN de 4–8 cifras o contraseña de 6+, se cierra a los 5 min, al bloquear Windows y al suspender; 5 fallos = 30 s de espera; «¿Lo has olvidado?» la borra). Notas, secciones y caja (cifrada) viajan con la sincronización, las copias y exportar. Decidido por Claude mientras Álvaro no diga otra cosa: carriles + secciones, recordatorios no salen en el calendario, PIN o contraseña a elegir, 5 minutos. Probado sin abrir ventanas y con capturas.

**Últimos cambios antes de enviar (20-11-2026, pedidos por Álvaro probándola)**: la **caja fuerte es otra pizarra igual** (abierta, sus notas viven descifradas solo en memoria; cada cambio se vuelve a cifrar; Ctrl+Z propio; el formato viejo título + texto se convierte solo) y en el menú redondo de cada nota **«A la caja fuerte»** (si está cerrada pide el PIN y la caja sigue cerrada; las notas con archivos no entran) y, dentro, **«Sacar de la caja»**. **Crear una nota abre su ventana completa** (editor y propiedades; Ctrl+Enter o «Crear»); fuera la barra «Apunta algo»; botón **«+ Nota»** y tecla N. Zoom nítido (will-change solo mientras se mueve). La línea que escribes, sin recuadro ni fondo. **Varios archivos por nota**: se sueltan en la ventana de la nota (sale «Suelta para adjuntar») y se listan abajo en «Adjuntos» (nota.archivo el grande + nota.adjuntos), o se sueltan encima de la tarjeta y se suman; en la tarjeta los demás salen como chips. **Ratoncito** arriba a la derecha de la pizarra (clic derecho arrastrando = moverse). **«Ordenar»** del menú del mapa ordena dentro del modo actual (libre: en columnas sin montarse; ordenadas: sin huecos ni orden manual). **Animaciones sobrias** (las de agua y globo no le gustaron, «muy baratero»): crear = enfoca desde un desenfoque con un brillo de acento que se apaga; completar = sello verde con el check que se dibuja y la nota sube y se desvanece; borrar = se desenfoca y se aleja. 4 capturas nuevas para la Store (notas, archivos, ordenar, caja fuerte; `tools/capturas-store.js`).

**Envío (20-11-2026)**: se canceló la certificación del envío 15 (la 2.14.8) y en el mismo envío va la **2.16.0** (que la incluye, igual que la 2.15), con las novedades nuevas, 9 capturas y la característica «Notas en un mapa…». El paquete se soltó dos veces: hubo que cancelar la subida repetida y recargar la página para que «Save» respondiera. **Git**: `git push` a github.com falla en este portátil (el certificado de GitHub lo firma una raíz de Sectigo que Windows aún no reconoce; no se desactiva la verificación); `main` se subió con la API de GitHub (`gh api`, un solo commit con el árbol idéntico al local). Cuando git vuelva a conectar, la rama local tendrá los commits sueltos y GitHub ese commit juntado: unir con un merge.

### 2.17 · Avisos nuevos y notas más cómodas (20 – 23-11-2026)

**Envío 17 (24-11-2026)**: mandado a certificación como **2.17.1** (mismo contenido que la 2.17): Partner Center ya tenía un paquete 2.17.0.0 con otro contenido (una compilación anterior subida antes) y no deja repetir versión, así que se subió el número. Al arrastrar el .appx, si se hace doble clic se abren decenas de ventanas del instalador de Windows (no instalan nada: el paquete no va firmado; se cierran con Stop-Process AppInstaller). La sesión de Partner Center está en el Chrome personal, cuenta personal.

**Avisos** (`src/aviso.html`, `avisar()` en main.js): una sola ventana para todos los avisos, en cola de uno en uno. **Isla de cristal** pegada al borde de arriba en el centro: paredes rectas, esquinas de abajo de cuarto de círculo (20 px; el cristal sigue por encima con `extiende` y `roundness: 2`), muy translúcida (tinte 2 %, desenfoque 5 px), refracción en el canto y ondas suaves y quietas por dentro (opción `ondas` / `ondasQuietas` de glass.js). Entra como una franja ancha, negra y borrosa que se estrecha y baja; sale al revés. Canto del cristal suavizado en un píxel (antes salían dientes de sierra en todas las curvas). Texto con la letra ancha; la nota entera en una línea que corre con la rueda. **Dos tipos**: programados (recordatorios de notas, citas del calendario, hora de salida si sigues): se quedan hasta Hecha / posponer / ×, con silueta y puntito naranja; informativos (tarea en marcha, tarea parada, actualización, nube): se van solos (15–20 s) con su barrita, salvo con el ratón encima. Posponer con la rueda del ratón (3–10 min, de 5 en 5 hasta 1 h, horas hasta 5 y luego días). Clic en el aviso = abrir. **Tarea en marcha**: punto de su color, tiempo corriendo segundo a segundo, puntual/recurrente, total de hoy y su nota (Pausar / Cambiar). **Ajustes → Avisos**: pantalla de los avisos (barra, ratón, principal o una concreta; vale para todos, también el descanso visual y la tarjeta de tareas), estilo (arriba en isla, por defecto; o abajo en tarjeta: la tarea vuelve a la tarjeta de siempre y el resto, tarjeta abajo a la derecha), tamaño (escala la isla en vivo) y «Ver cómo queda». Ya no queda ninguna notificación de Windows.

**Avisarme en el calendario**: clic derecho en una entrada que aún no ha empezado o en una reunión de Outlook (ahora con menú redondo propio: añadir, avisarme, descartar) → a la hora, 5/10/15/30 min, 1 h o 1 día antes. `state.avisosCalendario` ({ clave e:tarea:inicio u o:reunión, titulo, inicio, antes, cuando, avisada }), vigilado cada 20 s con los de las notas; campanita en las citas con aviso. Si se mueve una entrada, su aviso se pierde (la clave lleva la hora).

**Notas**: crear abre la ventana completa (editor grande, propiedades pequeñas; fuera la barra «Apunta algo»; botón «+ Nota» y tecla N); varios archivos por nota (apartado «Adjuntos»); las largas se pliegan con «Ver más»; en la vista libre las hechas van aparte, a la derecha; «Ordenar» ordena dentro del modo actual; Notas con su propio ancho en la barra; ratoncito de «clic derecho arrastrando»; animaciones sobrias al crear, completar y borrar; selector «Dentro de…» que ya no se sale.

### Fase 6 · Cronota para Claude (MCP) (idea de Álvaro, 20-11-2026) — por planificar

En Ajustes, activar un **servidor MCP** para que Claude (u otro asistente) pueda trabajar con Cronota: agendarte cosas, apuntar notas, administrar tareas, consultar horas… Por planificar con Álvaro antes de programar: qué puede hacer (solo leer o también cambiar), cómo se conecta (local, sin cuentas), qué se pide confirmar y qué no sale nunca (la caja fuerte).

### Revisión completa de la app (18-11-2026)

Hecha con tres revisiones a la vez: proceso principal, pantallas y repositorio.

**Arreglado ya (sale en la próxima versión):**
- Al apagar el PC o cerrar sesión con una tarea en marcha, se para en ese momento ('session-end'). Si la app se cierra de golpe, al volver a abrirla se para en el último minuto en que estaba viva y avisa (`ultimoLatido`, `repararCierreDeGolpe`). Antes contaba toda la noche.
- Ajustes guardados de forma segura, como las tareas (antes, un corte de luz a mitad los perdía en silencio, con el vínculo de Outlook y el tutorial visto). Si están rotos, se apartan como copia.
- Un archivo de tareas que se lee pero viene vacío ya no impide arrancar.
- Si la barra se cae, se vuelve a crear; antes se pasaba a modo ventanas para siempre.
- El calendario de la barra no se puede estrechar por debajo de 760 px (antes la semana quedaba ilegible).
- «Pararla automáticamente a esa hora» en Ajustes → Avisos.
- 12 temas nuevos (6 con brillo, 6 clásicos) y 9 colores de acento más, entre ellos «Outlook».

**Quitado el 18-11-2026 (sale en la próxima versión):** actualizador y canal beta, paso del instalador a la Store, arranque del instalador, compilación del instalador, cuenta y sincronización con Supabase, app del móvil (`movil/`), `desenfoque-windows.js` y código suelto, pasos del tutorial viejos; web, README, privacidad y notas técnicas al día. «Ver las N» en el Panel cuando hay tareas fuera de Recientes. Detalle de lo que se quitó:
- Actualizador de GitHub y canal beta: `setupAutoUpdate`, `checkForUpdatesIfStale`, `installUpdateNow`, la ventana `src/update.html`, la barra roja de «Actualizar» del Panel, el interruptor «Betatester» y «Volver a la estable», y `electron-updater`.
- Paso del instalador a la Store: `src/migrar.html`, casi todo `migracion-store.js` (quedan `copiaDelDia`, `ajustesTraspasables` y `arranqueDeSesion`, mejor en un `copias.js`), `SIMULACRO_STORE`, «Pasar a la Microsoft Store…» de la bandeja, `tools/simular-paso-store.vbs`.
- Arranque con Windows del instalador (`applyLoginItem`, `quitarArranquesDelInstalador`).
- Compilación del instalador: `nsis`/`portable`/`publish` en `package.json`, `build/installer.nsh` y sus imágenes, `build-hooks/make-installer-images.js`, el script `dist`.
- Código que nadie usa: `desenfoque-windows.js`, menús `week-days-menu` y `calendar-context-menu`, acciones `start-task`, `show-dock-bar`, `dock-focus`, `desenfoque-sistema`; `#navButtons` del Panel, `startRename`, `escapeHtml`, `seguidorDeForma`, clases CSS sueltas y las letras Montserrat de `shared.css`.
- Pasos del tutorial que apuntan a cosas que ya no existen (`main-update`, `set-beta`).
- Ajustes → General: la tarjeta «Inicio y versiones» sale vacía en la Store, y «Actualizaciones» debería llamarse «Ver en Microsoft Store».
- Web y documentación: `web/index.html` descarga el instalador y el APK y no enlaza a la Store; `web/vercel.json` y `web/version.json`; README, notas técnicas, ficha de la Store y política de privacidad hablan del instalador, las betas y el móvil.

**Mejorar:**
- Rendimiento: cada segundo, con una tarea en marcha, se manda todo el historial de todas las tareas a las pantallas. Bastaría mandar los tiempos. Las 4 vistas de la barra lo reciben aunque no se vean, y el calendario rehace su minicalendario cada segundo. La barra comprueba el ratón cada 60 ms aunque esté escondida, y deshacer guarda hasta 60 copias completas.
- Ajustes guarda de dos maneras (unos al momento, otros con «Aplicar») y «Cancelar» no deshace lo ya aplicado. Pasar todo a «al momento» y quitar Aplicar/Cancelar.
- Palabras: el Panel habla de «grupo» y Tareas de «sección». El «Añadir tarea» del Panel solo abre Tareas, y la fila «Al iniciar, llevo…» no se entiende.
- Accesibilidad: el punto de color no se puede usar con teclado y es de 11 px; varios campos no enseñan el foco; hay 18 `alert`/`confirm` del sistema mezclados con las ventanitas propias.
- Las ventanas de los ojos y de arranque usan Montserrat en vez de las Zalando de la app.
- Decidir: si el portátil se suspende con una tarea en marcha, ¿se para al suspender? Hoy sigue contando.

### 2.14 · Todo lo de la revisión, hecho (19-11-2026)

- [x] **Tutoriales y novedades**: las novedades son las de la última versión que las tenga (antes solo la exacta), hay pasos del recorrido para lo nuevo (Outlook, llamadas, temas, «ver las N») y el botón «Enséñame dónde está» solo sale si queda algo que enseñar.
- [x] **Sincronizar con OneDrive o Google Drive** (`nube.js`): por la carpeta que ya sincroniza ese programa, sin cuentas. Archivo `Cronota\cronota-sync.json`; si los dos PC cambian a la vez manda el último y lo del otro se aparta como `cronota-sync-conflicto-…json`, con aviso. Probado simulando dos PC.
- [x] **Consumo**: el tic de cada segundo solo rehace la tarea en marcha; la barra no mira el ratón escondida ni quieta; el minicalendario solo cambia de un día para otro.
- [x] **Ajustes al momento**: sin «Aplicar» ni «Cancelar»; el vínculo de Outlook con «Conectar» o Enter.
- [x] **Detalles**: «sección» en vez de «grupo», «Empezaste hace … min o a las …», foco visible con teclado, punto de color con teclado. **Suspender**: si el portátil duerme más de media hora con una tarea en marcha, se para a la hora en que se durmió y avisa (Ctrl+Z lo deshace).
- [x] El iconito de Outlook (sugerencias y tarjetas añadidas) abre ese día en Outlook web. El evento exacto no se puede sin una app registrada en Azure.
- [ ] **Pendiente que no es código**: vídeo de la ficha (ChatGPT) y probar la instalación desde la Store en un portátil de un compañero.

### Pendientes sueltos

- **Próxima versión · notas** (pedido por Álvaro el 24-11-2026):
  - Al elegir fecha y hora del recordatorio de una nota (selector propio), que se puedan cambiar con la **rueda del ratón** (día, hora y minutos), como el botón de posponer de los avisos.
  - **Secciones de notas propias**, independientes de las secciones de Tareas, que se crean desde Notas (en la 2.16 se pasaron a las de Tareas; ahora vuelven a ser propias; la lista state.seccionesNotas ya existe). Pensar qué pasa con las notas que ya tienen una sección de Tareas (pasarlas a una sección de notas con el mismo nombre y color).
  - **Pegar imágenes** en las notas (Ctrl+V con una imagen en el portapapeles, en la ventana de la nota o en el mapa) para que se adjunten como archivo, igual que al soltarlas.
- ~~Próxima versión · fuera la cuenta y el móvil; sincronizar con OneDrive o Google Drive~~ (hecho en la 2.14) (pedido por Álvaro el 18-11-2026):
  - **Quitar** todo lo que sobra: «Sincronizar (móvil)…» de la bandeja, la cuenta y la sincronización con Supabase (`sync.js`, `src/sync.html`, sección Cuenta de Ajustes, `imputa-sync.json`), la app del móvil y sus referencias (README, web, política de privacidad). Los dominios `imputame*.dripdev.dev` y el APK dejan de hacer falta.
  - **Añadir** en Ajustes una sección «Sincronizar» con los iconos de **OneDrive** y **Google Drive**: eliges uno con un clic y ya está, sin cuentas ni contraseñas en Cronota. Cronota busca sola la carpeta de ese servicio en el PC (OneDrive: variables `OneDrive` / `OneDriveCommercial`; Google Drive para escritorio: su unidad, p. ej. «Mi unidad»), crea dentro `Cronota` y guarda ahí una copia de tus datos al momento; el programa de OneDrive o Google Drive la sube a tu nube. En otro PC con el mismo servicio, Cronota la encuentra y ofrece traerla.
  - Si el servicio no está instalado, el botón lo dice y lleva a su descarga. Pensar qué pasa si se usa en dos PC a la vez (el último cambio manda, avisando) y no meter nunca en la nube el vínculo ICS de Outlook sin decirlo.
  - Actualizar la política de privacidad.

- ~~Próxima versión · tutoriales y novedades bien hechos~~ (hecho en la 2.14) (pedido por Álvaro el 18-11-2026): ahora van raros, como si solo salieran una vez. Lo que tiene que pasar: al entrar después de una actualización salen las novedades de esa versión (y el recorrido de lo nuevo, si lo hay), una sola vez por versión; el botón de cada paso te lleva de verdad a la pantalla y al sitio que explica; y desde Ajustes («Ver tutorial», «Ver novedades») se pueden volver a ver siempre. Revisar `lastSeenVersion`, `lastSeenWhatsNew`, `tutorialSeenSteps`, `TUTORIAL_STEPS` (shared.js) y el recorrido entre vistas (`tourActive`, `tutorial-next`). Probar con versiones seguidas (2.12 → 2.13) y con una instalación nueva.

- **«imputame» por dentro**: la app del móvil (paquete Android `me.imputa.app` y sus textos) y los dominios `imputame.dripdev.dev` e `imputame-app.dripdev.dev`, que piden cambios en Vercel, en el DNS y un APK nuevo. El ejecutable y las carpetas del instalador no hace falta cambiarlos si todos pasan a la Store.
