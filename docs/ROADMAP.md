# Roadmap de Cronota

Última revisión: 11 de noviembre de 2026 · Versión publicada: 2.9.1 (instalador) / en certificación (Microsoft Store)

Las peticiones nuevas que vayan saliendo se apuntan en la fase que toque (las pequeñas, en la siguiente actualización pendiente) para no publicar cambios sueltos.

## Cómo se trabaja cada cambio

Todo cambio sigue siempre estos cuatro pasos, sin saltarse ninguno:

1. **Planificar**: antes de tocar código se escribe qué se va a hacer, cómo se va a probar y qué puede romperse. Álvaro lo revisa y da el visto bueno.
2. **Implementar y comprobar**: `npm run check` en verde, capturas en segundo plano (`tools/snap.js`) y, cuando haga falta usar la app de verdad, prueba acordada con Álvaro (nunca moviéndole el ratón sin avisar).
3. **Beta**: se publica como versión de prueba `X.Y.Z-beta.N` (prerelease en GitHub). Solo la reciben quienes tienen «Betatester» encendido. Se deja rodar y se corrigen los fallos que salgan.
4. **Publicar**: cuando la beta va bien, versión estable `X.Y.Z` para todos (GitHub, «Latest») **y** envío del mismo código a la Microsoft Store (`npm run store` → subir `imputame-store.appx` en Partner Center).

## Fases

### Fase 0 · Primera actualización en la Microsoft Store (2.9.2) — EN CURSO

**Cuándo:** en cuanto Microsoft apruebe y publique la 2.9.1 en la Store. Hasta entonces no se publica nada: los cambios se van guardando en la rama `2.9.2-primera-actualizacion` y se apuntan aquí.

**Para qué:** aprender el ciclo completo con algo pequeño y de poco riesgo (cambio → beta → estable + Store) antes de las fases grandes. Cuando esta actualización llegue bien a la Store, Álvaro empieza a **promocionar la app**.

Cambios que lleva (se van añadiendo según salen):

- [x] **Calendario · sugerencia de pegar**: «Ctrl+V pegar aquí» sale una sola vez por cada cosa copiada; se va al pegar, con una x o a los 10 s sin pegar. Ctrl+V sigue pegando donde hiciste clic. *(hecho, pendiente de probar en la beta)*

El ciclo, paso a paso (la primera vez lo hacemos juntos y se anota aquí lo que se aprenda):

1. Cerrar la lista de arriba y subir la versión a `2.9.2` en `package.json` (también la del bloque `appx`; la Store exige que sea mayor que la publicada) y escribir las novedades en `WHATS_NEW` de `main.js`.
2. `npm run check` y capturas en segundo plano.
3. **Beta** `2.9.2-beta.1` en GitHub (prerelease) para los que tienen «Betatester». Unos días de uso; si sale algo, se arregla y `beta.2`.
4. **Estable** `2.9.2` en GitHub («Latest»): la reciben solos los que usan el instalador.
5. **Store**: `npm run store` → en Partner Center, *Actualizar* el envío → subir el `.appx` nuevo en Paquetes → poner las novedades en la ficha («Novedades de esta versión») → enviar a certificación (1–3 días). Los de la Store la reciben solos desde la propia Store.
6. Comprobar en un equipo con la versión de la Store que se actualiza, y unir la rama a `main`.

Lo que se aprenda en esta primera vuelta (tiempos reales, pasos de Partner Center, sorpresas) se apunta aquí debajo:

- *(pendiente)*

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

- **Microsoft Store**: cuando aprueben la 2.9.1, mejorar la ficha con más capturas (tema claro, barra flotante, recordatorio, nueva tarea) e imágenes de portada (póster 720×1080 y cuadrada 1080×1080).
- **Instalador**: confirmar en un equipo real que la actualización silenciosa y la espera ante ficheros ocupados (SentinelOne) funcionan. Si sigue fallando, pedir a sistemas que excluyan la carpeta de la app.
- **Primera instalación**: decidir si se hace silenciosa o con instalador propio (hoy sale la ventanita de Windows).
- **Imágenes del README** (`docs/readme/portada.png` y `capturas.png`): aún muestran el nombre y el diseño antiguos; rehacerlas con Cronota.
