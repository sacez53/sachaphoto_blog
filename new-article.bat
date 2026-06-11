@echo off
title Nouvel article — Blog
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0new-article.ps1"
pause
