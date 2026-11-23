@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  start "Nombre Run server" /min cmd /c "cd /d ""%~dp0"" && py -m http.server 8000 --bind 127.0.0.1"
) else (
  start "Nombre Run server" /min cmd /c "cd /d ""%~dp0"" && python -m http.server 8000 --bind 127.0.0.1"
)
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8000/index.html"
