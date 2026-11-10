; Cierre de imputa.me antes de instalar encima.
;
; La comprobación de serie de electron-builder mata la app con taskkill /f, espera
; unos 3 s en total y, si aún ve un proceso imputa.me.exe, saca "no se puede cerrar
; imputa.me, ciérrela y pulse Reintentar". Electron son varios procesos (principal,
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
; propia app, así que el instalador y su cmd son HIJOS de imputa.me.exe: si la app seguía
; viva al forzar, taskkill /t mataba también al instalador (comprobado con un proceso de
; prueba) y la actualización se quedaba a medias sin avisar. No hace falta /t: todos los
; procesos de la app (principal, GPU, uno por ventana) se llaman imputa.me.exe y /im ya los
; coge uno por uno.
;
; Si aun así no se puede cerrar, lo que contestó taskkill se guarda en
; %TEMP%\imputame-instalador.log antes de preguntar, para saber por qué (p. ej. "Acceso
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
        FileOpen $R4 "$TEMP\imputame-instalador.log" w
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
