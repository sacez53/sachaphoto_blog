@echo off
title Nouvel article — Blog
cd /d "%~dp0"
powershell -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "%~dp0new-article.ps1"
