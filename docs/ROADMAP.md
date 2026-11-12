# Roadmap de Cronota

Última revisión: 12 de noviembre de 2026 · Versiones publicadas: 2.9.2 (instalador, GitHub, 12-11-2026, con el aviso para pasarse a la Store) y 2.9.1 (Microsoft Store; la ficha nueva, en certificación)

Las peticiones nuevas que vayan saliendo se apuntan en la fase que toque (las pequeñas, en la siguiente actualización pendiente) para no publicar cambios sueltos.

## Cómo se trabaja cada cambio

Todo cambio sigue siempre estos cuatro pasos, sin saltarse ninguno:

1. **Planificar**: antes de tocar código se escribe qué se va a hacer, cómo se va a probar y qué puede romperse. Álvaro lo revisa y da el visto bueno.
2. **Implementar y comprobar**: `npm run check` en verde, capturas en segundo plano (`tools/snap.js`) y, cuando haga falta usar la app de verdad, prueba acordada con Álvaro (nunca moviéndole el ratón sin avisar).
3. **Beta**: se publica como versión de prueba `X.Y.Z-beta.N` (prerelease en GitHub). Solo la reciben quienes tienen «Betatester» encendido. Se deja rodar y se corrigen los fallos que salgan.
4. **Publicar**: cuando la beta va bien, versión estable `X.Y.Z` para todos (GitHub, «Latest») **y** envío del mismo código a la Microsoft Store (`npm run store` → subir `cronota-store.appx` en Partner Center).

## Fases

### Fase 0 · Primera actualización en la Microsoft Store (2.9.2) — EN CURSO

**Cuándo:** Microsoft ya publicó la 2.9.1 (12-11-2026), así que el ciclo se puede hacer en cuanto se cierre la lista de abajo. Mientras tanto no se publica nada: los cambios se van guardando en la rama `2.9.2-primera-actualizacion` y se apuntan aquí.

**Para qué:** aprender el ciclo completo con algo pequeño y de poco riesgo (cambio → beta → estable + Store) antes de las fases grandes. Cuando esta actualización llegue bien a la Store, Álvaro empieza a **promocionar la app**.

Cambios que lleva (se van añadiendo según salen):

- [x] **Calendario · sugerencia de pegar**: «Ctrl+V pegar aquí» sale una sola vez por cada cosa copiada; se va al pegar, con una x o a los 10 s sin pegar. Ctrl+V sigue pegando donde hiciste clic. *(hecho, pendiente de probar en la beta)*
- [x] **Repositorio y carpeta con el nombre Cronota** (12-11-2026): el repositorio pasa a llamarse `roblesgg/cronota` y el proyecto a `Documents\Mios\Cronota`. Las apps ya instaladas siguen actualizándose por la redirección de GitHub, comprobada con los dos nombres antiguos; las compilaciones nuevas apuntan ya a `cronota`. *En el paso 5, cambiar en la ficha la URL de privacidad por `https://github.com/roblesgg/cronota/blob/main/PRIVACIDAD.md`.*
- [x] **Fuera «imputame» de todo lo que se ve** (12-11-2026):
  - archivos que exporta la app (`cronota-horas-….csv`, `cronota-backup-FECHA.json`; las copias antiguas se siguen restaurando);
  - archivos que se publican (`cronota-setup.exe`, `cronota-portable.exe`, `cronota-store.appx`);
  - nombre en el Administrador de tareas y en las propiedades del `.exe`, y editor «DripDev» en «Aplicaciones instaladas»;
  - web, README y política de privacidad.

  Lo que queda por dentro, y por qué, está en `docs/notas-tecnicas.md`. *En la beta: comprobar el nombre en el Administrador de tareas y que una copia antigua se restaura bien.*
- [x] **Logo nuevo** (12-11-2026): el cronómetro con «CRONOTA» (original en `docs/marca/cronota-logo.webp`). Está en el icono de la app y del `.exe`, en los iconos de la Store, en las imágenes del instalador y en la web. Se regenera con los scripts de `build-hooks/` (pasos en `make-icon-ico.js`).
- [ ] **Fotos con la interfaz nueva** (la hace ChatGPT; cuando esté): fotos del README (`docs/readme/portada.png` y `capturas.png`) y capturas de la Store, sin «imputame» y con datos inventados.
- [x] **Ficha de la Store, fotos y logo** (12-11-2026): envío 2, solo ficha y sin paquete nuevo. Lleva las cinco capturas de `docs/store/`, el póster, la caja, los iconos de 300, 150 y 71 y las novedades sin el nombre antiguo. Enviado a certificación el 12-11-2026 por la tarde; se publica solo al aprobarse. Claude in Chrome ya está conectado en el portátil nuevo.
- [ ] **Ficha de la Store, lo que falta**: el vídeo (lo prepara ChatGPT con ESL) y la URL de privacidad nueva, en el envío de la 2.9.2. Ese envío no se puede abrir hasta que termine la certificación del envío 2.
- [x] **Pasar a la Store a los que usan el instalador** (12-11-2026: aprobado y programado, falta probarlo). Detalle justo debajo.

#### Pasar a la Store a los que usan el instalador (aprobado el 12-11-2026)

Son 3 compañeros con la versión del instalador (2.9.0). Objetivo: que pasen a la de la Store con un solo clic y sin perder nada. Código en `migracion-store.js` y ventana en `src/migrar.html`.

