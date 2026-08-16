@echo off
cd /d "%~dp0"
netstat -ano | findstr /r /c:":5173 .*LISTENING" >nul
if errorlevel 1 (
  echo Starting My Niches server...
  start "My Niches server" /min node server.js
  ping -n 3 127.0.0.1 >nul
) else (
  echo Server already running.
)
start chrome "http://localhost:5173"
