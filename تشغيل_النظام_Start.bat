@echo off
cd /d "%~dp0"
setlocal enabledelayedexpansion
title St. Joseph Scout Management System

echo ===================================================
echo   St. Joseph Scout System - Windows Launcher
echo ===================================================
echo.

REM 1. Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

REM 2. Install dependencies if node_modules is missing
if not exist node_modules (
    echo [*] Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
)

REM 3. Build project if dist/server.cjs is missing
if not exist dist\server.cjs (
    echo [*] Building application...
    call npm run build
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to build the application.
        pause
        exit /b 1
    )
)

echo.
echo ===================================================
echo [*] Starting server on http://localhost:3000
echo ===================================================
echo.

REM Open browser after 2 seconds in background
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

REM Run server
call npm start

pause
