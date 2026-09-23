@echo off
cd /d "%~dp0"

rem Ensure Node.js is installed before attempting to start the server.
where node >nul 2>nul
if errorlevel 1 (
  echo My Niches needs Node.js, and it is not installed on this PC.
  echo The download page is opening now. Install the LTS version
  echo ^(keep all the default options^), then double-click start.cmd again.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)

rem Avoid starting multiple server instances if port 5173 is already in use.
netstat -ano | findstr /r /c:":5173 .*LISTENING" >nul
if errorlevel 1 (
  echo Starting My Niches server...
  start "My Niches server" /min node server.js
  ping -n 3 127.0.0.1 >nul
  echo My Niches is running. Keep the small "My Niches server" window open ^(it can stay minimised^). Your browser will open now.
) else (
  echo Server already running.
)

rem Open in the default browser so users without Chrome can access the app.
start "" "http://localhost:5173"
