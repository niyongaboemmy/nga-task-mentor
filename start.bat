@echo off
setlocal enabledelayedexpansion
title TaskMentor - local development
cd /d "%~dp0"

echo ===================================================
echo    NGA TaskMentor  -  local development
echo ===================================================
echo.

:: ---------------------------------------------------------------- 1. Node.js
echo [1/5] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo   [X] Node.js is not installed, or not on your PATH.
    echo       Install the LTS build from https://nodejs.org/ and run this again.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%V in ('node -v') do echo   - Node %%V

:: -------------------------------------------------------- 2. .env from template
echo [2/5] Checking configuration...
if not exist "server\.env" (
    copy "server\.env.example" "server\.env" >nul
    echo   - Created server\.env
)
if not exist "client\.env" (
    copy "client\.env.example" "client\.env" >nul
    echo   - Created client\.env
)
:: These files are git-ignored: your local settings can never be pushed.
findstr /C:"PASTE_DEV_SECRET_FROM_MIS_SYSTEMS_PAGE" "server\.env" >nul 2>&1
if not errorlevel 1 (
    echo.
    echo   [X] server\.env still has a placeholder SSO secret, so signing in
    echo       will fail. Ask the team lead for the TaskMentor dev SSO secret,
    echo       then put it in server\.env as:
    echo           SSO_CLIENT_SECRET=...
    echo.
    pause
    exit /b 1
)
echo   - Configuration present

:: --------------------------------------------------------------- 3. Database
echo [3/5] Checking MySQL...
set "MYSQL_CMD="
where mysql >nul 2>&1
if not errorlevel 1 set "MYSQL_CMD=mysql"
if "!MYSQL_CMD!"=="" if exist "C:\xampp\mysql\bin\mysql.exe" set "MYSQL_CMD=C:\xampp\mysql\bin\mysql.exe"
if "!MYSQL_CMD!"=="" if exist "D:\xampp\mysql\bin\mysql.exe" set "MYSQL_CMD=D:\xampp\mysql\bin\mysql.exe"

if "!MYSQL_CMD!"=="" (
    echo.
    echo   [X] Could not find MySQL. Install MySQL 8, or start MySQL in the
    echo       XAMPP Control Panel, then run this again.
    echo.
    pause
    exit /b 1
)

"!MYSQL_CMD!" -u root -e "SELECT 1;" >nul 2>&1
if errorlevel 1 (
    echo.
    echo   [warn] MySQL is installed but not accepting connections.
    echo       Start it ^(XAMPP Control Panel - Start next to MySQL^), then
    echo       press any key to retry...
    pause >nul
    "!MYSQL_CMD!" -u root -e "SELECT 1;" >nul 2>&1
    if errorlevel 1 (
        echo   [X] Still cannot reach MySQL. Fix that first.
        pause
        exit /b 1
    )
)
echo   - MySQL ready

"!MYSQL_CMD!" -u root -e "CREATE DATABASE IF NOT EXISTS taskmentor_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" >nul 2>&1
"!MYSQL_CMD!" -u root -e "USE taskmentor_dev; SELECT 1 FROM users LIMIT 1;" >nul 2>&1
if errorlevel 1 (
    echo   - Importing server\taskmentor_dev.sql ^(first run, takes a minute^)...
    "!MYSQL_CMD!" -u root taskmentor_dev < "server\taskmentor_dev.sql"
    if errorlevel 1 (
        echo   [X] Import failed. Check that server\taskmentor_dev.sql exists.
        pause
        exit /b 1
    )
    echo   - Database ready
) else (
    echo   - Database ready
)

:: ----------------------------------------------------------- 4. Dependencies
echo [4/5] Checking dependencies...
if not exist "node_modules" (
    echo   - Installing root packages ^(first run, takes a few minutes^)...
    call npm install --legacy-peer-deps
)
if not exist "server\node_modules" (
    echo   - Installing server packages...
    call npm install --prefix server --legacy-peer-deps
)
if not exist "client\node_modules" (
    echo   - Installing client packages...
    call npm install --prefix client --legacy-peer-deps
)
echo   - Dependencies ready

:: ----------------------------------------------------------------- 5. Launch
echo [5/5] Starting TaskMentor...
echo.
echo ===================================================
echo   Open:  http://localhost:5174/taskmentor
echo   API:   http://localhost:5002
echo.
echo   Clicking Sign In takes you to the real MIS at
echo   mis.amashuri.com, which sends you straight back
echo   here once you are logged in.
echo.
echo   Ask your team lead for the MIS admin login.
echo.
echo   Press Ctrl+C in this window to stop.
echo ===================================================
echo.
call npm run dev
pause
