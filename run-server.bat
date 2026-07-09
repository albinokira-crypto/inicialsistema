@echo off
pushd "%~dp0"
start "Servidor - Projeto Planilha" cmd /k "cd /d "%~dp0" && node server.js"
timeout /t 1 >nul
start "" "http://localhost:8000/"
popd
