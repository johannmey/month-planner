@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is required but was not found on PATH.
    echo Install Node.js 20 or newer, then try again.
    pause
    exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
    echo pnpm is required but was not found on PATH.
    echo Install pnpm 9 or newer, then try again.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo Installing project dependencies...
    call pnpm install
    if errorlevel 1 (
        echo Dependency installation failed.
        pause
        exit /b 1
    )
)

echo Starting Month Planner...
start "Month Planner" /D "%~dp0" cmd.exe /k pnpm dev

echo Waiting for the local app to start...
call pnpm exec wait-on --timeout 120000 http-get://127.0.0.1:5173
if errorlevel 1 (
    echo The app did not become available at http://127.0.0.1:5173.
    echo Check the Month Planner terminal for errors.
    pause
    exit /b 1
)

start "" "http://127.0.0.1:5173"
