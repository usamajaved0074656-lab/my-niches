@echo off
rem Starts the My Niches server at every Windows login, silently, and keeps it
rem running: autostart.vbs restarts it within ~20s if it ever stops.
rem Two triggers on purpose - Windows sometimes skips Startup-folder items.

echo Setting up My Niches to start with Windows...

set "DIR=%~dp0"
if "%DIR:~-1%"=="\" set "DIR=%DIR:~0,-1%"
set "VBS=%DIR%\autostart.vbs"
set "LINK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\MyNiches-server.vbs"

rem schtasks /Create /SC ONLOGON fails without admin on standard Windows accounts.
rem PowerShell Register-ScheduledTask creates the user-level task without elevation.
rem Paths are passed via environment variables so quoting inside -Command stays clean.
set "MN_VBS=%VBS%"
set "MN_DIR=%DIR%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$u = \"$env:USERDOMAIN\$env:USERNAME\"; $a = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('\"' + $env:MN_VBS + '\"') -WorkingDirectory $env:MN_DIR; $t = New-ScheduledTaskTrigger -AtLogOn -User $u; $s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew; $p = New-ScheduledTaskPrincipal -UserId $u -LogonType Interactive -RunLevel Limited; Register-ScheduledTask -TaskName 'MyNiches-server' -Action $a -Trigger $t -Settings $s -Principal $p -Force | Out-Null" >nul 2>&1

rem Startup folder shortcut acts as a fallback trigger if Task Scheduler is unavailable.
> "%LINK%" echo CreateObject("WScript.Shell").Run "wscript.exe ""%VBS%""", 0, False

rem Start watchdog directly; autostart.vbs does nothing if the server already answers on :5173.
start "" wscript.exe "%VBS%"

echo Done. My Niches now starts every time you log in, and restarts itself if it stops.
echo It is starting now - open http://localhost:5173 in a few seconds.
echo Log file: %DIR%\data\server.log
pause
