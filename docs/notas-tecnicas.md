# Notas técnicas de Cronota

Lo que hay que saber para trabajar en la app y que no está a la vista en el código. Cronota se llamaba antes **imputa.me**: por dentro se mantienen ese nombre en el ejecutable (`imputa.me.exe`), la carpeta de instalación y la de datos (`%APPDATA%\imputa-me`), para no romper las actualizaciones.

## Arrancar en desarrollo

- **En un PC nuevo**: `npm ci`. Desde npm 11.20 los scripts de instalación solo se ejecutan si están aprobados en `allowScripts` de `package.json`; ya lo están `electron` y `koffi` (si se sube su versión, volver a aprobarlos con `npm install-scripts approve electron koffi`).
  - Con Node 26, el script de Electron descarga el zip pero no lo descomprime, y no da error; `npx electron --version` responde «Electron failed to install correctly». Arreglo: descomprimir `%LOCALAPPDATA%\electron\Cache\<carpeta>\electron-v<versión>-win32-x64.zip` en `node_modules/electron/dist` con el 7za de `7zip-bin` y escribir `electron.exe` en `node_modules/electron/path.txt`.
- `npm start`, o doble clic en `tools/iniciar-dev.vbs`.
- **Desde la terminal de Claude Code o VS Code no arranca tal cual**: ponen `ELECTRON_RUN_AS_NODE=1`, y Electron se comporta como Node puro (falla al usar `ipcMain`). No basta con dejar la variable vacía: hay que quitarla (`env -u ELECTRON_RUN_AS_NODE electron .` en bash). El `.vbs` ya lo hace.
- Capturas de cualquier pantalla sin abrir ventanas: `electron tools/snap.js <pagina.html> <salida.png> [tema] [ancho] [alto] [js-antes]`. Usa los datos reales en solo lectura; para no enseñar datos reales, apunta `APPDATA` a una carpeta con datos inventados.
- Antes de publicar: `npm run check` (sintaxis, referencias y pintado de la pestaña Tareas). Tiene que decir «Todo en orden».

## Datos

- Tareas: `%APPDATA%\imputa-me\imputa-tasks.json`. Ajustes: `imputa-settings.json` en la misma carpeta.
- Cada cambio se guarda al momento (guardado atómico). Las entradas guardan instantes absolutos (`start`/`end` en ms); una en curso tiene `end: null` y se calcula con la hora actual, así que un apagado brusco no pierde datos.
- Sincronización opcional con Supabase (`sync.js`): tablas `tareas` y `fichajes`.

## Compilar y publicar

El proceso completo (planificar → beta → estable → Microsoft Store) está en [ROADMAP.md](ROADMAP.md).

- Compilar: `npx electron-builder --win --publish never -c.directories.output=dist/<versión>`. Una carpeta por versión: el `app.asar` de la anterior a veces queda bloqueado por Windows y no deja sobrescribir. Borrar `dist/` cuando ya esté publicado.
- Paquete de la Store: `npx electron-builder --win appx --publish never -c.directories.output=dist/<versión>-store`.
- Publicar en GitHub con `gh` **quitando** `GH_TOKEN` del entorno, que está caducado: `env -u GH_TOKEN -u GITHUB_TOKEN gh release create ...`. Las betas van como `--prerelease` con `beta.yml` (copia de `latest.yml`); las estables con `--latest`, también con `beta.yml`.
- **winCodeSign**: electron-builder descarga unas herramientas de firma con enlaces de macOS que Windows no deja crear sin el modo desarrollador. Si el empaquetado falla en `app-builder.exe`, descomprimir `winCodeSign-2.6.0.7z` con el 7za de `7zip-bin` en `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0`, sin la carpeta `darwin`. Por lo mismo, `signAndEditExecutable` está en `false` y el icono del `.exe` lo pone `build-hooks/afterPack.js` con `rcedit`.

## Instalador y actualizaciones

- `build/installer.nsh` personaliza el instalador:
  - **Cerrar la app**: al actualizar le da 6 s para salir sola y luego la cierra con `taskkill /f` (sin `/t`: el instalador es hijo de la app y se mataría a sí mismo).
  - **Quitar la versión anterior**: si algún fichero sigue ocupado (en los equipos de la empresa, SentinelOne los retiene un rato), reintenta durante ~1 min; si no puede, vuelve a abrir la versión que había. Si no consigue cerrar la app, deja el motivo en `%TEMP%\imputame-instalador.log`.
- La app instala las actualizaciones en silencio (`quitAndInstall(true, true)`) y vuelve a abrirse sola.
- Los cambios del instalador solo se notan **a partir de la versión que los trae**, porque el desinstalador que se ejecuta es el de la versión vieja.

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

### Sync / Supabase (importante)

`task.memo` es **solo local**. `sync.js` **no** lo incluye en el upsert de `tareas` (sigue siendo `{ id, user_id, nombre, color }`) ni en el de fichajes.

- Al **crear** una tarea local desde un pull remoto → `memo: ''`.
- Al **fusionar** name/color desde remoto → **nunca** se borra ni sobrescribe `local.memo`.

IPC: `set-task-memo` → `setTaskMemo(taskId, memo)` (también acepta `memo` vía `update-task-meta`).


### 3. Tipo de tarea — `task.taskType` (`'ongoing' | 'oneShot'`)

- **Recurrente** (`ongoing`): tareas que se retoman días/semanas. Se llamaba "En curso", pero
  chocaba con "la tarea que está corriendo ahora": parecía que todas estuvieran en marcha.
- **Puntual** (`oneShot`): un shot concreto.
- Default al migrar: `ongoing`.
- UI: badges + filtros en Panel y Tareas; se elige al crear/editar.
- Local (como el memo): sync no lo sube; al pull de tarea nueva → `taskType: 'ongoing'`.
