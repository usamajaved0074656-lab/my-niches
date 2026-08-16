@echo off
rem Windows login par server ko chupchap start karne ke liye Startup folder mein
rem ek launcher banata hai. Is folder ka path launcher mein likh diya jata hai,
rem to app kahin bhi rakhi ho, chalti rahegi.

set "DIR=%~dp0"
if "%DIR:~-1%"=="\" set "DIR=%DIR:~0,-1%"
set "OUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\MyNiches-server.vbs"

> "%OUT%" echo Set sh = CreateObject("WScript.Shell")
>>"%OUT%" echo sh.CurrentDirectory = "%DIR%"
>>"%OUT%" echo sh.Run "cmd /c node server.js", 0, False

echo.
echo   Ho gaya. Ab har baar Windows login par My Niches server khud start hoga
echo   (koi window nahi khulegi - chupchap background mein).
echo.
echo   Abhi bhi start kar raha hoon...
wscript.exe "%OUT%"
echo.
echo   Hatana ho to uninstall-autostart.cmd chalao.
echo.
pause
