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
shell.Run """" & dir & "node_modules\electron\dist\electron.exe"" .", 0, False
