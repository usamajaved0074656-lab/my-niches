@echo off
schtasks /Delete /F /TN "MyNiches-server" >nul 2>&1
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\MyNiches-server.vbs" >nul 2>&1
echo Autostart removed.
echo To stop the running server: end wscript.exe (the watchdog) first, then node.exe.
pause
