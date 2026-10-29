@echo off
rem Starts Taxa pe stat locally and opens the browser once the server is ready.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download it from https://nodejs.org and run this again.
  pause
  exit /b 1
)
node serve.mjs --open
if errorlevel 1 pause
