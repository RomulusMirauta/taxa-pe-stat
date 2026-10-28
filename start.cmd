@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nu este instalat. Descarca-l de pe https://nodejs.org si ruleaza din nou.
  pause
  exit /b 1
)
start "" http://localhost:5173
node serve.mjs
