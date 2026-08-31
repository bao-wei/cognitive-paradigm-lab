@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js and try again.
  pause
  exit /b 1
)
title Cognitive Paradigm Import Assistant
echo Starting the local import assistant...
node tools\import-assistant-server.mjs
if errorlevel 1 (
  echo.
  echo The assistant stopped unexpectedly. Keep the message above for troubleshooting.
  pause
)
