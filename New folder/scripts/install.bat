@echo off
echo ======================================
echo  GameMarket - Installing Dependencies
echo ======================================

echo.
echo [1/2] Installing Backend dependencies...
cd /d "%~dp0..\backend"
call npm install

echo.
echo [2/2] Installing Frontend dependencies...
cd /d "%~dp0..\frontend"
call npm install

echo.
echo ======================================
echo  Setup Complete!
echo ======================================
echo.
echo Next steps:
echo  1. Copy backend\.env.example to backend\.env
echo  2. Fill in your MongoDB URI, JWT_SECRET, and Google Client ID
echo  3. Copy frontend\.env.example to frontend\.env
echo  4. Fill in your Google Client ID
echo  5. Run start.bat (auto local dev) or scripts\start-dev.bat
echo.
pause
