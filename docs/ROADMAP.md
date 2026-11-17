# Roadmap de Cronota

Última revisión: 17 de noviembre de 2026 · Publicada: 2.9.5 (Microsoft Store). Solo se publica en la Store.

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
- **Desinstalar la versión vieja** (17-11-2026): la de la Store no puede borrar nada fuera de su paquete (Windows le da su propia copia del registro y de AppData). Abriendo el desinstalador viejo con el Explorador se ejecuta de verdad, pero sin `/currentuser` deja los accesos directos y la entrada de «Aplicaciones instaladas». Además cierra también la de la Store, que se llama igual (`imputa.me.exe`).

### Fase 1 · La píldora entre pantallas (2.10)

**Estado (17-11-2026):** programada (`dock-bar-cruza` en `main.js`, `quizaCambiaDePantalla` en `src/dock.html`), falta probarla con el ratón en modo pruebas.

Hoy la píldora de la barra lateral solo se arrastra dentro de la pantalla en la que está, porque su ventana ocupa exactamente esa pantalla. Para llevarla a otra hay que ir a Ajustes → Barra → Pantalla.

- Arrastrarla también **de una pantalla a otra**: mientras se arrastra, el proceso principal sigue el cursor (`screen.getCursorScreenPoint`) y, al cruzar a otra pantalla, mueve la ventana de la barra a esa pantalla y la píldora sigue bajo el dedo sin saltos.
- Al soltar se guarda la pantalla elegida (`dockDisplayId` y su huella), el borde y la posición, igual que hoy desde Ajustes.
- Casos que probar: pantallas con distinta escala (100 % y 150 %), una pantalla encima de otra, desconectar la pantalla elegida y volver a conectarla.

### Fase 2 · Animar toda la app de punta a punta (2.11)

Objetivo: que cada acción tenga una respuesta visual clara y agradable, sin hacer la app más lenta.

- **Sistema de movimiento común**: duraciones, curvas y rebotes compartidos en `mac.css` (ya hay `--spring` y `--ease`), para que todo se mueva igual.
- **Panel**: entrada de la tarjeta de la tarea en marcha, el contador al empezar y pausar, las tareas al reordenarse y al aparecer o desaparecer de «Recientes».
- **Tareas**: abrir y cerrar secciones, arrastrar tareas entre secciones, crear y borrar.
- **Calendario**: cambio de semana deslizando, los bloques al crearse, moverse y pegarse.
- **Ajustes**: cambio de categoría deslizando entre pestañas.
- **Ventanas**: recordatorio, novedades y actualización con una entrada y salida coherentes.
- Respetar «reducir movimiento» de Windows y no tener animaciones infinitas (ya se quitaron por consumo de CPU).
- Medir antes y después: que no suba el uso de CPU con el panel abierto ni plegado.

### Fase 3 · Outlook y Teams, solo lectura (2.12)

Requisito previo: **preguntar a sistemas de Bitec** si permiten una app que lea el calendario y el estado de Teams (suele hacer falta el consentimiento del administrador).

- Iniciar sesión con la cuenta de Microsoft (MSAL, flujo con PKCE y el navegador del sistema; tokens cifrados con `safeStorage`).
- **Calendario de Outlook** en el calendario de Cronota: las reuniones como bloques aparte, con un clic para imputarlas.
- **Estado de Teams**: si estás en «No molestar» o en una llamada, Cronota silencia sus avisos.
- Actualizar la política de privacidad (`PRIVACIDAD.md` y `web/privacidad.html`) antes de publicar.

### Fase 4 · Outlook y Teams, más allá (2.13)

- Cambiar el estado de Teams desde Cronota (por ejemplo, «Ocupado» al empezar una tarea de concentración).
- Al empezar una reunión del calendario, proponer cambiar a su tarea.
- Opcional: llevar los ratos de Cronota a Outlook como eventos.

### Pendientes sueltos

- **«imputame» por dentro**: la app del móvil (paquete Android `me.imputa.app` y sus textos) y los dominios `imputame.dripdev.dev` e `imputame-app.dripdev.dev`, que piden cambios en Vercel, en el DNS y un APK nuevo. El ejecutable y las carpetas del instalador no hace falta cambiarlos si todos pasan a la Store.
