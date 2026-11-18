# Notas técnicas de Cronota

Lo que hay que saber para trabajar en la app y que no está a la vista en el código.

**Nombre.** Todo lo que se ve se llama Cronota: ventanas, Administrador de tareas y propiedades del `.exe` (los pone `build-hooks/afterPack.js`), editor en «Aplicaciones instaladas» (`author`), archivos que exporta la app (`cronota-horas-….csv`, `cronota-backup-FECHA.json`) y el paquete que se sube a la Store (`cronota-store.appx`). Por dentro se mantiene el nombre antiguo, que no ve nadie y que cambiarlo rompería actualizaciones o datos:
- `productName` `imputa.me`: nombre del ejecutable (`imputa.me.exe`).
- Carpeta de datos `%APPDATA%\imputa-me` y sus ficheros `imputa-*.json`.
- `appId` `me.imputa.app` y el `applicationId` de la Store: si cambian, Windows y la Store la tratan como otra app.
- La clave `imputa.horasDecimales` del calendario.

## Arrancar en desarrollo

- **En un PC nuevo**: `npm ci`. Desde npm 11.20 los scripts de instalación solo se ejecutan si están aprobados en `allowScripts` de `package.json`; ya lo están `electron` y `koffi` (si se sube su versión, volver a aprobarlos con `npm install-scripts approve electron koffi`).
  - Con Node 26, el script de Electron descarga el zip pero no lo descomprime, y no da error; `npx electron --version` responde «Electron failed to install correctly». Arreglo: descomprimir `%LOCALAPPDATA%\electron\Cache\<carpeta>\electron-v<versión>-win32-x64.zip` en `node_modules/electron/dist` con el 7za de `7zip-bin` y escribir `electron.exe` en `node_modules/electron/path.txt`.
- `npm start`, o doble clic en `tools/iniciar-dev.vbs`.
- **Desde la terminal de Claude Code o VS Code no arranca tal cual**: ponen `ELECTRON_RUN_AS_NODE=1`, y Electron se comporta como Node puro (falla al usar `ipcMain`). No basta con dejar la variable vacía: hay que quitarla (`env -u ELECTRON_RUN_AS_NODE electron .` en bash). El `.vbs` ya lo hace.
- Capturas de cualquier pantalla sin abrir ventanas: `electron tools/snap.js <pagina.html> <salida.png> [tema] [ancho] [alto] [js-antes]`. Usa los datos reales en solo lectura; para no enseñar datos reales, apunta `APPDATA` a una carpeta con datos inventados.
- **Modo pruebas** (para probar lo del roadmap antes de sacar nada): doble clic en `tools/modo-pruebas.vbs`, o `electron . --pruebas`. Abre la app con el código tal y como está, con sus datos en `%TEMP%\cronota-pruebas` (la primera vez copia los reales; con `--datos-nuevos`, o arrastrando algo encima del `.vbs`, los vuelve a copiar). No toca los datos reales, no se apunta al inicio de Windows ni busca actualizaciones, y el icono de la bandeja pone «PRUEBAS». Puede ir a la vez que la Cronota de la Store; si las barras flotantes se pisan, cierra una.
- Antes de publicar: `npm run check` (sintaxis, referencias y pintado de la pestaña Tareas). Tiene que decir «Todo en orden».

## Datos

- Tareas: `%APPDATA%\imputa-me\imputa-tasks.json`. Ajustes: `imputa-settings.json` en la misma carpeta.
- Cada cambio se guarda al momento (guardado atómico). Las entradas guardan instantes absolutos (`start`/`end` en ms); una en curso tiene `end: null` y se calcula con la hora actual, así que un apagado brusco no pierde datos.
- Los ajustes también se guardan de forma atómica (2.13). Si un fichero está roto al arrancar, se aparta como `.corrupt-<fecha>` y se prueba con el `.tmp`.
- Con una tarea en marcha, cada minuto se apunta `ultimoLatido`. Si la app se cerró de golpe, al arrancar la tarea se para en ese último latido y se avisa; al apagar o cerrar sesión se para en el momento (`session-end`).
- Copias diarias en `Documentos\Cronota\Copias automáticas` (`copias.js`, las 14 últimas).
- Desde la 2.13 no hay cuenta ni sincronización (la de Supabase y la app del móvil se quitaron). Algunas tareas viejas conservan un `remoteId` que ya no se usa.

## Compilar y publicar

Solo se publica en la Microsoft Store. El proceso completo (planificar → modo pruebas → Store) está en [ROADMAP.md](ROADMAP.md).

