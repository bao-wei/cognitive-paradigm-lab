@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js。请先安装 Node.js，然后重新双击此文件。
  pause
  exit /b 1
)
echo 正在启动“知觉之间”本地导入发布助手……
node tools\import-assistant-server.mjs
if errorlevel 1 (
  echo.
  echo 助手异常退出，请保留上方信息以便排查。
  pause
)
