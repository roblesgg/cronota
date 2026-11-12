' Abre Cronota en modo simulacro del paso a la Microsoft Store (2.9.2): ensena el aviso con
' una copia de tus datos y no cambia nada de verdad (ver SIMULACRO_STORE en main.js).
' Doble clic, o: wscript tools\simular-paso-store.vbs
' Para cerrarlo: icono de la bandeja que pone "SIMULACRO" -> Salir.
Dim shell, env
Set shell = WScript.CreateObject("WScript.Shell")
Set env = shell.Environment("Process")
On Error Resume Next
env.Remove "ELECTRON_RUN_AS_NODE"
On Error Goto 0
Dim dir
' El script vive en tools: el proyecto es la carpeta de encima.
dir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
dir = Left(dir, InStrRev(Left(dir, Len(dir) - 1), "\"))
shell.CurrentDirectory = dir
shell.Run """" & dir & "node_modules\electron\dist\electron.exe"" . --simular-paso-store", 0, False
