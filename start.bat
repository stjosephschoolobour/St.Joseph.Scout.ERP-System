@echo off
cd /d "%~dp0"
setlocal enabledelayedexpansion
title St. Joseph Scout Management System

echo ===================================================
echo   St. Joseph Scout System - Windows Launcher
echo ===================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

if not exist node_modules (
    echo [*] Installing dependencies...
    call npm install
)

if not exist dist\server.cjs (
    echo [*] Building application...
    call npm run build
)

echo.
echo ===================================================
echo [*] Starting server on http://localhost:3000
echo ===================================================
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"
call npm start

pause
