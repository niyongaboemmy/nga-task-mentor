@echo off
setlocal enabledelayedexpansion
title TaskMentor - local development
cd /d "%~dp0"

echo ===================================================
echo    NGA TaskMentor  -  local development
echo ===================================================
echo.

:: ---------------------------------------------------------------- 1. Node.js
echo [1/6] Checking Node.js...
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
echo [2/6] Checking configuration...
if not exist "server\.env" (
    copy "server\.env.example" "server\.env" >nul
    echo   - Created server\.env
)
if not exist "client\.env" (
    copy "client\.env.example" "client\.env" >nul
    echo   - Created client\.env
)
:: These files are git-ignored: your local settings can never be pushed.
:: An .env from an earlier setup pointed sign-in at the production MIS and
:: needed a secret pasted in. Sign-in now goes through the local MIS below, so
:: that file can never work again - say so rather than fail at the login page.
set "STALE_ENV="
findstr /R /C:"^NGA_MIS_BASE_URL=https://api.amashuri.com" /C:"PASTE_DEV_SECRET_FROM_MIS_SYSTEMS_PAGE" "server\.env" >nul 2>&1
if not errorlevel 1 set "STALE_ENV=1"
findstr /R /C:"^VITE_MIS_LOGIN_URL=https://mis.amashuri.com" "client\.env" >nul 2>&1
if not errorlevel 1 set "STALE_ENV=1"
if defined STALE_ENV (
    echo.
    echo   [warn] Your .env files point at the production MIS ^(an older setup^).
    echo          TaskMentor now signs in through a Central MIS on this machine, so
    echo          SIGNING IN WILL FAIL until they are updated. Easiest fix: move
    echo          any keys you added out of server\.env and client\.env,
    echo          delete both files, and run start.bat again.
    echo.
)
echo   - Configuration present

:: ------------------------------------------------------------ 3. Central MIS
:: TaskMentor has no login of its own - users sign in through the NGA Central MIS.
:: Like the Docker stack, we run a private copy of the MIS on this machine: its
:: own start.bat builds a local database seeded with a known admin login and
:: with this module's SSO client (backend/scripts/setup-local-db.ts), which is
:: what .env.example already points at. Nothing here touches the real MIS.
::
:: It is started now, in its own window, so its first-run install and database
:: build overlap with ours below. We only wait for it right before launch.
echo [3/6] Checking Central MIS...
set "MIS_REPO=https://github.com/niyongaboemmy/nga_central_mis.git"
set "MIS_STARTED="
call :port_open 5001
if not errorlevel 1 (
    echo   - Already running on http://localhost:5001
    goto :mis_started
)

:: Where is the MIS checkout? An explicit NGA_MIS_DIR wins; otherwise a clone
:: next to this folder, then the NGAMIS workspace layout used with docker-compose.
set "MIS_DIR="
if defined NGA_MIS_DIR if exist "%NGA_MIS_DIR%\start.bat" set "MIS_DIR=%NGA_MIS_DIR%"
if "!MIS_DIR!"=="" if exist "..\nga_central_mis\start.bat" set "MIS_DIR=..\nga_central_mis"
if "!MIS_DIR!"=="" if exist "..\..\Central MIS\nga_central_mis\start.bat" set "MIS_DIR=..\..\Central MIS\nga_central_mis"

if "!MIS_DIR!"=="" (
    echo   - Not found next to this folder. Cloning it ^(one time^)...
    where git >nul 2>&1
    if errorlevel 1 (
        echo.
        echo   [warn] Git is not installed, so the Central MIS cannot be fetched.
        echo          Install it from https://git-scm.com/ and run this again.
        echo          TaskMentor will start, but SIGNING IN WILL NOT WORK until then.
        echo.
        goto :mis_started
    )
    git clone "!MIS_REPO!" "..\nga_central_mis"
    if errorlevel 1 (
        echo.
        echo   [warn] Could not clone the Central MIS. You need access to its
        echo          repository - ask your team lead - then run this again.
        echo          TaskMentor will start, but SIGNING IN WILL NOT WORK until then.
        echo.
        goto :mis_started
    )
    set "MIS_DIR=..\nga_central_mis"
)
for %%D in ("!MIS_DIR!") do set "MIS_DIR=%%~fD"
echo   - Using !MIS_DIR!
echo   - Starting it in its own window
start "Central MIS - local development" /D "!MIS_DIR!" cmd /k .\start.bat
set "MIS_STARTED=1"
:mis_started

:: --------------------------------------------------------------- 4. Database
echo [4/6] Checking MySQL...
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

:: ----------------------------------------------------------- 5. Dependencies
echo [5/6] Checking dependencies...
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

:: ----------------------------------------------------------------- 6. Launch
:: The MIS was started in parallel above; give it until now to come up.
if defined MIS_STARTED (
    echo   - Waiting for Central MIS on port 5001 ^(first run: a few minutes^)
    call :wait_port 5001 900
    if errorlevel 1 (
        echo.
        echo   [warn] Central MIS is still not answering after 15 minutes. Look at
        echo          the "Central MIS" window for what it is stuck on. TaskMentor
        echo          starts anyway, but signing in needs the MIS running.
        echo.
    ) else (
        echo   - Central MIS ready on http://localhost:5001
    )
)
echo [6/6] Starting TaskMentor...
echo.
echo ===================================================
echo   Open:  http://localhost:5174/taskmentor
echo   API:   http://localhost:5002
echo.
echo   Click Sign In - it takes you to your own Central
echo   MIS at localhost:5173. Sign in as
echo.
echo       superadmin  /  Admin@1234
echo.
echo   The 6-digit code is printed on the login page.
echo   Everything is local - production is never touched.
echo.
echo   Press Ctrl+C in this window to stop.
echo ===================================================
echo.
call npm run dev
pause

goto :eof

:: ---------------------------------------------------------------- helpers
:: Both gate on the TCP port rather than on a tool being on PATH: that is what
:: "the MIS is up" actually means, and it works whether it runs natively or in
:: Docker. PowerShell is used because cmd has no socket primitive of its own.

:: port_open <port>  ->  errorlevel 0 if something is listening
:port_open
powershell -NoProfile -Command "try{(New-Object Net.Sockets.TcpClient('127.0.0.1',%1)).Close();exit 0}catch{exit 1}" >nul 2>&1
exit /b %errorlevel%

:: wait_port <port> <seconds>  ->  errorlevel 0 once it opens, 1 on timeout
:wait_port
powershell -NoProfile -Command "$d=(Get-Date).AddSeconds(%2);while((Get-Date) -lt $d){try{(New-Object Net.Sockets.TcpClient('127.0.0.1',%1)).Close();Write-Host '';exit 0}catch{};Write-Host -NoNewline '.';Start-Sleep 5};Write-Host '';exit 1"
exit /b %errorlevel%
