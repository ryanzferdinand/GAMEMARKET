@echo off
echo ======================================
echo  GameMarket - Starting Dev Servers
echo ======================================
echo.

echo Checking for processes on port 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000 " 2^>nul') do (
    echo Killing process %%a on port 5000...
    taskkill /F /PID %%a >nul 2>&1
)

echo Checking for processes on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " 2^>nul') do (
    echo Killing process %%a on port 3000...
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 1 /nobreak > nul

echo.
echo Starting Backend (port 5000)...
start "GameMarket Backend" cmd /k "cd /d "%~dp0..\backend" && npm run dev"

timeout /t 2 /nobreak > nul

echo Starting Frontend (port 3000)...
start "GameMarket Frontend" cmd /k "cd /d "%~dp0..\frontend" && npm run dev"

echo.
echo ======================================
echo  Both servers started!
echo  Frontend : http://localhost:3000
echo  Backend  : http://localhost:5000
echo  Admin    : http://localhost:3000/admin
echo ======================================
echo.
pause
