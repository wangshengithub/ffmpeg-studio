@echo off
echo =================================
echo   FFmpeg Studio Startup Script
echo =================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install --registry=https://registry.npmmirror.com
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies!
        pause
        exit /b 1
    )
    echo [INFO] Dependencies installed
    echo.
)

REM Start server
echo [INFO] Starting server...
echo [INFO] FFmpeg will be downloaded automatically on first run...
echo [INFO] NODE_TLS_REJECT_UNAUTHORIZED is set in index.js
echo.
node src/index.js

pause
