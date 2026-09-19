@echo off
setlocal enabledelayedexpansion
title Task-Mentor - 1-Click Dev Launcher
cd /d "%~dp0"

echo ===================================================
echo       NGA Task-Mentor - 1-Click Local Dev
echo ===================================================
echo.

:: 1. Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: 2. Setup .env files if missing
echo [1/4] Checking environment configuration...
if not exist "server\.env" (
    if exist "server\.env.example" (
        copy "server\.env.example" "server\.env" >nul
        echo   - Created server\.env from example
    )
)
if not exist "client\.env" (
    if exist "client\.env.example" (
        copy "client\.env.example" "client\.env" >nul
        echo   - Created client\.env from example
    )
)

:: 3. Locate MySQL (PATH or XAMPP)
echo [2/4] Checking MySQL connection...
set "MYSQL_CMD="
where mysql >nul 2>&1
if not errorlevel 1 (
    set "MYSQL_CMD=mysql"
) else if exist "C:\xampp\mysql\bin\mysql.exe" (
    set "MYSQL_CMD=C:\xampp\mysql\bin\mysql.exe"
) else if exist "D:\xampp\mysql\bin\mysql.exe" (
    set "MYSQL_CMD=D:\xampp\mysql\bin\mysql.exe"
)

if "%MYSQL_CMD%"=="" (
    echo [WARNING] MySQL command not found in PATH or standard XAMPP folders.
    echo If you use XAMPP, please make sure MySQL is started in XAMPP Control Panel.
    echo Skipping automatic DB import.
) else (
    :: Check if MySQL is running
    "%MYSQL_CMD%" -u root -e "SELECT 1;" >nul 2>&1
    if errorlevel 1 (
        echo.
        echo [!] MySQL server is not running!
        echo Please open XAMPP Control Panel and click 'Start' next to MySQL.
        echo.
        echo Press any key after starting MySQL to retry...
        pause >nul
    )

    :: Check/Create database
    "%MYSQL_CMD%" -u root -e "CREATE DATABASE IF NOT EXISTS taskmentor_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" >nul 2>&1
    
    :: Check if tables exist
    "%MYSQL_CMD%" -u root -e "USE taskmentor_dev; SELECT 1 FROM users LIMIT 1;" >nul 2>&1
    if errorlevel 1 (
        echo   - Database 'taskmentor_dev' is empty. Importing taskmentor_dev.sql...
        if exist "server\taskmentor_dev.sql" (
            "%MYSQL_CMD%" -u root taskmentor_dev < "server\taskmentor_dev.sql"
            echo   - Successfully imported server\taskmentor_dev.sql!
        ) else if exist "taskmentor_dev.sql" (
            "%MYSQL_CMD%" -u root taskmentor_dev < "taskmentor_dev.sql"
            echo   - Successfully imported taskmentor_dev.sql!
        ) else (
            echo   - [WARNING] taskmentor_dev.sql not found.
        )
    ) else (
        echo   - Database 'taskmentor_dev' is ready.
    )
)

:: 4. Install dependencies if needed
echo [3/4] Checking dependencies...
if not exist "node_modules" (
    echo   - Installing root dependencies...
    call npm install
)
if not exist "server\node_modules" (
    echo   - Installing server dependencies...
    call npm install --prefix server
)
if not exist "client\node_modules" (
    echo   - Installing client dependencies...
    call npm install --prefix client
)

:: 5. Start development servers
echo [4/4] Starting Task-Mentor (Server + Client)...
echo.
echo ===================================================
echo   Server: http://localhost:5002
echo   Client: http://localhost:5173/taskmentor
echo ===================================================
echo.
call npm run dev
pause
