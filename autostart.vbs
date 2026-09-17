' My Niches watchdog. Started at logon (Task Scheduler + Startup folder).
' Every 20s: if nothing answers on :5173, start the server and wait on it, so a
' crash or a killed process comes back by itself instead of staying down.
Option Explicit
Dim fso, sh, dir, node, logFile, http, up
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
node = sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"
If Not fso.FileExists(node) Then node = "node"
If Not fso.FolderExists(dir & "\data") Then fso.CreateFolder(dir & "\data")
logFile = dir & "\data\server.log"
sh.CurrentDirectory = dir

Do
  up = False
  On Error Resume Next
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.setTimeouts 3000, 3000, 3000, 3000
  http.open "GET", "http://localhost:5173/", False
  http.send
  If Err.Number = 0 Then If http.status > 0 Then up = True
  Err.Clear
  On Error GoTo 0
  If Not up Then
    sh.Run "cmd /c """"" & node & """ server.js >> """ & logFile & """ 2>&1""", 0, True
  End If
  WScript.Sleep 20000
Loop