1. **Aviso imposible de esquivar** (solo en la versión del instalador): 5 s después de arrancar sale una ventana grande, por encima de todo: «Buenas noticias: Cronota se muda a la Microsoft Store». Lleva el logo animado y el botón de Microsoft que pasó Álvaro, con la letra de la app. No se cierra con Alt+F4: solo con «Más tarde», que la esconde 4 horas o hasta el siguiente arranque. También se abre desde la bandeja («Pasar a la Microsoft Store…»).
2. **Al pulsar el botón**: guarda una copia completa en `Documentos\Cronota\cronota-traspaso.json` y abre la ficha de la Store. La ventana pasa a «Pulsa Obtener en la Store» y cada 6 s mira si ya está instalada (media hora como mucho).
3. **En cuanto la de la Store está instalada**, la del instalador se aparta:
   - para la tarea en marcha y lo guarda todo;
   - quita su arranque con Windows;
   - se cierra;
   - un PowerShell sin ventana la desinstala en silencio y abre la de la Store.

   Lo hace también sola al arrancar, o cuando alguien intenta abrir la de la Store con esta abierta. Así nunca están las dos abiertas a la vez.
4. **La primera vez que se abre la de la Store**: ve la carpeta de datos de siempre (el desinstalador no la borra). Si aun así arrancara vacía, se trae el traspaso de `Documentos`. Da la bienvenida con cuántas tareas tiene.
5. **Orden de publicación**: primero la 2.9.2 de la Store, certificada y publicada; después la 2.9.2 estable del instalador, que es la que lleva el aviso. Así nadie llega a una Store sin la bienvenida ni el arranque con Windows. En la beta del instalador sale ya el aviso: que la pruebe Álvaro, o avisar a los «Betatester» de que no lo pulsen todavía.

Hecho además:

- [x] **Arranque con Windows en la de la Store**: el paquete lleva tarea de inicio (`addAutoLaunchExtension`). Como no pasa `--hidden`, la app deduce que es el inicio de sesión si el escritorio arrancó hace menos de 3 minutos, y entonces no abre el panel.
- [x] **Copia automática** cada día en `Documentos\Cronota\Copias automáticas` (las 14 últimas), en las dos versiones: los datos de la de la Store viven dentro del paquete y Windows los borra si se desinstala. Política de privacidad actualizada.

Pendiente:

- [ ] **Portátiles de la empresa**: comprobar con un compañero que se puede instalar desde la Store.
- [ ] **Prueba en un equipo real**, en un momento acordado: el aviso, el cambio (desinstalar la antigua y abrir la nueva), los datos y el arranque con Windows de la nueva.
- [ ] **Después**: ya no habrá usuarios del instalador. Decidir si las betas pasan a los paquetes de prueba de Partner Center o siguen en GitHub solo para quien las pruebe.

El ciclo, paso a paso (la primera vez lo hacemos juntos y se anota aquí lo que se aprenda):

1. Cerrar la lista de arriba y subir la versión a `2.9.2` en `package.json` (también la del bloque `appx`; la Store exige que sea mayor que la publicada) y escribir las novedades en `WHATS_NEW` de `main.js`.
2. `npm run check` y capturas en segundo plano.
3. **Beta** `2.9.2-beta.1` en GitHub (prerelease) para los que tienen «Betatester». Unos días de uso; si sale algo, se arregla y `beta.2`.
4. **Estable** `2.9.2` en GitHub («Latest»): la reciben solos los que usan el instalador. *En la 2.9.2, este paso va después del 5 (ver «Orden de publicación» arriba).*
5. **Store**: `npm run store` → en Partner Center, *Actualizar* el envío → subir el `.appx` nuevo en Paquetes → poner las novedades en la ficha («Novedades de esta versión») → enviar a certificación (1–3 días). Los de la Store la reciben solos desde la propia Store.
6. Comprobar en un equipo con la versión de la Store que se actualiza, y unir la rama a `main`.

Lo que se aprenda en esta primera vuelta (tiempos reales, pasos de Partner Center, sorpresas) se apunta aquí debajo:

- **2.9.2 estable en GitHub** (12-11-2026, decisión de Álvaro): sin beta previa y antes que la 2.9.2 de la Store, para que todos pasen ya a la Store. Quien pulse el botón instala la 2.9.1 de la Store, que no arranca sola con Windows hasta que llegue la 2.9.2 allí. La versión de GitHub lleva también `imputame-setup.exe` e `imputame-portable.exe` (copias) para que la web y los enlaces antiguos sigan descargando; se pueden quitar cuando la web apunte a la Store.
- **Cambiar solo la ficha** (12-11-2026, envío 2): Información general → «Iniciar actualización» → Descripciones de Store → Español (España). Cada recuadro de imagen admite un solo archivo. El de una captura que ya existe la sustituye; las nuevas van por el «+». Después, «Guardar» y «Enviar para certificación». Mientras se certifica no se puede abrir otro envío. *Apuntar aquí cuánto tardó en salir.*

### Fase 1 · La píldora entre pantallas (2.10)

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

- **Microsoft Store**: además de lo de la Fase 0, más capturas (tema claro, barra flotante, recordatorio, nueva tarea) e imágenes de portada (póster 720×1080 y cuadrada 1080×1080).
- **«imputame» por dentro**: la app del móvil (paquete Android `me.imputa.app` y sus textos) y los dominios `imputame.dripdev.dev` e `imputame-app.dripdev.dev`, que piden cambios en Vercel, en el DNS y un APK nuevo. El ejecutable y las carpetas del instalador no hace falta cambiarlos si todos pasan a la Store.
- **Instalador**: confirmar en un equipo real que la actualización silenciosa y la espera ante ficheros ocupados (SentinelOne) funcionan. Si sigue fallando, pedir a sistemas que excluyan la carpeta de la app.
- **Primera instalación**: decidir si se hace silenciosa o con instalador propio (hoy sale la ventanita de Windows).
