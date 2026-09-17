@echo off
rem Starts the My Niches server at every Windows login, silently, and keeps it
rem running: autostart.vbs restarts it within ~20s if it ever stops.
rem Two triggers on purpose - Windows sometimes skips Startup-folder items.

set "DIR=%~dp0"
if "%DIR:~-1%"=="\" set "DIR=%DIR:~0,-1%"
set "VBS=%DIR%\autostart.vbs"
set "LINK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\MyNiches-server.vbs"

schtasks /Create /F /TN "MyNiches-server" /SC ONLOGON /RL LIMITED /TR "wscript.exe \"%VBS%\"" >nul
> "%LINK%" echo CreateObject("WScript.Shell").Run "wscript.exe ""%VBS%""", 0, False

echo.
echo   Done. The server now starts at every login and restarts itself if it stops.
echo   Log: %DIR%\data\server.log
schtasks /Run /TN "MyNiches-server" >nul
echo   Started. Open http://localhost:5173
echo.
pause
