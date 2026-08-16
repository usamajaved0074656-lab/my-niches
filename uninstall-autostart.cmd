@echo off
set "OUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\MyNiches-server.vbs"
if exist "%OUT%" (
  del "%OUT%"
  echo Autostart hata diya. Server ab sirf start.cmd se chalega.
) else (
  echo Autostart laga hi nahi hua tha.
)
echo.
echo Abhi chal raha server band karna ho to:
echo   taskkill /F /IM node.exe
pause
