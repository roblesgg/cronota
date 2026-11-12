# Notas técnicas de Cronota

Lo que hay que saber para trabajar en la app y que no está a la vista en el código.

**Nombre.** Todo lo que se ve se llama Cronota: ventanas, Administrador de tareas y propiedades del `.exe` (los pone `build-hooks/afterPack.js`), editor en «Aplicaciones instaladas» (`author`), archivos que exporta la app (`cronota-horas-….csv`, `cronota-backup-FECHA.json`) y archivos que se publican (`cronota-setup.exe`, `cronota-portable.exe`, `cronota-store.appx`). Por dentro se mantiene el nombre antiguo, que no ve nadie y que cambiarlo rompería actualizaciones o datos:
- `productName` `imputa.me`: nombre del ejecutable (`imputa.me.exe`) y de la carpeta de instalación. También sale en la ventana del instalador la primera vez que se instala.
- Carpeta de datos `%APPDATA%\imputa-me` y sus ficheros `imputa-*.json`.
- `appId` `me.imputa.app` y el `applicationId` de la Store: si cambian, Windows y la Store la tratan como otra app.
- La clave `imputa.horasDecimales` del calendario y el canal `imputame-desktop` de Supabase.
- La app del móvil y los dominios `imputame.dripdev.dev` e `imputame-app.dripdev.dev`.

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
  - **Quitar la versión anterior**: si algún fichero sigue ocupado (en los equipos de la empresa, SentinelOne los retiene un rato), reintenta durante ~1 min; si no puede, vuelve a abrir la versión que había. Si no consigue cerrar la app, deja el motivo en `%TEMP%\cronota-instalador.log`.
- La app instala las actualizaciones en silencio (`quitAndInstall(true, true)`) y vuelve a abrirse sola.
- Los cambios del instalador solo se notan **a partir de la versión que los trae**, porque el desinstalador que se ejecuta es el de la versión vieja.

## Versión de la Store y paso desde el instalador (2.9.2)

- **Cómo se sabe cuál es**: `IS_STORE = !!process.windowsStore`. La de la Store no usa el actualizador ni el registro de inicio. Arranca con Windows por la tarea de inicio del paquete (`addAutoLaunchExtension`); como esa tarea no pasa `--hidden`, `arranqueDeSesion()` lo deduce de cuánto lleva abierto el escritorio.
- **Sus datos**: Windows le enseña la carpeta `%APPDATA%\imputa-me` de siempre, pero lo que escribe nuevo va a su carpeta del paquete (`%LOCALAPPDATA%\Packages\lvaroRoblesGonzlezDripDev.Cronota_v2tdvvj5ej2c0\LocalCache\Roaming\imputa-me`), que se borra al desinstalarla. Por eso hay copia diaria en `Documentos\Cronota\Copias automáticas`.
- **El paso del instalador a la Store** está en `migracion-store.js`, con la ventana `src/migrar.html`. Desde la 2.9.3, la versión del instalador **no se desinstala sola**: abre la de la Store como cualquier programa y se cierra. Antes suelta el bloqueo de instancia única, porque las dos versiones lo comparten (comprobado: con la vieja abierta, la de la Store se cierra al arrancar). La vieja se queda instalada, se quita a mano desde Configuración → Aplicaciones y, mientras siga, abrirla lleva a la de la Store.
- **Lo que no funcionó (2.9.2)**: desinstalar la vieja con un PowerShell suelto en segundo plano. En los portátiles de la empresa el antivirus (SentinelOne) no lo deja correr, y la app se cerraba sin hacer nada más. Nada de procesos ocultos para esto.
- **Comprobar si está instalada la de la Store**: Windows apunta cada app de la Store instalada para el usuario en `HKCU\Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppModel\Repository\Packages` (p. ej. `lvaroRoblesGonzlezDripDev.Cronota_2.9.1.0_x64__v2tdvvj5ej2c0`) y quita la entrada al desinstalarla. Se lee con `reg.exe query … /f lvaroRoblesGonzlezDripDev.Cronota_ /k`. Abrirla: `explorer.exe shell:AppsFolder\<familia>!imputame`; por eso el `applicationId` del paquete no se cambia.
- **Verlo de verdad sin cambiar nada**: doble clic en `tools/simular-paso-store.vbs`, o el `.exe` instalado con `--simular-paso-store`. Abre la app con una copia de los datos en `%TEMP%\cronota-simulacro`, sin barra flotante y con «SIMULACRO» en el icono de la bandeja. Enseña el aviso aunque la de la Store ya esté instalada y, al «cambiarse», pasa a la bienvenida en vez de desinstalar nada.
- **Capturas de la ventana sin la app**: `electron tools/snap.js "migrar.html?modo=aviso&tareas=57&grupos=10" salida.png noche 520 700 1`, con `SNAP_WAIT=2600` para que terminen las animaciones. Los modos son `aviso`, `esperando`, `listo` y `bienvenida` (este con `&traidas=1`).

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