- Paquete de la Store: **en los portátiles de la empresa no se puede compilar** (la protección retira `makeappx.exe` al usarlo, 12-11-2026). Se compila en GitHub: Actions → «Paquete para la Microsoft Store» → Run workflow (o `gh workflow run paquete-store.yml --ref main`). El `.appx` se descarga como artefacto `cronota-store` de la ejecución (o con `gh run download <id> -n cronota-store`). Usa la versión de `package.json` de `main`.
- En un equipo donde sí se pueda: `npm run store` (`electron-builder --win appx`).
- Subirlo: Partner Center → Cronota → «Iniciar actualización» → Paquetes (arrastrar el `.appx`, 113 MB) → Descripciones de Store → «Novedades de esta versión» → «Enviar para certificación». Las últimas versiones se publicaron en menos de una hora.
- **winCodeSign**: electron-builder descarga unas herramientas de firma con enlaces de macOS que Windows no deja crear sin el modo desarrollador. Si el empaquetado falla en `app-builder.exe`, descomprimir `winCodeSign-2.6.0.7z` con el 7za de `7zip-bin` en `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0`, sin la carpeta `darwin`. Por lo mismo, `signAndEditExecutable` está en `false` y el icono del `.exe` lo pone `build-hooks/afterPack.js` con `rcedit`.

## Versión de la Store

- **Cómo se sabe cuál es**: `IS_STORE = !!process.windowsStore`. La actualiza la propia Store; «Buscar actualizaciones…» solo abre su ficha. Arranca con Windows por la tarea de inicio del paquete (`addAutoLaunchExtension`); como esa tarea no pasa `--hidden`, `arranqueDeSesion()` (`copias.js`) lo deduce de cuánto lleva abierto el escritorio.
- **Sus datos**: Windows le enseña la carpeta `%APPDATA%\imputa-me` de siempre, pero lo que escribe nuevo va a su carpeta del paquete (`%LOCALAPPDATA%\Packages\lvaroRoblesGonzlezDripDev.Cronota_v2tdvvj5ej2c0\LocalCache\Roaming\imputa-me`), que se borra al desinstalarla. Por eso hay copia diaria en `Documentos\Cronota\Copias automáticas`.
- **No puede tocar nada fuera de su paquete**: Windows le da su propia copia del registro (HKCU) y de AppData, así que lo que «borre» o escriba ahí solo lo ve ella. Para leer el registro real (p. ej. el micrófono en `en-llamada.js`) se usa `reg.exe`.
- **Historia** (2.9.2–2.13): hubo una versión del instalador (NSIS, GitHub Releases, `electron-updater`) y una ventana para pasarse a la Store. Se quitó todo en la 2.13. Lo aprendido: nada de PowerShell ni procesos ocultos (el antivirus de la empresa, SentinelOne, los bloquea).

## Logo

El original está en `docs/marca/cronota-logo.webp` y su PNG con transparencia (1080×1080) en `assets/icon.png`. Al cambiarlo hay que rehacer el `.ico`, los iconos de la Store, las imágenes del instalador y el de la web: los pasos están en `build-hooks/make-icon-ico.js`.

## Las dos notas de una tarea

Cronota tiene **dos modos de nota**, que no se mezclan:

### 1. Nota de sesión — `entry.note` (máx. 500)

- Vive en la **entrada/fichaje** concreto (el rato que estás imputando ahora).
- UI: `activeNoteInput` en el Panel, popup del calendario, reiniciar-con-nota.
- Sirve para “qué estoy haciendo en este rato”.
- No sustituye ni se rellena con el memo de la tarea.

### 2. Nota fija de la tarea — `task.memo` (máx. 200)

- Vive en la **tarea** y **sobrevive entre sesiones**.
- UI Panel: fila editable `#taskMemoRow` / `#taskMemoInput` (icono de marcador), encima de la nota de sesión.
- También editable en **Tareas** (popup de editar / al arrancar una guardada), y se muestra como pista de solo lectura en el popup del **Calendario** (`Nota fija: …`).
- Casos de uso: id de Dynamics/ERP, recordatorio fijo, código interno.

IPC: `set-task-memo` → `setTaskMemo(taskId, memo)` (también acepta `memo` vía `update-task-meta`).


### 3. Tipo de tarea — `task.taskType` (`'ongoing' | 'oneShot'`)

- **Recurrente** (`ongoing`): tareas que se retoman días/semanas. Se llamaba "En curso", pero
  chocaba con "la tarea que está corriendo ahora": parecía que todas estuvieran en marcha.
- **Puntual** (`oneShot`): un shot concreto.
- Default al migrar: `ongoing`.
- UI: badges + filtros en Panel y Tareas; se elige al crear/editar.
- Se guarda con la tarea, como el memo.
