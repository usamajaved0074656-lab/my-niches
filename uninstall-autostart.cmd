@echo off
rem Removes the My Niches autostart scheduled task, Startup folder shortcut, and watchdog.

rem Use PowerShell to unregister the user-level task without requiring admin privileges.
powershell -NoProfile -Command "Unregister-ScheduledTask -TaskName 'MyNiches-server' -Confirm:$false -ErrorAction SilentlyContinue" >nul 2>&1

rem Remove the fallback launcher from the user's Startup folder.
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\MyNiches-server.vbs" >nul 2>&1

rem Stop the running autostart watchdog so it does not restart the server 20 seconds later.
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='wscript.exe'\" | Where-Object { $_.CommandLine -like '*autostart.vbs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

echo Autostart removed. To stop the server now, close the My Niches server window (or restart the PC).
pause
