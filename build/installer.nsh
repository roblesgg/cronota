; Cierre de la app antes de instalar encima.
;
; La comprobación de serie de electron-builder mata la app con taskkill /f, espera
; unos 3 s en total y, si aún ve un proceso de la app, saca "no se puede cerrar
; la app, ciérrela y pulse Reintentar". Electron son varios procesos (principal,
; GPU, uno por ventana) y a veces tardan más que eso en desaparecer del todo, así
; que el aviso salía de vez en cuando al actualizar aunque la app ya estuviera
; saliendo. Y si ahí se pulsa Cancelar, la actualización se queda a medias.
;
; Esta versión:
;   - En una actualización (--updated) no pregunta nada: la app ya está cerrándose
;     sola (installUpdateNow en main.js guarda y sale en 4 s como mucho), así que
;     primero le da hasta 6 s para irse por las buenas.
;   - Después la cierra a la fuerza y lo repite
;     cada medio segundo, en vez de rendirse al segundo intento.
;   - Solo si tras ~20 s sigue viva pregunta, y Reintentar vuelve a forzar.
; En una instalación a mano con la app abierta pregunta como siempre antes de
; cerrarla, y a partir de ahí igual.

; 2.8.5: SIN /t (matar también los procesos hijos). Al actualizar, el instalador lo lanza la
; propia app, así que el instalador y su cmd son HIJOS del .exe de la app: si la app seguía
; viva al forzar, taskkill /t mataba también al instalador (comprobado con un proceso de
; prueba) y la actualización se quedaba a medias sin avisar. No hace falta /t: todos los
; procesos de la app (principal, GPU, uno por ventana) tienen el mismo nombre de .exe y /im ya los
; coge uno por uno.
;
; Si aun así no se puede cerrar, lo que contestó taskkill se guarda en
; %TEMP%\cronota-instalador.log antes de preguntar, para saber por qué (p. ej. "Acceso
; denegado" si la app se abrió como administrador).
!macro customCheckAppRunning
  !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
  ${if} $R0 == 0
    ${ifNot} ${isUpdated}
      MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK +2
      Quit
      ; A mano no se va a cerrar sola: se pasa directamente a forzar.
      StrCpy $R1 12
    ${else}
      StrCpy $R1 0
    ${endIf}

    DetailPrint `Closing running "${PRODUCT_NAME}"...`
    Push $R2
    Push $R3
    Push $R4
    ${Do}
      !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
      ${IfThen} $R0 != 0 ${|} ${ExitDo} ${|}
      IntOp $R1 $R1 + 1
      ${if} $R1 > 12
        !ifdef INSTALL_MODE_PER_ALL_USERS
          nsExec::ExecToStack `taskkill /f /im "${APP_EXECUTABLE_FILENAME}"`
        !else
          nsExec::ExecToStack `%SYSTEMROOT%\System32\cmd.exe /c taskkill /f /im "${APP_EXECUTABLE_FILENAME}" /fi "USERNAME eq %USERNAME%"`
        !endif
        Pop $R2   ; código de salida
        Pop $R3   ; lo que contestó taskkill
      ${endIf}
      ${if} $R1 > 52
        ClearErrors
        FileOpen $R4 "$TEMP\cronota-instalador.log" w
        ${IfNot} ${Errors}
          FileWrite $R4 "taskkill codigo=$R2$\r$\n$R3$\r$\n"
          FileClose $R4
        ${EndIf}
        MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY +2
        Quit
        StrCpy $R1 12
      ${endIf}
      Sleep 500
    ${Loop}
    Pop $R4
    Pop $R3
    Pop $R2

    ; Que Windows suelte los ficheros del proceso que acaba de morir antes de copiar.
    Sleep 500
  ${endIf}
!macroend

; ── Quitar la versión anterior con paciencia (2.8.5) ────────────────────────────────────
; Al actualizar, el instalador nuevo ejecuta el desinstalador de la versión anterior, que mueve
; uno a uno sus ficheros y, si alguno está ocupado, lo devuelve todo y sale con código 2.
; electron-builder lo reintenta 5 veces en unos 5 s y luego enseña "Fallo al desinstalar
; archivos antiguos de la aplicación: 2" y se va. En los equipos de la empresa, el antivirus
; (SentinelOne, además de Defender) tiene abiertos los ficheros de un programa recién cerrado
; más rato que eso. Aquí se sigue intentando hasta ~1 min, cerrando cualquier resto de la app
; entre intento e intento; y si ni así, se vuelve a abrir la versión que había (sus ficheros
; están intactos: el desinstalador los restaura) para no dejar a nadie sin la app.
; Usa lo que deja uninstallOldVersion: $R0 (resultado) y $0 (argumentos).
!macro customUnInstallCheck
  ${If} ${Errors}
    DetailPrint `Uninstall was not successful. Not able to launch uninstaller!`
  ${Else}
    ; Las variables de electron-builder (uninstallerFileNameTemp, installationDir) se declaran
    ; más abajo en su plantilla y aquí aún no existen: se sacan las mismas rutas por su cuenta.
    ReadRegStr $R8 SHCTX "${INSTALL_REGISTRY_KEY}" InstallLocation
    ${If} $R8 == ""
      StrCpy $R8 $INSTDIR
    ${EndIf}
    StrCpy $R6 0
    ${DoWhile} $R0 != 0
      IntOp $R6 $R6 + 1
      ${If} $R6 > 8
        ${ExitDo}
      ${EndIf}
      DetailPrint `Old version still busy (code $R0), retrying ($R6)...`
      Sleep 3000
      nsExec::Exec `%SYSTEMROOT%\System32\cmd.exe /c taskkill /f /im "${APP_EXECUTABLE_FILENAME}" /fi "USERNAME eq %USERNAME%"`
      Pop $R7
      ClearErrors
      ExecWait '"$PLUGINSDIR\old-uninstaller.exe" /S /KEEP_APP_DATA $0 _?=$R8' $R0
      ${If} ${Errors}
        ClearErrors
        ExecWait '"$R8\${UNINSTALL_FILENAME}" /S /KEEP_APP_DATA $0 _?=$R8' $R0
      ${EndIf}
    ${Loop}
    ${If} $R0 != 0
      MessageBox MB_OK|MB_ICONEXCLAMATION "$(uninstallFailed): $R0"
      DetailPrint `Uninstall was not successful. Uninstaller error code: $R0.`
      ${If} ${FileExists} "$R8\${APP_EXECUTABLE_FILENAME}"
        Exec '"$R8\${APP_EXECUTABLE_FILENAME}"'
      ${EndIf}
      SetErrorLevel 2
      Quit
    ${EndIf}
  ${EndIf}
!macroend
