@echo off
setlocal enabledelayedexpansion
title Build Windows EXE - Scout Management System

echo =========================================================
echo   Building Scout System Windows EXE Installer
echo =========================================================
echo.

REM 1. Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed! Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

REM 2. Set fast reliable Electron download mirror
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

REM 3. Install dependencies
echo [*] Checking and installing dependencies...
call npm install
call npm install --save-dev electron@33.2.1 electron-builder

REM 4. Build application and bundle server
echo.
echo [*] Building application frontend and standalone backend...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed! Check the output above.
    pause
    exit /b 1
)

REM 5. Build Windows EXE
echo.
echo [*] Generating Windows Executable (.exe) packages...
call npx electron-builder --win

if %errorlevel% neq 0 (
    echo [ERROR] Electron packaging failed!
    pause
    exit /b 1
)

echo.
echo =========================================================
echo [SUCCESS] Windows installer has been created successfully!
echo.
echo Output files in folder: dist-electron\
echo  - ScoutSystem Setup 1.0.0.exe (Desktop Installer)
echo  - ScoutSystem 1.0.0.exe (Portable Version)
echo =========================================================
echo.
pause
