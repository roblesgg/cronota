' Abre Cronota en modo pruebas, con el codigo del proyecto tal y como esta ahora (sin instalar
' nada) y con sus propios datos en %TEMP%\cronota-pruebas: no toca tus horas reales ni tu
' Cronota de la Store, y puede ir a la vez que ella. La primera vez copia tus datos; para
' empezar otra vez desde tus datos actuales, arrastra cualquier cosa encima de este archivo o
' lanzalo con: wscript tools\modo-pruebas.vbs nuevos
' Para cerrarlo: icono de la bandeja que pone "PRUEBAS" -> Salir.
Dim shell, env, extra
Set shell = WScript.CreateObject("WScript.Shell")
Set env = shell.Environment("Process")
On Error Resume Next
env.Remove "ELECTRON_RUN_AS_NODE"
On Error Goto 0
extra = ""
If WScript.Arguments.Count > 0 Then extra = " --datos-nuevos"
Dim dir
' El script vive en tools: el proyecto es la carpeta de encima.
dir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
dir = Left(dir, InStrRev(Left(dir, Len(dir) - 1), "\"))
shell.CurrentDirectory = dir
shell.Run """" & dir & "node_modules\electron\dist\electron.exe"" . --pruebas" & extra, 0, False
