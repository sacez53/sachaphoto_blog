@echo off
setlocal
title Gestion du blog - Sacha G. Photographe
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 ou plus recent est necessaire.
  echo Installez Node.js depuis https://nodejs.org puis relancez ce fichier.
  pause
  exit /b 1
)
node "%~dp0_manager\launch.mjs"
if errorlevel 1 (
  echo Le gestionnaire n'a pas pu demarrer. Le message ci-dessus indique la cause.
  pause
  exit /b 1
)
